import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, mocked, userEvent } from "storybook/test";
import { emit } from "@tauri-apps/api/event";
import { isDesktopTauri, signalFrontendReady } from "./windowControls";

// Trace: DESIGN-storybook-window-startup-coverage-2026-02-22
function WindowControlsHarness() {
  return (
    <div style={{ padding: "1rem", display: "grid", gap: "0.75rem", maxWidth: 640 }}>
      <h3>Window Startup Controls</h3>
      <button
        type="button"
        onClick={async () => {
          await signalFrontendReady();
        }}
      >
        Signal frontend ready
      </button>
    </div>
  );
}

const meta = {
  title: "Infra/WindowStartupControls",
  component: WindowControlsHarness,
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof WindowControlsHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BrowserNoop: Story = {
  play: async ({ canvas }) => {
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    await userEvent.click(canvas.getByRole("button", { name: "Signal frontend ready" }));
    await expect(isDesktopTauri()).toBe(false);
    await expect(mocked(emit)).not.toHaveBeenCalled();
  },
};

export const TauriEventEmit: Story = {
  play: async ({ canvas }) => {
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    await userEvent.click(canvas.getByRole("button", { name: "Signal frontend ready" }));
    await expect(isDesktopTauri()).toBe(true);
    await expect(mocked(emit)).toHaveBeenCalledWith("frontend://ready");
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  },
};
