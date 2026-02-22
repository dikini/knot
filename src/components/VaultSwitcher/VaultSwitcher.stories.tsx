import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent } from "storybook/test";
import { VaultSwitcher } from "./index";

// Trace: DESIGN-storybook-vaultswitcher-coverage-2026-02-22
const meta = {
  title: "Shell/VaultSwitcher",
  component: VaultSwitcher,
  args: {
    vault: {
      path: "/tmp/knot-demo",
      name: "Demo Vault",
      note_count: 42,
      last_modified: 1_700_000_000,
    },
    recentVaults: [
      { path: "/tmp/knot-demo", name: "Demo Vault", opened_at: 1_700_000_000 },
      { path: "/tmp/knot-work", name: "Work Vault", opened_at: 1_700_000_100 },
    ],
    onOpenVault: fn(),
    onCreateVault: fn(),
    onOpenRecent: fn(),
    onCloseVault: fn(),
  },
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof VaultSwitcher>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithCurrentVault: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Spec: COMP-VAULT-UI-001 FR-1/FR-3. Current vault selector opens menu with open/create/recent/close actions.",
      },
    },
  },
};

export const NoVaultOpen: Story = {
  args: {
    vault: null,
  },
};

export const OpenCreateAndRecentActions: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Demo Vault" }));
    await userEvent.click(canvas.getByRole("menuitem", { name: "Open Different Vault..." }));
    await expect(args.onOpenVault).toHaveBeenCalled();

    await userEvent.click(canvas.getByRole("button", { name: "Demo Vault" }));
    await userEvent.click(canvas.getByRole("menuitem", { name: "Create New Vault..." }));
    await expect(args.onCreateVault).toHaveBeenCalled();

    await userEvent.click(canvas.getByRole("button", { name: "Demo Vault" }));
    await userEvent.click(canvas.getByRole("menuitem", { name: "Work Vault" }));
    await expect(args.onOpenRecent).toHaveBeenCalledWith("/tmp/knot-work");
  },
};

export const CloseVaultAction: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Demo Vault" }));
    await userEvent.click(canvas.getByRole("menuitem", { name: "Close Vault" }));
    await expect(args.onCloseVault).toHaveBeenCalled();
  },
};

export const CloseDisabledWithoutVault: Story = {
  args: {
    vault: null,
  },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "No Vault Open" }));
    await expect(canvas.getByRole("menuitem", { name: "Close Vault" })).toBeDisabled();
  },
};
