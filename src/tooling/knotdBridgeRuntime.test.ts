import { describe, expect, it, vi } from "vitest";
// @ts-expect-error Plain ESM script consumed directly by the bridge.
import { createReconnectController } from "../../scripts/knotd-mcp-bridge-runtime.mjs";

function buildController(overrides: Record<string, unknown> = {}) {
  const connect = vi.fn();
  const schedule = vi.fn();
  const clearScheduled = vi.fn();
  const log = vi.fn();
  const controller = createReconnectController({
    connect,
    schedule,
    clearScheduled,
    log,
    connectRetryMs: 150,
    connectMaxRetryMs: 1500,
    maxConsecutiveFailuresBeforeWait: 3,
    ...overrides,
  });

  return { controller, connect, schedule, clearScheduled, log };
}

describe("knotd bridge reconnect controller", () => {
  it("backs off reconnect delay after consecutive failures", () => {
    const { controller, schedule } = buildController({
      maxConsecutiveFailuresBeforeWait: 4,
    });

    controller.onDisconnect(new Error("first"));
    controller.onDisconnect(new Error("second"));
    controller.onDisconnect(new Error("third"));

    expect(schedule).toHaveBeenNthCalledWith(1, 150, expect.any(Function));
    expect(schedule).toHaveBeenNthCalledWith(2, 300, expect.any(Function));
    expect(schedule).toHaveBeenNthCalledWith(3, 600, expect.any(Function));
  });

  it("enters wait mode after repeated failures and does not keep scheduling reconnects", () => {
    const { controller, schedule, log } = buildController({
      maxConsecutiveFailuresBeforeWait: 2,
    });

    controller.onDisconnect(new Error("first"));
    controller.onDisconnect(new Error("second"));

    expect(controller.snapshot()).toMatchObject({
      state: "waiting_for_signal",
      consecutiveFailures: 2,
    });
    expect(schedule).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(
      "wait_for_signal",
      expect.objectContaining({ consecutiveFailures: 2 })
    );
  });

  it("reconnects immediately on hup while waiting for signal", () => {
    const { controller, connect, clearScheduled, log } = buildController({
      maxConsecutiveFailuresBeforeWait: 1,
    });

    controller.onDisconnect(new Error("boom"));
    controller.onSignal("SIGHUP");

    expect(clearScheduled).toHaveBeenCalled();
    expect(connect).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("signal_reconnect", { signal: "SIGHUP" });
  });

  it("resets failure count after successful reconnect", () => {
    const { controller } = buildController();

    controller.onDisconnect(new Error("first"));
    controller.onDisconnect(new Error("second"));
    controller.onConnect();

    expect(controller.snapshot()).toMatchObject({
      state: "connected",
      consecutiveFailures: 0,
      nextDelayMs: 150,
    });
  });
});
