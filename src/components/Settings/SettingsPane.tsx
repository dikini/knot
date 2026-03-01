import { useEffect, useMemo, useState } from "react";
import type { ShellDensityMode } from "@lib/store";
import type { AppKeymapSettings, VaultSettings } from "@lib/api";
import type { ManagedShortcutFieldPath } from "@lib/keymapSettings";
import "./SettingsPane.css";

export type SettingsSection =
  | "general-keymaps"
  | "editor-keymaps"
  | "appearance"
  | "layout"
  | "vault"
  | "maintenance";

interface SettingsPaneProps {
  section: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  showTextLabels: boolean;
  onShowTextLabelsChange: (show: boolean) => void;
  densityMode: ShellDensityMode;
  onDensityModeChange: (mode: ShellDensityMode) => void;
  contextPanelWidth: number;
  onContextPanelWidthChange: (width: number) => void;
  editorSurfaceMode: "sepia" | "dark";
  onEditorSurfaceModeChange: (mode: "sepia" | "dark") => void;
  vaultSettings: VaultSettings | null;
  isVaultSettingsLoading: boolean;
  onRefreshVaultSettings: () => void;
  onUpdateVaultSettings: (patch: Partial<VaultSettings>) => Promise<void>;
  onReindexVault: () => Promise<void>;
  isReindexing: boolean;
  reindexStatus: string | null;
  appKeymapSettings: AppKeymapSettings;
  appKeymapErrors: Partial<Record<ManagedShortcutFieldPath, string>>;
  isAppKeymapSettingsLoading: boolean;
  onAppKeymapChange: (field: ManagedShortcutFieldPath, value: string) => void;
  onApplyAppKeymapSettings: () => void;
  onResetAppKeymapField: (field: ManagedShortcutFieldPath) => void;
  onResetAllAppKeymaps: () => void;
}

const SECTION_LABELS: Array<{ id: SettingsSection; label: string }> = [
  { id: "general-keymaps", label: "General" },
  { id: "editor-keymaps", label: "Editor keymaps" },
  { id: "appearance", label: "Appearance" },
  { id: "layout", label: "Layout" },
  { id: "vault", label: "Vault" },
  { id: "maintenance", label: "Maintenance" },
];

