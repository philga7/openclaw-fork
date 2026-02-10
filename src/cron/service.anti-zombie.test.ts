import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCronServiceState } from "./service/state.js";
import { startAntiZombieWatchdog } from "./service/timer.js";
import { type CronJob, type CronStoreFile } from "./types.js";

const noopLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe("cron anti-zombie watchdog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-12-13T00:00:00.000Z"));
    noopLogger.debug.mockClear();
    noopLogger.info.mockClear();
    noopLogger.warn.mockClear();
    noopLogger.error.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("re-initializes the scheduler when no tick completes within 60s", async () => {
    const now = Date.now();
    const state = createCronServiceState({
      storePath: "/tmp/cron-jobs.json",
      cronEnabled: true,
      log: noopLogger,
      enqueueSystemEvent: vi.fn(),
      requestHeartbeatNow: vi.fn(),
      runIsolatedAgentJob: vi.fn(async () => ({ status: "ok" })),
    });

    const job: CronJob = {
      id: "job-1",
      name: "test",
      enabled: true,
      deleteAfterRun: false,
      createdAtMs: now,
      updatedAtMs: now,
      schedule: { kind: "at", at: new Date(now + 60_000).toISOString() },
      sessionTarget: "main",
      wakeMode: "next-heartbeat",
      payload: { kind: "systemEvent", text: "hello" },
      state: { nextRunAtMs: now + 60_000 },
    };

    const store: CronStoreFile = {
      version: 1,
      jobs: [job],
    };

    state.store = store;
    state.lastTimerTickAtMs = now - 61_000; // simulate idle scheduler

    expect(state.timer).toBeNull();

    startAntiZombieWatchdog(state);

    // Fire the anti-zombie interval once.
    await vi.advanceTimersByTimeAsync(60_000);

    expect(noopLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        thresholdMs: 60_000,
      }),
      expect.stringContaining("cron: anti-zombie: no tick in 60s, re-initializing scheduler"),
    );

    expect(state.timer).not.toBeNull();
  });

  it("does not trigger when a recent tick has completed", async () => {
    const now = Date.now();
    const state = createCronServiceState({
      storePath: "/tmp/cron-jobs.json",
      cronEnabled: true,
      log: noopLogger,
      enqueueSystemEvent: vi.fn(),
      requestHeartbeatNow: vi.fn(),
      runIsolatedAgentJob: vi.fn(async () => ({ status: "ok" })),
    });

    const job: CronJob = {
      id: "job-1",
      name: "test",
      enabled: true,
      deleteAfterRun: false,
      createdAtMs: now,
      updatedAtMs: now,
      schedule: { kind: "at", at: new Date(now + 60_000).toISOString() },
      sessionTarget: "main",
      wakeMode: "next-heartbeat",
      payload: { kind: "systemEvent", text: "hello" },
      state: { nextRunAtMs: now + 60_000 },
    };

    const store: CronStoreFile = {
      version: 1,
      jobs: [job],
    };

    state.store = store;
    state.lastTimerTickAtMs = now; // last tick just completed

    startAntiZombieWatchdog(state);

    await vi.advanceTimersByTimeAsync(60_000);

    expect(noopLogger.warn).not.toHaveBeenCalled();
  });

  it("recovers stale-running jobs and re-enqueues them as due", async () => {
    const now = Date.now();
    const state = createCronServiceState({
      storePath: "/tmp/cron-jobs.json",
      cronEnabled: true,
      log: noopLogger,
      enqueueSystemEvent: vi.fn(),
      requestHeartbeatNow: vi.fn(),
      runIsolatedAgentJob: vi.fn(async () => ({ status: "ok" })),
    });

    const staleRunningAt = now - 3 * 60 * 60_000; // 3 hours ago, well beyond STALE_RUNNING_MS

    const job: CronJob = {
      id: "stale-job-1",
      name: "stale-running",
      enabled: true,
      deleteAfterRun: false,
      createdAtMs: now,
      updatedAtMs: now,
      schedule: { kind: "at", at: new Date(now + 60_000).toISOString() },
      sessionTarget: "main",
      wakeMode: "next-heartbeat",
      payload: { kind: "systemEvent", text: "hello stale" },
      state: { nextRunAtMs: now + 60_000, runningAtMs: staleRunningAt },
    };

    const store: CronStoreFile = {
      version: 1,
      jobs: [job],
    };

    state.store = store;
    state.lastTimerTickAtMs = now - 61_000; // simulate idle scheduler
    state.timer = null;

    startAntiZombieWatchdog(state);

    await vi.advanceTimersByTimeAsync(60_000);

    expect(noopLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        lastTimerTickAtMs: state.lastTimerTickAtMs,
        thresholdMs: 60_000,
      }),
      expect.stringContaining("cron: anti-zombie: no tick in 60s, re-initializing scheduler"),
    );

    expect(noopLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "stale-job-1",
        runningAtMs: staleRunningAt,
      }),
      "cron: anti-zombie: recovering stale-running job",
    );

    expect(job.state.runningAtMs).toBeUndefined();
    expect(typeof job.state.nextRunAtMs).toBe("number");
    expect((job.state.nextRunAtMs as number) >= now).toBe(true);
  });

  it("does not recover fresh running markers", async () => {
    const now = Date.now();
    const state = createCronServiceState({
      storePath: "/tmp/cron-jobs.json",
      cronEnabled: true,
      log: noopLogger,
      enqueueSystemEvent: vi.fn(),
      requestHeartbeatNow: vi.fn(),
      runIsolatedAgentJob: vi.fn(async () => ({ status: "ok" })),
    });

    const freshRunningAt = now - 5 * 60_000; // 5 minutes ago, below STALE_RUNNING_MS

    const job: CronJob = {
      id: "fresh-job-1",
      name: "fresh-running",
      enabled: true,
      deleteAfterRun: false,
      createdAtMs: now,
      updatedAtMs: now,
      schedule: { kind: "at", at: new Date(now + 60_000).toISOString() },
      sessionTarget: "main",
      wakeMode: "next-heartbeat",
      payload: { kind: "systemEvent", text: "hello fresh" },
      state: { nextRunAtMs: now + 60_000, runningAtMs: freshRunningAt },
    };

    const store: CronStoreFile = {
      version: 1,
      jobs: [job],
    };

    state.store = store;
    state.lastTimerTickAtMs = now - 61_000; // still idle to trigger anti-zombie
    state.timer = null;

    startAntiZombieWatchdog(state);

    await vi.advanceTimersByTimeAsync(60_000);

    // We still expect the general anti-zombie warning about re-initialization.
    expect(noopLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        lastTimerTickAtMs: state.lastTimerTickAtMs,
        thresholdMs: 60_000,
      }),
      expect.stringContaining("cron: anti-zombie: no tick in 60s, re-initializing scheduler"),
    );

    // But there should be no recovery log for this job, and its runningAtMs remains.
    expect(
      noopLogger.warn.mock.calls.find(([, msg]) =>
        String(msg).includes("cron: anti-zombie: recovering stale-running job"),
      ),
    ).toBeUndefined();

    expect(job.state.runningAtMs).toBe(freshRunningAt);
    expect(job.state.nextRunAtMs).toBe(now + 60_000);
  });
});
