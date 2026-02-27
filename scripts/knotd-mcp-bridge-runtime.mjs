#!/usr/bin/env node
/* eslint-env node */

function clampDelay(delayMs, maxDelayMs) {
  return Math.min(Math.max(delayMs, 0), Math.max(maxDelayMs, 0));
}

export function createReconnectController(options) {
  const {
    connect,
    schedule,
    clearScheduled,
    log,
    connectRetryMs,
    connectMaxRetryMs,
    maxConsecutiveFailuresBeforeWait,
  } = options;

  let consecutiveFailures = 0;
  let nextDelayMs = Math.max(connectRetryMs, 0);
  let state = "idle";
  let scheduled = false;

  const snapshot = () => ({
    state,
    consecutiveFailures,
    nextDelayMs,
    scheduled,
  });

  const runConnect = () => {
    scheduled = false;
    state = "reconnecting";
    connect();
  };

  const scheduleReconnect = (delayMs) => {
    scheduled = true;
    state = "scheduled";
    schedule(delayMs, runConnect);
  };

  return {
    onConnect() {
      clearScheduled();
      scheduled = false;
      consecutiveFailures = 0;
      nextDelayMs = Math.max(connectRetryMs, 0);
      state = "connected";
    },
    onDisconnect(error) {
      clearScheduled();
      scheduled = false;
      consecutiveFailures += 1;

      if (consecutiveFailures >= maxConsecutiveFailuresBeforeWait) {
        state = "waiting_for_signal";
        log("wait_for_signal", {
          consecutiveFailures,
          error: String(error?.message || error || "disconnect"),
        });
        return;
      }

      const delayMs = clampDelay(nextDelayMs, connectMaxRetryMs);
      log("schedule_reconnect", {
        consecutiveFailures,
        delayMs,
        error: String(error?.message || error || "disconnect"),
      });
      scheduleReconnect(delayMs);
      nextDelayMs = clampDelay(
        Math.max(delayMs || connectRetryMs, connectRetryMs) * 2,
        connectMaxRetryMs
      );
    },
    onSignal(signal) {
      clearScheduled();
      scheduled = false;
      log("signal_reconnect", { signal });
      if (state === "connected") {
        return;
      }
      state = "reconnecting";
      connect();
    },
    snapshot,
  };
}
