import { describe, expect, it, vi } from "vitest";

vi.mock("@mariozechner/pi-coding-agent", () => ({
  SessionManager: {
    open: vi.fn(),
  },
}));

vi.mock("../compaction.js", () => ({
  estimateMessagesTokens: vi.fn(),
}));

import { SessionManager } from "@mariozechner/pi-coding-agent";
import { estimateMessagesTokens } from "../compaction.js";
import { getEstimatedSessionTokens } from "./session-token-estimate.js";

const mockedOpen = vi.mocked(SessionManager.open);
const mockedEstimate = vi.mocked(estimateMessagesTokens);

describe("getEstimatedSessionTokens", () => {
  it("returns token count from estimateMessagesTokens for session branch messages", async () => {
    const mockMessages = [
      { role: "user" as const, content: "hello", timestamp: 1 },
      { role: "assistant" as const, content: "hi", timestamp: 2 },
    ];
    mockedOpen.mockReturnValue({
      getBranch: vi.fn(() => [
        { type: "message", message: mockMessages[0] },
        { type: "message", message: mockMessages[1] },
      ]),
    } as unknown as ReturnType<typeof SessionManager.open>);
    mockedEstimate.mockReturnValue(42);

    const result = await getEstimatedSessionTokens("/tmp/session.jsonl");

    expect(mockedOpen).toHaveBeenCalledWith("/tmp/session.jsonl");
    expect(mockedEstimate).toHaveBeenCalledWith(mockMessages);
    expect(result).toBe(42);
  });

  it("returns 0 when branch has no message entries", async () => {
    mockedOpen.mockReturnValue({
      getBranch: vi.fn(() => []),
    } as unknown as ReturnType<typeof SessionManager.open>);
    mockedEstimate.mockReturnValue(0);

    const result = await getEstimatedSessionTokens("/tmp/empty.jsonl");

    expect(mockedEstimate).toHaveBeenCalledWith([]);
    expect(result).toBe(0);
  });

  it("ignores non-message branch entries", async () => {
    mockedOpen.mockReturnValue({
      getBranch: vi.fn(() => [
        { type: "compaction", summary: "old" },
        { type: "message", message: { role: "user", content: "x", timestamp: 1 } },
      ]),
    } as unknown as ReturnType<typeof SessionManager.open>);
    mockedEstimate.mockReturnValue(10);

    const result = await getEstimatedSessionTokens("/tmp/session.jsonl");

    expect(mockedEstimate).toHaveBeenCalledWith([{ role: "user", content: "x", timestamp: 1 }]);
    expect(result).toBe(10);
  });
});
