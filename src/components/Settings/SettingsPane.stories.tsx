import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent } from "storybook/test";
import { DEFAULT_APP_KEYMAP_SETTINGS } from "@lib/keymapSettings";
import { SettingsPane } from "./SettingsPane";

const meta = {
  title: "Settings/SettingsPane",
  component: SettingsPane,
  args: {
    section: "maintenance",
    onSectionChange: fn(),
    showTextLabels: false,
    onShowTextLabelsChange: fn(),
    densityMode: "comfortable",
    onDensityModeChange: fn(),
    contextPanelWidth: 320,
    onContextPanelWidthChange: fn(),
    editorSurfaceMode: "sepia",
    onEditorSurfaceModeChange: fn(),
    graphReadabilityFloorPercent: 70,
    onGraphReadabilityFloorPercentChange: fn(),
    vaultSettings: {
      name: "Canonical",
      plugins_enabled: false,
      file_visibility: "all_files",
      sync: { enabled: false, peers: [] },
      editor: { font_size: 14, tab_size: 4 },
    },
    isVaultSettingsLoading: false,
    onRefreshVaultSettings: fn(),
    onUpdateVaultSettings: fn(async () => {}),
    onReindexVault: fn(async () => {}),
    isReindexing: false,
    reindexStatus: null,
    appKeymapSettings: DEFAULT_APP_KEYMAP_SETTINGS,
    appKeymapErrors: {},
    isAppKeymapSettingsLoading: false,
    onAppKeymapChange: fn(),
    onApplyAppKeymapSettings: fn(),
    onResetAppKeymapField: fn(),
    onResetAllAppKeymaps: fn(),
  },
} satisfies Meta<typeof SettingsPane>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Maintenance: Story = {
  args: {
    section: "maintenance",
  },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Reindex vault" }));
    await expect(args.onReindexVault).toHaveBeenCalled();
  },
};

export const Vault: Story = {
  args: {
    section: "vault",
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText("Vault name")).toBeInTheDocument();
    await expect(canvas.getByLabelText("Sync peers")).toBeInTheDocument();
  },
};
