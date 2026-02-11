import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { SessionManager } from "@mariozechner/pi-coding-agent";
import { estimateMessagesTokens } from "../compaction.js";

type BranchEntry = { type: string; message?: AgentMessage };

/**
 * Estimate total tokens for the current session branch without holding the session lock.
 * Used by the proactive compaction guard to decide if we should compact before the next turn.
 */
export async function getEstimatedSessionTokens(sessionFile: string): Promise<number> {
  const sessionManager = SessionManager.open(sessionFile);
  try {
    const branch = sessionManager.getBranch() as BranchEntry[];
    const messages = branch
      .filter(
        (e): e is BranchEntry & { message: AgentMessage } => e.type === "message" && !!e.message,
      )
      .map((e) => e.message);
    return estimateMessagesTokens(messages);
  } finally {
    // SessionManager may not have dispose; avoid leaving file handles if SDK adds one later
    const sm = sessionManager as { dispose?: () => void };
    if (typeof sm.dispose === "function") {
      sm.dispose();
    }
  }
}
