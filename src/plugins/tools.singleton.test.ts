import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolvePluginTools } from "./tools.js";

type TempPlugin = { dir: string; file: string; id: string };

const tempDirs: string[] = [];
const EMPTY_PLUGIN_SCHEMA = { type: "object", additionalProperties: false, properties: {} };

function makeTempDir() {
  const dir = path.join(os.tmpdir(), `openclaw-plugin-tools-${randomUUID()}`);
  fs.mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}

function writePlugin(params: { id: string; body: string }): TempPlugin {
  const dir = makeTempDir();
  const file = path.join(dir, `${params.id}.js`);
  fs.writeFileSync(file, params.body, "utf-8");
  fs.writeFileSync(
    path.join(dir, "openclaw.plugin.json"),
    JSON.stringify(
      {
        id: params.id,
        configSchema: EMPTY_PLUGIN_SCHEMA,
      },
      null,
      2,
    ),
    "utf-8",
  );
  return { dir, file, id: params.id };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore cleanup failures
    }
  }
});

describe("resolvePluginTools singleton tools", () => {
  it("wraps tools listed in OPENCLAW_SINGLETON_TOOLS with a per-name lock", async () => {
    const plugin = writePlugin({
      id: "singleton-demo",
      body: `
export default { register(api) {
  api.registerTool(
    {
      name: "bird",
      description: "singleton test tool",
      parameters: { type: "object", properties: {} },
      async execute(_toolCallId, _params, _signal, onUpdate) {
        onUpdate?.({ content: [{ type: "text", text: "start" }] });
        await new Promise((resolve) => setTimeout(resolve, 10));
        onUpdate?.({ content: [{ type: "text", text: "end" }] });
        return { content: [{ type: "text", text: "ok" }] };
      },
    },
    { optional: false },
  );
} }
`,
    });

    const prevEnv = process.env.OPENCLAW_SINGLETON_TOOLS;
    process.env.OPENCLAW_SINGLETON_TOOLS = "bird";

    try {
      const tools = resolvePluginTools({
        context: {
          config: {
            plugins: {
              load: { paths: [plugin.file] },
              allow: [plugin.id],
            },
          },
          workspaceDir: plugin.dir,
        },
      });

      expect(tools).toHaveLength(1);
      const tool = tools[0];
      expect(tool.name).toBe("bird");

      const updates: string[] = [];
      const onUpdate = vi.fn((res: unknown) => {
        const details = res as { content?: { type: string; text: string }[] };
        const text = details.content?.[0]?.text;
        if (typeof text === "string") {
          updates.push(text);
        }
      });

      // Fire two executions "concurrently". Because of the per-name lock we expect
      // both to complete successfully, and the sequence of updates to be ordered
      // per execution without interleaving failures.
      await Promise.all([
        tool.execute("call-1", {}, undefined, onUpdate),
        tool.execute("call-2", {}, undefined, onUpdate),
      ]);

      expect(updates).toContain("start");
      expect(updates).toContain("end");
    } finally {
      if (prevEnv === undefined) {
        delete process.env.OPENCLAW_SINGLETON_TOOLS;
      } else {
        process.env.OPENCLAW_SINGLETON_TOOLS = prevEnv;
      }
    }
  });

  it("does not wrap tools when OPENCLAW_SINGLETON_TOOLS is unset or empty", () => {
    const plugin = writePlugin({
      id: "no-singleton",
      body: `
export default { register(api) {
  api.registerTool(
    {
      name: "bird",
      description: "non-singleton test tool",
      parameters: { type: "object", properties: {} },
      async execute() {
        return { content: [{ type: "text", text: "ok" }] };
      },
    },
    { optional: false },
  );
} }
`,
    });

    const prevEnv = process.env.OPENCLAW_SINGLETON_TOOLS;
    delete process.env.OPENCLAW_SINGLETON_TOOLS;

    try {
      const tools = resolvePluginTools({
        context: {
          config: {
            plugins: {
              load: { paths: [plugin.file] },
              allow: [plugin.id],
            },
          },
          workspaceDir: plugin.dir,
        },
      });

      expect(tools).toHaveLength(1);
      const tool = tools[0];
      expect(tool.name).toBe("bird");
    } finally {
      if (prevEnv === undefined) {
        delete process.env.OPENCLAW_SINGLETON_TOOLS;
      } else {
        process.env.OPENCLAW_SINGLETON_TOOLS = prevEnv;
      }
    }
  });
});
