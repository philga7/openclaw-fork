import { describe, expect, it, vi } from "vitest";

vi.mock("../../logging/subsystem.js", async (orig) => {
  const actual = await (orig as () => Promise<unknown>)();
  return {
    ...actual,
    createSubsystemLogger: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
      fatal: vi.fn(),
      raw: vi.fn(),
      child: vi.fn(),
      isEnabled: vi.fn(() => true),
      subsystem: "discord/supervisor",
    })),
  };
});

describe("monitorDiscordProviderWithSupervisor", () => {
  it("returns immediately when abortSignal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    const { monitorDiscordProviderWithSupervisor } = await import("./provider.js");

    await expect(
      monitorDiscordProviderWithSupervisor({
        abortSignal: controller.signal,
      } as never),
    ).resolves.toBeUndefined();
  });
});