export function SettingsPane({
  section,
  onSectionChange,
  showTextLabels,
  onShowTextLabelsChange,
  densityMode,
  onDensityModeChange,
  contextPanelWidth,
  onContextPanelWidthChange,
  editorSurfaceMode,
  onEditorSurfaceModeChange,
  vaultSettings,
  isVaultSettingsLoading,
  onRefreshVaultSettings,
  onUpdateVaultSettings,
  onReindexVault,
  isReindexing,
  reindexStatus,
  appKeymapSettings,
  appKeymapErrors,
  isAppKeymapSettingsLoading,
  onAppKeymapChange,
  onApplyAppKeymapSettings,
  onResetAppKeymapField,
  onResetAllAppKeymaps,
}: SettingsPaneProps) {
  const [vaultDraft, setVaultDraft] = useState({
    name: "",
    plugins_enabled: false,
    sync_enabled: false,
    sync_peers: "",
    font_size: 14,
    tab_size: 4,
  });

  useEffect(() => {
    if (!vaultSettings) return;
    setVaultDraft({
      name: vaultSettings.name,
      plugins_enabled: vaultSettings.plugins_enabled,
      sync_enabled: vaultSettings.sync.enabled,
      sync_peers: vaultSettings.sync.peers.join(", "),
      font_size: vaultSettings.editor.font_size,
      tab_size: vaultSettings.editor.tab_size,
    });
  }, [vaultSettings]);

  const panelTitle = useMemo(() => {
    const match = SECTION_LABELS.find((item) => item.id === section);
    return match ? match.label : "Settings";
  }, [section]);

  const handleApplyVaultSettings = async () => {
    const peers = vaultDraft.sync_peers
      .split(/[,\n]/)
      .map((value) => value.trim())
      .filter(Boolean);

    await onUpdateVaultSettings({
      name: vaultDraft.name,
      plugins_enabled: vaultDraft.plugins_enabled,
      sync: {
        enabled: vaultDraft.sync_enabled,
        peers,
      },
      editor: {
        font_size: Math.max(8, Math.floor(vaultDraft.font_size)),
        tab_size: Math.max(2, Math.floor(vaultDraft.tab_size)),
      },
    });
  };

  const renderKeymapField = (
    field: ManagedShortcutFieldPath,
    label: string,
    help: string,
    value: string
  ) => (
    <label className="settings-pane__field">
      <span className="settings-pane__field-meta">
        <span className="settings-pane__field-label">{label}</span>
        <span className="settings-pane__field-help">{help}</span>
      </span>
      <div className="settings-pane__keymap-control">
        <input
          aria-label={label}
          className="settings-pane__control settings-pane__control--md"
          value={value}
          onChange={(event) => onAppKeymapChange(field, event.target.value)}
          disabled={isAppKeymapSettingsLoading}
        />
        <button
          type="button"
          className="settings-pane__control settings-pane__control--sm"
          onClick={() => onResetAppKeymapField(field)}
          disabled={isAppKeymapSettingsLoading}
          aria-label={`Reset shortcut for ${label.toLowerCase()}`}
        >
          Reset
        </button>
      </div>
      {appKeymapErrors[field] ? (
        <span className="settings-pane__error" role="alert">
          {appKeymapErrors[field]}
        </span>
      ) : null}
    </label>
  );

  return (
    <div className="settings-pane" aria-label="Settings pane">
      <nav className="settings-pane__nav" aria-label="Settings sections">
        {SECTION_LABELS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`settings-pane__section ${section === item.id ? "settings-pane__section--active" : ""}`}
            onClick={() => onSectionChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <section className="settings-pane__content" aria-label={`${panelTitle} settings`}>
        <h2>{panelTitle}</h2>

        {section === "general-keymaps" && (
          <div className="settings-pane__group">
            <div className="settings-pane__inline-actions">
              <button type="button" onClick={onApplyAppKeymapSettings} disabled={isAppKeymapSettingsLoading}>
                {isAppKeymapSettingsLoading ? "Saving..." : "Apply"}
              </button>
            </div>
            {renderKeymapField(
              "general.save_note",
              "Save note shortcut",
              "Managed save shortcut for the current note editor.",
              appKeymapSettings.keymaps.general.save_note
            )}
            {renderKeymapField(
              "general.switch_notes",
              "Switch to notes shortcut",
              "Managed shortcut for the shared Notes tool route.",
              appKeymapSettings.keymaps.general.switch_notes
            )}
            {renderKeymapField(
              "general.switch_search",
              "Switch to search shortcut",
              "Managed shortcut for the shared Search tool route.",
              appKeymapSettings.keymaps.general.switch_search
            )}
            {renderKeymapField(
              "general.switch_graph",
              "Switch to graph shortcut",
              "Managed shortcut for the shared Graph tool route.",
              appKeymapSettings.keymaps.general.switch_graph
            )}
          </div>
        )}

        {section === "editor-keymaps" && (
          <div className="settings-pane__group">
            <div className="settings-pane__inline-actions">
              <button type="button" onClick={onApplyAppKeymapSettings} disabled={isAppKeymapSettingsLoading}>
                {isAppKeymapSettingsLoading ? "Saving..." : "Apply"}
              </button>
              <button type="button" onClick={onResetAllAppKeymaps} disabled={isAppKeymapSettingsLoading}>
                Reset all keymaps
              </button>
            </div>
            {renderKeymapField(
              "editor.undo",
              "Undo shortcut",
              "Managed editor undo shortcut.",
              appKeymapSettings.keymaps.editor.undo
            )}
            {renderKeymapField(
              "editor.redo",
              "Redo shortcut",
              "Managed editor redo shortcut. Multiple chords can be separated by commas.",
              appKeymapSettings.keymaps.editor.redo
            )}
            {renderKeymapField(
              "editor.clear_paragraph",
              "Clear paragraph shortcut",
              "Managed shortcut for clearing the current block back to a paragraph.",
              appKeymapSettings.keymaps.editor.clear_paragraph
            )}
          </div>
        )}

        {section === "appearance" && (
          <div className="settings-pane__group">
            <label className="settings-pane__field">
              <span className="settings-pane__field-meta">
                <span className="settings-pane__field-label">Editor surface</span>
                <span className="settings-pane__field-help">
                  Pick the reading tone for the editor canvas.
                </span>
              </span>
              <select
                aria-label="Editor surface"
                className="settings-pane__control settings-pane__control--sm"
                value={editorSurfaceMode}
                onChange={(event) => onEditorSurfaceModeChange(event.target.value as "sepia" | "dark")}
              >
                <option value="sepia">Sepia</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <label className="settings-pane__field settings-pane__field--checkbox">
              <span className="settings-pane__field-meta">
                <span className="settings-pane__field-label">Show text labels</span>
                <span className="settings-pane__field-help">
                  Display button labels in rails and chrome, not icons only.
                </span>
              </span>
              <span className="settings-pane__switch-wrap">
                <input
                  type="checkbox"
                  aria-label="Show text labels"
                  className="settings-pane__switch-input"
                  checked={showTextLabels}
                  onChange={(event) => onShowTextLabelsChange(event.target.checked)}
                />
                <span className="settings-pane__switch-track" aria-hidden="true" />
                <span className="settings-pane__switch-text">{showTextLabels ? "On" : "Off"}</span>
              </span>
            </label>
          </div>
        )}

        {section === "layout" && (
          <div className="settings-pane__group">
            <label className="settings-pane__field">
              <span className="settings-pane__field-meta">
                <span className="settings-pane__field-label">Density mode</span>
                <span className="settings-pane__field-help">
                  Controls spacing and compactness of the app shell.
                </span>
              </span>
              <select
                aria-label="Density mode"
                className="settings-pane__control settings-pane__control--sm"
                value={densityMode}
                onChange={(event) => onDensityModeChange(event.target.value as ShellDensityMode)}
              >
                <option value="comfortable">Comfortable</option>
                <option value="adaptive">Adaptive</option>
              </select>
            </label>
            <label className="settings-pane__field">
              <span className="settings-pane__field-meta">
                <span className="settings-pane__field-label">Context panel width</span>
                <span className="settings-pane__field-help">
                  Width in pixels for notes/search/graph side context content.
                </span>
              </span>
              <input
                type="number"
                min={240}
                max={640}
                step={1}
                aria-label="Context panel width"
                className="settings-pane__control settings-pane__control--sm"
                value={contextPanelWidth}
                onChange={(event) => onContextPanelWidthChange(Number(event.target.value))}
              />
            </label>
          </div>
        )}

        {section === "vault" && (
          <div className="settings-pane__group settings-pane__group--vault">
            <div className="settings-pane__inline-actions">
              <button type="button" onClick={onRefreshVaultSettings} disabled={isVaultSettingsLoading}>
                {isVaultSettingsLoading ? "Loading..." : "Reload"}
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleApplyVaultSettings();
                }}
                disabled={isVaultSettingsLoading}
              >
                Apply
              </button>
            </div>
            <label className="settings-pane__field">
              <span className="settings-pane__field-meta">
                <span className="settings-pane__field-label">Vault name</span>
                <span className="settings-pane__field-help">
                  Human-friendly label used in vault switching and headers.
                </span>
              </span>
              <input
                aria-label="Vault name"
                className="settings-pane__control settings-pane__control--md"
                placeholder="Vault display name"
                value={vaultDraft.name}
                onChange={(event) => setVaultDraft((state) => ({ ...state, name: event.target.value }))}
              />
            </label>
            <label className="settings-pane__field settings-pane__field--checkbox">
              <span className="settings-pane__field-meta">
                <span className="settings-pane__field-label">Plugins enabled</span>
                <span className="settings-pane__field-help">
                  Enable runtime plugin loading for this vault.
                </span>
              </span>
              <span className="settings-pane__switch-wrap">
                <input
                  type="checkbox"
                  aria-label="Plugins enabled"
                  className="settings-pane__switch-input"
                  checked={vaultDraft.plugins_enabled}
                  onChange={(event) =>
                    setVaultDraft((state) => ({
                      ...state,
                      plugins_enabled: event.target.checked,
                    }))
                  }
                />
                <span className="settings-pane__switch-track" aria-hidden="true" />
                <span className="settings-pane__switch-text">{vaultDraft.plugins_enabled ? "On" : "Off"}</span>
              </span>
            </label>
            <label className="settings-pane__field settings-pane__field--checkbox">
              <span className="settings-pane__field-meta">
                <span className="settings-pane__field-label">Sync enabled</span>
                <span className="settings-pane__field-help">
                  Toggle peer-to-peer vault sync behavior.
                </span>
              </span>
              <span className="settings-pane__switch-wrap">
                <input
                  type="checkbox"
                  aria-label="Sync enabled"
                  className="settings-pane__switch-input"
                  checked={vaultDraft.sync_enabled}
                  onChange={(event) =>
                    setVaultDraft((state) => ({
                      ...state,
                      sync_enabled: event.target.checked,
                    }))
                  }
                />
                <span className="settings-pane__switch-track" aria-hidden="true" />
                <span className="settings-pane__switch-text">{vaultDraft.sync_enabled ? "On" : "Off"}</span>
              </span>
            </label>
            <label className="settings-pane__field">
              <span className="settings-pane__field-meta">
                <span className="settings-pane__field-label">Sync peers</span>
                <span className="settings-pane__field-help">
                  Comma-separated peer IDs or addresses allowed to sync.
                </span>
              </span>
              <textarea
                aria-label="Sync peers"
                className="settings-pane__control settings-pane__control--lg"
                value={vaultDraft.sync_peers}
                onChange={(event) => setVaultDraft((state) => ({ ...state, sync_peers: event.target.value }))}
              />
            </label>
            <label className="settings-pane__field">
              <span className="settings-pane__field-meta">
                <span className="settings-pane__field-label">Font size</span>
                <span className="settings-pane__field-help">
                  Editor default text size in pixels.
                </span>
              </span>
              <input
                type="number"
                min={8}
                max={42}
                aria-label="Font size"
                className="settings-pane__control settings-pane__control--sm"
                value={vaultDraft.font_size}
                onChange={(event) =>
                  setVaultDraft((state) => ({ ...state, font_size: Number(event.target.value) }))
                }
              />
            </label>
            <label className="settings-pane__field">
              <span className="settings-pane__field-meta">
                <span className="settings-pane__field-label">Tab size</span>
                <span className="settings-pane__field-help">
                  Number of spaces represented by tab indentation.
                </span>
              </span>
              <input
                type="number"
                min={2}
                max={12}
                aria-label="Tab size"
                className="settings-pane__control settings-pane__control--sm"
                value={vaultDraft.tab_size}
                onChange={(event) =>
                  setVaultDraft((state) => ({ ...state, tab_size: Number(event.target.value) }))
                }
              />
            </label>
          </div>
        )}

        {section === "maintenance" && (
          <div className="settings-pane__group">
            <div className="settings-pane__field-meta">
              <span className="settings-pane__field-label">Reindex vault</span>
              <span className="settings-pane__field-help">
                Runs a full filesystem-to-metadata rebuild for notes, links, and search.
              </span>
            </div>
            <button
              type="button"
              aria-label="Reindex vault"
              className="settings-pane__control settings-pane__control--md"
              onClick={() => {
                void onReindexVault();
              }}
              disabled={isReindexing}
            >
              {isReindexing ? "Reindexing..." : "Reindex vault"}
            </button>
            {reindexStatus && <p className="settings-pane__status">{reindexStatus}</p>}
          </div>
        )}
      </section>
    </div>
  );
}
