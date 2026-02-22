import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";
import { resolveVaultSwitchWithUnsavedGuard } from "./vaultSwitchGuard";

// Trace: DESIGN-storybook-vault-switch-guard-coverage-2026-02-22
type GuardHarnessProps = {
  isDirty: boolean;
  confirmChoice: boolean;
  saveShouldFail: boolean;
};

function GuardHarness({ isDirty, confirmChoice, saveShouldFail }: GuardHarnessProps) {
  const [result, setResult] = useState<string>("idle");

  const run = async () => {
    const next = await resolveVaultSwitchWithUnsavedGuard({
      isDirty,
      currentNoteTitle: "Story Note",
      confirm: () => confirmChoice,
      saveCurrentNote: async () => {
        if (saveShouldFail) {
          throw new Error("save failed");
        }
      },
      clearUnsavedState: async () => {},
    });
    setResult(next);
  };

  return (
    <div style={{ padding: "1rem", maxWidth: 520 }}>
      <h3>Vault Switch Guard</h3>
      <p>Dirty: {String(isDirty)}</p>
      <p>Confirm(save): {String(confirmChoice)}</p>
      <p>Save fails: {String(saveShouldFail)}</p>
      <button type="button" onClick={run}>
        Run guard
      </button>
      <p aria-label="Guard result">Result: {result}</p>
    </div>
  );
}

const meta = {
  title: "Flows/VaultSwitchGuard",
  component: GuardHarness,
  args: {
    isDirty: true,
    confirmChoice: true,
    saveShouldFail: false,
  },
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof GuardHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SaveAndProceed: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Specs: COMP-VAULT-SWITCH-UX-001 and COMP-VAULT-UNSAVED-001. Dirty-note guard prompts and saves successfully before proceeding.",
      },
    },
  },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Run guard" }));
    await expect(canvas.getByLabelText("Guard result")).toHaveTextContent("Result: proceed");
  },
};

export const DiscardAndProceed: Story = {
  args: {
    confirmChoice: false,
    saveShouldFail: false,
  },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Run guard" }));
    await expect(canvas.getByLabelText("Guard result")).toHaveTextContent("Result: proceed");
  },
};

export const SaveFails: Story = {
  args: {
    confirmChoice: true,
    saveShouldFail: true,
  },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Run guard" }));
    await expect(canvas.getByLabelText("Guard result")).toHaveTextContent("Result: save-failed");
  },
};
