import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { VaultSwitcher } from "./index";

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

export const WithCurrentVault: Story = {};

export const NoVaultOpen: Story = {
  args: {
    vault: null,
  },
};

