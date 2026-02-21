import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockEmit } = vi.hoisted(() => ({
  mockEmit: vi.fn(() => Promise.resolve()),
}));

vi.mock("@tauri-apps/api/event", () => ({
  emit: mockEmit,
}));

import { isDesktopTauri, signalFrontendReady } from "./windowControls";

describe("windowControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  it("detects non-tauri runtime by default", () => {
    expect(isDesktopTauri()).toBe(false);
  });

  it("emits frontend ready event only in tauri runtime", async () => {
    await signalFrontendReady();
    expect(mockEmit).not.toHaveBeenCalled();

    (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    await signalFrontendReady();
    expect(mockEmit).toHaveBeenCalledWith("frontend://ready");
  });
});
