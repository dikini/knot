import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AppKeymapSettings } from "@lib/api";
import { DEFAULT_APP_KEYMAP_SETTINGS } from "@lib/keymapSettings";
import { SettingsPane } from "./SettingsPane";

function createKeymapSettings(
  overrides?: Partial<AppKeymapSettings>
): AppKeymapSettings {
  return {
    ...DEFAULT_APP_KEYMAP_SETTINGS,
    ...overrides,
    keymaps: {
      ...DEFAULT_APP_KEYMAP_SETTINGS.keymaps,
      ...overrides?.keymaps,
      general: {
        ...DEFAULT_APP_KEYMAP_SETTINGS.keymaps.general,
        ...overrides?.keymaps?.general,
      },
      editor: {
        ...DEFAULT_APP_KEYMAP_SETTINGS.keymaps.editor,
        ...overrides?.keymaps?.editor,
      },
    },
  };
}

const defaultUiAutomationSettings = {
  enabled: false,
  groups: {
    navigation: false,
    screenshots: false,
    behaviors: false,
  },
};

describe("SettingsPane keymap settings", () => {
  it("renders the Layout section with graph readability floor control", () => {
    render(
      <SettingsPane
        section="layout"
        onSectionChange={vi.fn()}
        showTextLabels={false}
        onShowTextLabelsChange={vi.fn()}
        densityMode="comfortable"
        onDensityModeChange={vi.fn()}
        contextPanelWidth={320}
        onContextPanelWidthChange={vi.fn()}
        editorSurfaceMode="sepia"
        onEditorSurfaceModeChange={vi.fn()}
        graphReadabilityFloorPercent={70}
        onGraphReadabilityFloorPercentChange={vi.fn()}
        onApplyAppKeymapSettings={vi.fn()}
        vaultSettings={null}
        vaultPlugins={[]}
        isVaultPluginsLoading={false}
        isVaultSettingsLoading={false}
        onRefreshVaultSettings={vi.fn()}
        onRefreshVaultPlugins={vi.fn()}
        onUpdateVaultSettings={vi.fn()}
        onReindexVault={vi.fn()}
        isReindexing={false}
        reindexStatus={null}
        appKeymapSettings={createKeymapSettings()}
        appKeymapErrors={{}}
        isAppKeymapSettingsLoading={false}
        onAppKeymapChange={vi.fn()}
        onResetAppKeymapField={vi.fn()}
        onResetAllAppKeymaps={vi.fn()}
        uiAutomationSettings={defaultUiAutomationSettings}
        isUiAutomationSettingsLoading={false}
        onUpdateUiAutomationSettings={vi.fn()}
      />
    );

    expect(screen.getByLabelText("Graph readability floor")).toHaveValue(70);
    expect(screen.getByRole("button", { name: "Apply graph fit" })).toBeInTheDocument();
  });

  it("updates the graph readability floor through the dedicated layout control", () => {
    const onGraphReadabilityFloorPercentChange = vi.fn();
    const onApplyAppKeymapSettings = vi.fn();

    render(
      <SettingsPane
        section="layout"
        onSectionChange={vi.fn()}
        showTextLabels={false}
        onShowTextLabelsChange={vi.fn()}
        densityMode="comfortable"
        onDensityModeChange={vi.fn()}
        contextPanelWidth={320}
        onContextPanelWidthChange={vi.fn()}
        editorSurfaceMode="sepia"
        onEditorSurfaceModeChange={vi.fn()}
        graphReadabilityFloorPercent={70}
        onGraphReadabilityFloorPercentChange={onGraphReadabilityFloorPercentChange}
        onApplyAppKeymapSettings={onApplyAppKeymapSettings}
        vaultSettings={null}
        vaultPlugins={[]}
        isVaultPluginsLoading={false}
        isVaultSettingsLoading={false}
        onRefreshVaultSettings={vi.fn()}
        onRefreshVaultPlugins={vi.fn()}
        onUpdateVaultSettings={vi.fn()}
        onReindexVault={vi.fn()}
        isReindexing={false}
        reindexStatus={null}
        appKeymapSettings={createKeymapSettings()}
        appKeymapErrors={{}}
        isAppKeymapSettingsLoading={false}
        onAppKeymapChange={vi.fn()}
        onResetAppKeymapField={vi.fn()}
        onResetAllAppKeymaps={vi.fn()}
        uiAutomationSettings={defaultUiAutomationSettings}
        isUiAutomationSettingsLoading={false}
        onUpdateUiAutomationSettings={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText("Graph readability floor"), {
      target: { value: "85" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply graph fit" }));

    expect(onGraphReadabilityFloorPercentChange).toHaveBeenCalledWith(85);
    expect(onApplyAppKeymapSettings).toHaveBeenCalled();
  });

  it("renders the General keymaps section with save note field and reset action", () => {
    render(
      <SettingsPane
        section="general-keymaps"
        onSectionChange={vi.fn()}
        showTextLabels={false}
        onShowTextLabelsChange={vi.fn()}
        densityMode="comfortable"
        onDensityModeChange={vi.fn()}
        contextPanelWidth={320}
        onContextPanelWidthChange={vi.fn()}
        editorSurfaceMode="sepia"
        onEditorSurfaceModeChange={vi.fn()}
        graphReadabilityFloorPercent={70}
        onGraphReadabilityFloorPercentChange={vi.fn()}
        vaultSettings={null}
        vaultPlugins={[]}
        isVaultPluginsLoading={false}
        isVaultSettingsLoading={false}
        onRefreshVaultSettings={vi.fn()}
        onRefreshVaultPlugins={vi.fn()}
        onUpdateVaultSettings={vi.fn()}
        onReindexVault={vi.fn()}
        isReindexing={false}
        reindexStatus={null}
        appKeymapSettings={createKeymapSettings()}
        appKeymapErrors={{}}
        isAppKeymapSettingsLoading={false}
        onAppKeymapChange={vi.fn()}
        onApplyAppKeymapSettings={vi.fn()}
        onResetAppKeymapField={vi.fn()}
        onResetAllAppKeymaps={vi.fn()}
        uiAutomationSettings={defaultUiAutomationSettings}
        isUiAutomationSettingsLoading={false}
        onUpdateUiAutomationSettings={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "General" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Mod-s")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Mod-1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Mod-2")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Mod-3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reset shortcut for save note shortcut/i })).toBeInTheDocument();
  });

  it("renders the Editor keymaps section with undo and redo fields", () => {
    render(
      <SettingsPane
        section="editor-keymaps"
        onSectionChange={vi.fn()}
        showTextLabels={false}
        onShowTextLabelsChange={vi.fn()}
        densityMode="comfortable"
        onDensityModeChange={vi.fn()}
        contextPanelWidth={320}
        onContextPanelWidthChange={vi.fn()}
        editorSurfaceMode="sepia"
        onEditorSurfaceModeChange={vi.fn()}
        graphReadabilityFloorPercent={70}
        onGraphReadabilityFloorPercentChange={vi.fn()}
        vaultSettings={null}
        vaultPlugins={[]}
        isVaultPluginsLoading={false}
        isVaultSettingsLoading={false}
        onRefreshVaultSettings={vi.fn()}
        onRefreshVaultPlugins={vi.fn()}
        onUpdateVaultSettings={vi.fn()}
        onReindexVault={vi.fn()}
        isReindexing={false}
        reindexStatus={null}
        appKeymapSettings={createKeymapSettings()}
        appKeymapErrors={{}}
        isAppKeymapSettingsLoading={false}
        onAppKeymapChange={vi.fn()}
        onApplyAppKeymapSettings={vi.fn()}
        onResetAppKeymapField={vi.fn()}
        onResetAllAppKeymaps={vi.fn()}
        uiAutomationSettings={defaultUiAutomationSettings}
        isUiAutomationSettingsLoading={false}
        onUpdateUiAutomationSettings={vi.fn()}
      />
    );

    expect(screen.getByDisplayValue("Mod-z")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Mod-Shift-z, Mod-y")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Mod-Alt-0")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reset all keymaps/i })).toBeInTheDocument();
  });

  it("surfaces validation errors next to the affected managed shortcut", () => {
    render(
      <SettingsPane
        section="editor-keymaps"
        onSectionChange={vi.fn()}
        showTextLabels={false}
        onShowTextLabelsChange={vi.fn()}
        densityMode="comfortable"
        onDensityModeChange={vi.fn()}
        contextPanelWidth={320}
        onContextPanelWidthChange={vi.fn()}
        editorSurfaceMode="sepia"
        onEditorSurfaceModeChange={vi.fn()}
        graphReadabilityFloorPercent={70}
        onGraphReadabilityFloorPercentChange={vi.fn()}
        vaultSettings={null}
        vaultPlugins={[]}
        isVaultPluginsLoading={false}
        isVaultSettingsLoading={false}
        onRefreshVaultSettings={vi.fn()}
        onRefreshVaultPlugins={vi.fn()}
        onUpdateVaultSettings={vi.fn()}
        onReindexVault={vi.fn()}
        isReindexing={false}
        reindexStatus={null}
        appKeymapSettings={createKeymapSettings()}
        appKeymapErrors={{ "editor.undo": "Duplicate shortcut" }}
        isAppKeymapSettingsLoading={false}
        onAppKeymapChange={vi.fn()}
        onApplyAppKeymapSettings={vi.fn()}
        onResetAppKeymapField={vi.fn()}
        onResetAllAppKeymaps={vi.fn()}
        uiAutomationSettings={defaultUiAutomationSettings}
        isUiAutomationSettingsLoading={false}
        onUpdateUiAutomationSettings={vi.fn()}
      />
    );

    expect(screen.getByText("Duplicate shortcut")).toBeInTheDocument();
  });

  it("updates the managed shortcut field and can trigger a targeted reset", () => {
    const onAppKeymapChange = vi.fn();
    const onResetAppKeymapField = vi.fn();

    render(
      <SettingsPane
        section="general-keymaps"
        onSectionChange={vi.fn()}
        showTextLabels={false}
        onShowTextLabelsChange={vi.fn()}
        densityMode="comfortable"
        onDensityModeChange={vi.fn()}
        contextPanelWidth={320}
        onContextPanelWidthChange={vi.fn()}
        editorSurfaceMode="sepia"
        onEditorSurfaceModeChange={vi.fn()}
        graphReadabilityFloorPercent={70}
        onGraphReadabilityFloorPercentChange={vi.fn()}
        vaultSettings={null}
        vaultPlugins={[]}
        isVaultPluginsLoading={false}
        isVaultSettingsLoading={false}
        onRefreshVaultSettings={vi.fn()}
        onRefreshVaultPlugins={vi.fn()}
        onUpdateVaultSettings={vi.fn()}
        onReindexVault={vi.fn()}
        isReindexing={false}
        reindexStatus={null}
        appKeymapSettings={createKeymapSettings()}
        appKeymapErrors={{}}
        isAppKeymapSettingsLoading={false}
        onAppKeymapChange={onAppKeymapChange}
        onApplyAppKeymapSettings={vi.fn()}
        onResetAppKeymapField={onResetAppKeymapField}
        onResetAllAppKeymaps={vi.fn()}
        uiAutomationSettings={defaultUiAutomationSettings}
        isUiAutomationSettingsLoading={false}
        onUpdateUiAutomationSettings={vi.fn()}
      />
    );

    fireEvent.change(screen.getByDisplayValue("Mod-s"), {
      target: { value: "Alt-s" },
    });
    fireEvent.click(screen.getByRole("button", { name: /reset shortcut for save note shortcut/i }));

    expect(onAppKeymapChange).toHaveBeenCalledWith("general.save_note", "Alt-s");
    expect(onResetAppKeymapField).toHaveBeenCalledWith("general.save_note");
  });

  it("renders the plugins section and applies per-plugin overrides", () => {
    const onUpdateVaultSettings = vi.fn();

    render(
      <SettingsPane
        section="plugins"
        onSectionChange={vi.fn()}
        showTextLabels={false}
        onShowTextLabelsChange={vi.fn()}
        densityMode="comfortable"
        onDensityModeChange={vi.fn()}
        contextPanelWidth={320}
        onContextPanelWidthChange={vi.fn()}
        editorSurfaceMode="sepia"
        onEditorSurfaceModeChange={vi.fn()}
        graphReadabilityFloorPercent={70}
        onGraphReadabilityFloorPercentChange={vi.fn()}
        vaultSettings={{
          name: "vault",
          plugins_enabled: false,
          plugin_overrides: { "example-plugin": false },
          file_visibility: "all_files",
          sync: { enabled: false, peers: [] },
          editor: { font_size: 14, tab_size: 4 },
        }}
        vaultPlugins={[
          {
            name: "example-plugin",
            display_name: "Example Plugin",
            version: "1.0.0",
            description: "Example vault plugin",
            author: "Knot",
            api_version: "1.0",
            enabled: false,
            effective_enabled: false,
          },
        ]}
        isVaultPluginsLoading={false}
        isVaultSettingsLoading={false}
        onRefreshVaultSettings={vi.fn()}
        onRefreshVaultPlugins={vi.fn()}
        onUpdateVaultSettings={onUpdateVaultSettings}
        onReindexVault={vi.fn()}
        isReindexing={false}
        reindexStatus={null}
        appKeymapSettings={createKeymapSettings()}
        appKeymapErrors={{}}
        isAppKeymapSettingsLoading={false}
        onAppKeymapChange={vi.fn()}
        onApplyAppKeymapSettings={vi.fn()}
        onResetAppKeymapField={vi.fn()}
        onResetAllAppKeymaps={vi.fn()}
        uiAutomationSettings={defaultUiAutomationSettings}
        isUiAutomationSettingsLoading={false}
        onUpdateUiAutomationSettings={vi.fn()}
      />
    );

    fireEvent.click(screen.getByLabelText("Plugins enabled"));
    fireEvent.click(screen.getByLabelText("Example Plugin enabled"));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(onUpdateVaultSettings).toHaveBeenCalledWith({
      plugins_enabled: true,
      plugin_overrides: { "example-plugin": true },
    });
  });
});
