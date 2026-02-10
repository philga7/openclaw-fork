import type { AnyAgentTool } from "../agents/tools/common.js";
import type { OpenClawPluginToolContext } from "./types.js";
import { normalizeToolName } from "../agents/tool-policy.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { loadOpenClawPlugins } from "./loader.js";

const log = createSubsystemLogger("plugins");

type PluginToolMeta = {
  pluginId: string;
  optional: boolean;
};

const pluginToolMeta = new WeakMap<AnyAgentTool, PluginToolMeta>();

export function getPluginToolMeta(tool: AnyAgentTool): PluginToolMeta | undefined {
  return pluginToolMeta.get(tool);
}

function normalizeAllowlist(list?: string[]) {
  return new Set((list ?? []).map(normalizeToolName).filter(Boolean));
}

function isOptionalToolAllowed(params: {
  toolName: string;
  pluginId: string;
  allowlist: Set<string>;
}): boolean {
  if (params.allowlist.size === 0) {
    return false;
  }
  const toolName = normalizeToolName(params.toolName);
  if (params.allowlist.has(toolName)) {
    return true;
  }
  const pluginKey = normalizeToolName(params.pluginId);
  if (params.allowlist.has(pluginKey)) {
    return true;
  }
  return params.allowlist.has("group:plugins");
}

// Some tools shell out to CLIs that are effectively singletons on the host
// (they contend for the same config files, databases, or sockets). When multiple
// agents try to call these tools at the same time, the underlying CLI can fail
// with transient errors (for example "Command exited with code 1").
//
// To make gateway-driven Waves reliable without hard-coding specific tools, we
// allow operators to configure which plugin tools should be treated as
// singletons via the OPENCLAW_SINGLETON_TOOLS env var:
//
//   OPENCLAW_SINGLETON_TOOLS="bird,himalaya,other_tool"
//
// Values are comma-separated and compared using normalized tool names.
function resolveSingletonToolNamesFromEnv(): Set<string> {
  const raw = process.env.OPENCLAW_SINGLETON_TOOLS;
  if (!raw) {
    return new Set();
  }
  const names = raw
    .split(",")
    .map((part) => normalizeToolName(part))
    .filter(Boolean);
  return new Set(names);
}

const SINGLETON_TOOL_NAMES = resolveSingletonToolNamesFromEnv();

type SingletonLockState = {
  running: boolean;
  queue: Array<() => void>;
};

const singletonToolLocks = new Map<string, SingletonLockState>();

async function withSingletonToolLock<T>(toolName: string, fn: () => Promise<T>): Promise<T> {
  const key = normalizeToolName(toolName);
  if (!SINGLETON_TOOL_NAMES.has(key)) {
    return fn();
  }

  let state = singletonToolLocks.get(key);
  if (!state) {
    state = { running: false, queue: [] };
    singletonToolLocks.set(key, state);
  }

  if (state.running) {
    await new Promise<void>((resolve) => {
      state?.queue.push(resolve);
    });
  } else {
    state.running = true;
  }

  try {
    return await fn();
  } finally {
    const next = state.queue.shift();
    if (next) {
      // Keep `running` true and hand off to the next waiter so only one
      // invocation per singleton tool executes at a time.
      next();
    } else {
      state.running = false;
      singletonToolLocks.delete(key);
    }
  }
}

export function resolvePluginTools(params: {
  context: OpenClawPluginToolContext;
  existingToolNames?: Set<string>;
  toolAllowlist?: string[];
}): AnyAgentTool[] {
  const registry = loadOpenClawPlugins({
    config: params.context.config,
    workspaceDir: params.context.workspaceDir,
    logger: {
      info: (msg) => log.info(msg),
      warn: (msg) => log.warn(msg),
      error: (msg) => log.error(msg),
      debug: (msg) => log.debug(msg),
    },
  });

  const tools: AnyAgentTool[] = [];
  const existing = params.existingToolNames ?? new Set<string>();
  const existingNormalized = new Set(Array.from(existing, (tool) => normalizeToolName(tool)));
  const allowlist = normalizeAllowlist(params.toolAllowlist);
  const blockedPlugins = new Set<string>();

  for (const entry of registry.tools) {
    if (blockedPlugins.has(entry.pluginId)) {
      continue;
    }
    const pluginIdKey = normalizeToolName(entry.pluginId);
    if (existingNormalized.has(pluginIdKey)) {
      const message = `plugin id conflicts with core tool name (${entry.pluginId})`;
      log.error(message);
      registry.diagnostics.push({
        level: "error",
        pluginId: entry.pluginId,
        source: entry.source,
        message,
      });
      blockedPlugins.add(entry.pluginId);
      continue;
    }
    let resolved: AnyAgentTool | AnyAgentTool[] | null | undefined = null;
    try {
      resolved = entry.factory(params.context);
    } catch (err) {
      log.error(`plugin tool failed (${entry.pluginId}): ${String(err)}`);
      continue;
    }
    if (!resolved) {
      continue;
    }
    const listRaw = Array.isArray(resolved) ? resolved : [resolved];
    const list = entry.optional
      ? listRaw.filter((tool) =>
          isOptionalToolAllowed({
            toolName: tool.name,
            pluginId: entry.pluginId,
            allowlist,
          }),
        )
      : listRaw;
    if (list.length === 0) {
      continue;
    }
    const nameSet = new Set<string>();
    for (const tool of list) {
      if (nameSet.has(tool.name) || existing.has(tool.name)) {
        const message = `plugin tool name conflict (${entry.pluginId}): ${tool.name}`;
        log.error(message);
        registry.diagnostics.push({
          level: "error",
          pluginId: entry.pluginId,
          source: entry.source,
          message,
        });
        continue;
      }
      nameSet.add(tool.name);
      existing.add(tool.name);

      // Wrap singleton tools in a small in-process queue so that only one
      // invocation per tool name runs at a time. This avoids filesystem or
      // database contention in CLIs like `bird` and `himalaya` when multiple
      // agents hit them simultaneously.
      const shouldWrap = SINGLETON_TOOL_NAMES.has(normalizeToolName(tool.name));
      const wrapped: AnyAgentTool =
        shouldWrap && typeof tool.execute === "function"
          ? {
              ...tool,
              execute: async (toolCallId, params, signal, onUpdate) =>
                withSingletonToolLock(tool.name, () =>
                  tool.execute(toolCallId, params, signal, onUpdate),
                ),
            }
          : tool;

      pluginToolMeta.set(wrapped, {
        pluginId: entry.pluginId,
        optional: entry.optional,
      });
      tools.push(wrapped);
    }
  }

  return tools;
}
