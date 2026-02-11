import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLatestSessionTranscriptForAgent, resolveStorePath } from "./paths.js";

describe("resolveStorePath", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses OPENCLAW_HOME for tilde expansion", () => {
    vi.stubEnv("OPENCLAW_HOME", "/srv/openclaw-home");
    vi.stubEnv("HOME", "/home/other");

    const resolved = resolveStorePath("~/.openclaw/agents/{agentId}/sessions/sessions.json", {
      agentId: "research",
    });

    expect(resolved).toBe(
      path.resolve("/srv/openclaw-home/.openclaw/agents/research/sessions/sessions.json"),
    );
  });
});

describe("getLatestSessionTranscriptForAgent", () => {
  let tempDir: string;
  let sessionsDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(path.sep, "tmp", "openclaw-paths-test-"));
    sessionsDir = path.join(tempDir, ".openclaw", "agents", "main", "sessions");
    await fs.mkdir(sessionsDir, { recursive: true });
    vi.stubEnv("OPENCLAW_HOME", tempDir);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it("returns null when sessions dir has no jsonl files", async () => {
    const result = await getLatestSessionTranscriptForAgent("main");
    expect(result).toBeNull();
  });

  it("returns null when sessions dir does not exist", async () => {
    const result = await getLatestSessionTranscriptForAgent("other-agent");
    expect(result).toBeNull();
    await fs.mkdir(path.join(tempDir, ".openclaw", "agents", "other-agent", "sessions"), {
      recursive: true,
    });
    const resultAfter = await getLatestSessionTranscriptForAgent("other-agent");
    expect(resultAfter).toBeNull();
  });

  it("returns the most recently modified session file", async () => {
    const older = path.join(sessionsDir, "session-old.jsonl");
    const newer = path.join(sessionsDir, "session-new.jsonl");
    await fs.writeFile(older, '{"type":"session","id":"session-old"}\n', "utf-8");
    await fs.writeFile(newer, '{"type":"session","id":"session-new"}\n', "utf-8");
    const past = Date.now() - 60_000;
    await fs.utimes(older, past / 1000, past / 1000);
    await fs.utimes(newer, Date.now() / 1000, Date.now() / 1000);

    const result = await getLatestSessionTranscriptForAgent("main");

    expect(result).not.toBeNull();
    expect(result!.sessionId).toBe("session-new");
    expect(result!.sessionFile).toBe(newer);
  });

  it("derives sessionId from filename stem (topic suffix)", async () => {
    const file = path.join(sessionsDir, "chat-123-topic-abc.jsonl");
    await fs.writeFile(file, '{"type":"session"}\n', "utf-8");

    const result = await getLatestSessionTranscriptForAgent("main");

    expect(result).not.toBeNull();
    expect(result!.sessionId).toBe("chat-123-topic-abc");
    expect(result!.sessionFile).toBe(file);
  });
});
