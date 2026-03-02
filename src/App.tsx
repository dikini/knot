import { useEffect, useRef, useState } from "react";
import { Editor } from "@components/Editor";
import { GraphContextPanel } from "@components/GraphView/GraphContextPanel";
import { GraphView } from "@components/GraphView";
import { IconButton } from "@components/IconButton";
import { ContextPanel } from "@components/Shell/ContextPanel";
import { InspectorRail } from "@components/Shell/InspectorRail";
import { ToolRail } from "@components/Shell/ToolRail";
import { SearchBox } from "@components/SearchBox";
import { Sidebar } from "@components/Sidebar";
import { SettingsPane, type SettingsSection } from "@components/Settings/SettingsPane";
import { ToastContainer } from "@components/Toast";
import { useToast } from "@hooks/useToast";
import { useVaultStore } from "@lib/store";
import { useEditorStore } from "@lib/store";
import type { ShellToolMode } from "@lib/store";
import { getEditorMeasureBand } from "@lib/editorMeasure";
import {
  DEFAULT_APP_KEYMAP_SETTINGS,
  matchesShortcutEvent,
  resetManagedShortcutField,
  setManagedShortcutValue,
  validateAppKeymapSettings,
  type ManagedShortcutFieldPath,
} from "@lib/keymapSettings";
import { resolveVaultSwitchWithUnsavedGuard } from "@lib/vaultSwitchGuard";
import * as api from "@lib/api";
import type { RecentVault } from "@lib/api";
import {
  buildUiAutomationRegistry,
  buildUiAutomationState,
  type UiAutomationFrontendRequest,
  type UiAutomationViewFrame,
} from "@lib/uiAutomation";
import { listen } from "@tauri-apps/api/event";
import { CaseSensitive, CircleEllipsis, Network, SquarePen } from "lucide-react";
import "./styles/App.css";

// SPEC: COMP-UI-LAYOUT-002 FR-5, FR-6
// SPEC: COMP-FRONTEND-001 FR-1, FR-2
// SPEC: COMP-GRAPH-UI-001 FR-4
// SPEC: COMP-LAYOUT-RECOVERY-001 FR-1, FR-2
// SPEC: COMP-ICON-CHROME-001 FR-3, FR-4
// SPEC: COMP-TOOL-RAIL-CONTEXT-001 FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7, FR-8
// SPEC: COMP-GRAPH-MODES-002 FR-1, FR-2, FR-4
type ToolPanelPolicy = "panel-required" | "panel-optional" | "panel-independent";
const TOOL_PANEL_POLICY: Record<ShellToolMode, ToolPanelPolicy> = {
  notes: "panel-required",
  search: "panel-required",
  graph: "panel-optional",
};
const STARTUP_VAULT_ATTACH_MAX_ATTEMPTS = 20;
const STARTUP_VAULT_ATTACH_RETRY_MS = 500;

function collectUiAutomationViewFrames(): Record<string, UiAutomationViewFrame> {
  if (typeof document === "undefined") {
    return {};
  }

  const entries = Array.from(document.querySelectorAll<HTMLElement>("[data-ui-automation-view-id]"))
    .map((element) => {
      const id = element.dataset.uiAutomationViewId;
      if (!id) {
        return null;
      }
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return null;
      }
      return [
        id,
        {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
        },
      ] as const;
    })
    .filter((entry): entry is readonly [string, UiAutomationViewFrame] => entry !== null);

  return Object.fromEntries(entries);
}

function App() {
  const [recentVaults, setRecentVaults] = useState<RecentVault[]>([]);
  const [viewMode, setViewMode] = useState<"editor" | "graph" | "settings">("editor");
  const [graphScope, setGraphScope] = useState<"vault" | "node">("vault");
  const [nodeGraphDepth, setNodeGraphDepth] = useState(1);
  const [graphSelection, setGraphSelection] = useState<{
    path: string | null;
    title: string | null;
    neighbors: string[];
    backlinks: string[];
  }>({
    path: null,
    title: null,
    neighbors: [],
    backlinks: [],
  });
  const [editorSurfaceMode, setEditorSurfaceMode] = useState<"sepia" | "dark">("sepia");
  const [inspectorMode, setInspectorMode] = useState<"details" | "settings">("details");
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("maintenance");
  const [vaultSettings, setVaultSettings] = useState<api.VaultSettings | null>(null);
  const [isVaultSettingsLoading, setIsVaultSettingsLoading] = useState(false);
  const [appKeymapSettings, setAppKeymapSettings] = useState<api.AppKeymapSettings>(DEFAULT_APP_KEYMAP_SETTINGS);
  const [appKeymapDraft, setAppKeymapDraft] = useState<api.AppKeymapSettings>(DEFAULT_APP_KEYMAP_SETTINGS);
  const [appKeymapErrors, setAppKeymapErrors] = useState<Partial<Record<ManagedShortcutFieldPath, string>>>({});
  const [isAppKeymapSettingsLoading, setIsAppKeymapSettingsLoading] = useState(false);
  const [uiAutomationSettings, setUiAutomationSettings] = useState<api.UiAutomationSettings>({
    enabled: false,
    groups: {
      navigation: false,
      screenshots: false,
      behaviors: false,
    },
  });
  const [isUiAutomationSettingsLoading, setIsUiAutomationSettingsLoading] = useState(false);
  const [isReindexing, setIsReindexing] = useState(false);
  const [reindexStatus, setReindexStatus] = useState<string | null>(null);
  const [editorMeasureBand, setEditorMeasureBand] = useState<45 | 54 | 62 | 70>(54);
  // SPEC: COMP-COMPLIANCE-001 FR-1, FR-2
  const [hydratedViewModeVaultPath, setHydratedViewModeVaultPath] = useState<string | null>(null);
  const [hydratedShellVaultPath, setHydratedShellVaultPath] = useState<string | null>(null);
  const [graphSize, setGraphSize] = useState({ width: 900, height: 600 });
  const [optionalPanelVisibilityByTool, setOptionalPanelVisibilityByTool] = useState<
    Partial<Record<ShellToolMode, boolean>>
  >({
    graph: true,
  });
  const contentAreaRef = useRef<HTMLDivElement>(null);
  const {
    vault,
    noteList,
    currentNote,
    isLoading,
    shell,
    setVault,
    closeVault,
    loadNotes,
    loadNote,
    setShellToolMode,
    toggleToolRail,
    toggleContextPanel,
    setDensityMode,
    setContextPanelWidth,
    setInspectorRailOpen,
    setShowTextLabels,
  } = useVaultStore();
  const { toasts, removeToast, success, error } = useToast();

  useEffect(() => {
    const { actions, views } = buildUiAutomationRegistry();
    void api.syncUiAutomationRegistry(actions, views).catch(console.error);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const syncSnapshot = () => {
      if (cancelled) {
        return;
      }
      const snapshot = buildUiAutomationState({
        viewMode,
        currentNotePath: currentNote?.path ?? null,
        toolMode: shell.toolMode,
        inspectorOpen: shell.isInspectorRailOpen,
        vaultOpen: Boolean(vault),
        viewFrames: collectUiAutomationViewFrames(),
      });
      void api.syncUiAutomationState(snapshot).catch(console.error);
    };

    const frameId = window.requestAnimationFrame(syncSnapshot);
    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => syncSnapshot()) : undefined;

    for (const element of document.querySelectorAll<HTMLElement>("[data-ui-automation-view-id]")) {
      resizeObserver?.observe(element);
    }

    window.addEventListener("resize", syncSnapshot);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", syncSnapshot);
    };
  }, [currentNote?.path, shell.isInspectorRailOpen, shell.toolMode, vault, viewMode]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const completeWithError = async (requestId: string, message: string, errorCode: string) => {
      await api.completeUiAutomationRequest(requestId, {
        success: false,
        message,
        error_code: errorCode,
      });
    };

    void (async () => {
      unlisten = await listen<UiAutomationFrontendRequest>("ui-automation://request", async (event) => {
        const request = event.payload;

        if (request.kind === "invoke_action") {
          try {
            if (request.action_id === "core.navigate.view") {
              const nextView = request.args?.view;
              if (nextView !== "editor" && nextView !== "graph" && nextView !== "settings") {
                await completeWithError(
                  request.request_id,
                  "Invalid view target",
                  "UI_ACTION_INVALID_ARGUMENTS"
                );
                return;
              }
              setViewMode(nextView);
              await api.completeUiAutomationRequest(request.request_id, {
                success: true,
                message: `Switched to ${nextView}`,
                payload: { active_view: `view.${nextView}` },
              });
              return;
            }

            if (request.action_id === "core.navigate.note") {
              const notePath = request.args?.path;
              if (typeof notePath !== "string" || notePath.trim().length === 0) {
                await completeWithError(
                  request.request_id,
                  "Missing note path",
                  "UI_ACTION_INVALID_ARGUMENTS"
                );
                return;
              }
              await loadNote(notePath);
              setViewMode("editor");
              await api.completeUiAutomationRequest(request.request_id, {
                success: true,
                message: `Loaded note ${notePath}`,
                payload: { active_view: "view.editor", active_note_path: notePath },
              });
              return;
            }

            if (request.action_id === "core.select.tool-mode") {
              const toolMode = request.args?.toolMode;
              if (toolMode !== "notes" && toolMode !== "search" && toolMode !== "graph") {
                await completeWithError(
                  request.request_id,
                  "Invalid tool mode",
                  "UI_ACTION_INVALID_ARGUMENTS"
                );
                return;
              }
              handleToolModeSelect(toolMode);
              await api.completeUiAutomationRequest(request.request_id, {
                success: true,
                message: `Switched tool mode to ${toolMode}`,
                payload: { tool_mode: toolMode },
              });
              return;
            }

            await completeWithError(
              request.request_id,
              `Unknown action: ${request.action_id}`,
              "UI_TARGET_NOT_FOUND"
            );
          } catch (invokeError) {
            await completeWithError(
              request.request_id,
              invokeError instanceof Error ? invokeError.message : "Failed to invoke UI action",
              "UI_ACTION_EXECUTION_FAILED"
            );
          }
          return;
        }

        await completeWithError(
          request.request_id,
          "Frontend-driven screenshot capture is disabled in this runtime",
          "UI_CAPTURE_UNSUPPORTED"
        );
      });
    })();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [handleToolModeSelect, loadNote]);

  const resolveUnsavedBeforeVaultSwitch = async (): Promise<boolean> => {
    const editorState = useEditorStore.getState();
    if (!currentNote || !editorState.isDirty) {
      return true;
    }

    const result = await resolveVaultSwitchWithUnsavedGuard({
      isDirty: editorState.isDirty,
      currentNoteTitle: currentNote.title,
      confirm: (message) => window.confirm(message),
      saveCurrentNote: async () => {
        await api.saveNote(currentNote.path, editorState.content);
      },
      clearUnsavedState: async () => {
        useEditorStore.getState().markDirty(false);
        await api.setUnsavedChanges(false);
      },
    });

    if (result === "save-failed") {
      error("Failed to save note. Vault switch cancelled.");
      return false;
    }

    return true;
  };

  // Load recent vaults and check for existing vault on mount
  useEffect(() => {
    let cancelled = false;

    // Load recent vaults
    api.getRecentVaults().then(setRecentVaults).catch(console.error);

    const tryAttachOpenVault = async (attempt: number) => {
      try {
        const isOpen = await api.isVaultOpen();
        if (cancelled) return;

        if (isOpen) {
          const info = await api.getVaultInfo();
          if (cancelled) return;
          if (info) {
            setVault(info);
            await loadNotes();
            return;
          }
        }
      } catch (err) {
        if (attempt >= STARTUP_VAULT_ATTACH_MAX_ATTEMPTS) {
          console.error("startup vault attach failed", err);
          return;
        }
      }

      if (attempt >= STARTUP_VAULT_ATTACH_MAX_ATTEMPTS || cancelled) {
        return;
      }

      window.setTimeout(() => {
        void tryAttachOpenVault(attempt + 1);
      }, STARTUP_VAULT_ATTACH_RETRY_MS);
    };

    void tryAttachOpenVault(1);

    return () => {
      cancelled = true;
    };
  }, [setVault, loadNotes]);

  useEffect(() => {
    const loadAppKeymaps = async () => {
      setIsAppKeymapSettingsLoading(true);
      try {
        const nextSettings = await api.getAppKeymapSettings();
        setAppKeymapSettings(nextSettings);
        setAppKeymapDraft(nextSettings);
        setAppKeymapErrors({});
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to load app keymap settings");
      } finally {
        setIsAppKeymapSettingsLoading(false);
      }
    };

    void loadAppKeymaps();
  }, [error]);

  useEffect(() => {
    const loadUiAutomationSettings = async () => {
      setIsUiAutomationSettingsLoading(true);
      try {
        const nextSettings = await api.getUiAutomationSettings();
        setUiAutomationSettings(nextSettings);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to load UI automation settings");
      } finally {
        setIsUiAutomationSettingsLoading(false);
      }
    };

    void loadUiAutomationSettings();
  }, [error]);

  // Poll for external file changes when vault is open
  useEffect(() => {
    if (!vault) return;

    const interval = setInterval(() => {
      api.syncExternalChanges().catch(console.error);
    }, 2000);

    return () => clearInterval(interval);
  }, [vault]);

  useEffect(() => {
    if (!vault) {
      setViewMode("editor");
      setHydratedViewModeVaultPath(null);
      setHydratedShellVaultPath(null);
      setVaultSettings(null);
      return;
    }

    const key = `knot:view-mode:${vault.path}`;
    const stored = localStorage.getItem(key);
    if (stored === "graph" || stored === "editor" || stored === "settings") {
      setViewMode(stored);
    } else {
      setViewMode("editor");
    }
    setHydratedViewModeVaultPath(vault.path);
  }, [vault]);

  useEffect(() => {
    if (!vault || hydratedViewModeVaultPath !== vault.path) return;
    const key = `knot:view-mode:${vault.path}`;
    localStorage.setItem(key, viewMode);
  }, [vault, viewMode, hydratedViewModeVaultPath]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!vault) return;
      if (matchesShortcutEvent(event, appKeymapSettings.keymaps.general.switch_notes)) {
        event.preventDefault();
        handleToolModeSelect("notes");
      } else if (matchesShortcutEvent(event, appKeymapSettings.keymaps.general.switch_search)) {
        event.preventDefault();
        handleToolModeSelect("search");
      } else if (matchesShortcutEvent(event, appKeymapSettings.keymaps.general.switch_graph)) {
        event.preventDefault();
        handleToolModeSelect("graph");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [appKeymapSettings, handleToolModeSelect, vault]);

  useEffect(() => {
    if (!vault) return;
    if (hydratedShellVaultPath === vault.path) return;

    const key = `knot:shell:${vault.path}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as {
          toolMode?: "notes" | "search" | "graph";
          isToolRailCollapsed?: boolean;
          isContextPanelCollapsed?: boolean;
          isInspectorRailOpen?: boolean;
          contextPanelWidth?: number;
          densityMode?: "comfortable" | "adaptive";
          showTextLabels?: boolean;
        };

        if (parsed.toolMode === "notes" || parsed.toolMode === "search" || parsed.toolMode === "graph") {
          setShellToolMode(parsed.toolMode);
        }
        if (
          typeof parsed.isContextPanelCollapsed === "boolean" &&
          parsed.isContextPanelCollapsed !== shell.isContextPanelCollapsed
        ) {
          toggleContextPanel();
        }
        if (typeof parsed.isInspectorRailOpen === "boolean") {
          setInspectorRailOpen(parsed.isInspectorRailOpen);
        }
        if (typeof parsed.contextPanelWidth === "number") {
          setContextPanelWidth(parsed.contextPanelWidth);
        }
        if (parsed.densityMode === "comfortable" || parsed.densityMode === "adaptive") {
          setDensityMode(parsed.densityMode);
        }
        if (typeof parsed.showTextLabels === "boolean") {
          setShowTextLabels(parsed.showTextLabels);
        }
      } catch {
        // Ignore malformed persisted shell state.
      }
    }

    setHydratedShellVaultPath(vault.path);
  }, [
    vault,
    hydratedShellVaultPath,
    shell.isContextPanelCollapsed,
    setContextPanelWidth,
    setDensityMode,
    setInspectorRailOpen,
    setShellToolMode,
    setShowTextLabels,
    toggleContextPanel,
  ]);

  useEffect(() => {
    if (!vault || hydratedShellVaultPath !== vault.path) return;

    const key = `knot:shell:${vault.path}`;
    localStorage.setItem(
      key,
      JSON.stringify({
        toolMode: shell.toolMode,
        isToolRailCollapsed: shell.isToolRailCollapsed,
        isContextPanelCollapsed: shell.isContextPanelCollapsed,
        isInspectorRailOpen: shell.isInspectorRailOpen,
        contextPanelWidth: shell.contextPanelWidth,
        densityMode: shell.densityMode,
        showTextLabels: shell.showTextLabels,
      })
    );
  }, [vault, shell, hydratedShellVaultPath]);

  // Left tool rail is non-collapsible; normalize legacy persisted states.
  useEffect(() => {
    if (!vault) return;
    if (shell.isToolRailCollapsed) {
      toggleToolRail();
    }
  }, [vault, shell.isToolRailCollapsed, toggleToolRail]);

  useEffect(() => {
    const stored = localStorage.getItem("knot:editor-surface-mode");
    if (stored === "sepia" || stored === "dark") {
      setEditorSurfaceMode(stored);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("knot:editor-surface-mode", editorSurfaceMode);
  }, [editorSurfaceMode]);

  useEffect(() => {
    const element = contentAreaRef.current;
    if (!element) return;

    const updateSize = () => {
      const width = Math.max(320, Math.floor(element.clientWidth));
      const height = Math.max(240, Math.floor(element.clientHeight));
      setGraphSize({ width, height });
      setEditorMeasureBand(getEditorMeasureBand(width));
    };

    updateSize();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateSize);
      return () => window.removeEventListener("resize", updateSize);
    }

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, [viewMode, vault]);

  const handleOpenVault = async () => {
    try {
      const canProceed = await resolveUnsavedBeforeVaultSwitch();
      if (!canProceed) return;

      const info = await api.openVaultDialog();
      setVault(info);
      await api.addRecentVault(info.path);
      // Refresh recent vaults list
      const recents = await api.getRecentVaults();
      setRecentVaults(recents);
      await loadNotes();
      success(`Opened vault "${info.name}"`);
    } catch (err) {
      // User cancelled or error occurred
      if (err instanceof Error && !err.message.includes("cancelled")) {
        error(err.message);
      }
    }
  };

  const handleCreateVault = async () => {
    try {
      const canProceed = await resolveUnsavedBeforeVaultSwitch();
      if (!canProceed) return;

      const info = await api.createVaultDialog();
      setVault(info);
      await api.addRecentVault(info.path);
      // Refresh recent vaults list
      const recents = await api.getRecentVaults();
      setRecentVaults(recents);
      await loadNotes();
      success(`Created vault "${info.name}"`);
    } catch (err) {
      // User cancelled or error occurred
      if (err instanceof Error && !err.message.includes("cancelled")) {
        error(err.message);
      }
    }
  };

  const handleOpenRecent = async (path: string) => {
    try {
      const canProceed = await resolveUnsavedBeforeVaultSwitch();
      if (!canProceed) return;

      const info = await api.openVault(path);
      setVault(info);
      await api.addRecentVault(info.path);
      await loadNotes();
      success(`Opened vault "${info.name}"`);
    } catch (err) {
      error(err instanceof Error ? err.message : "Failed to open vault");
    }
  };

  const handleCloseVault = async () => {
    try {
      await closeVault();
      success("Vault closed");
    } catch (err) {
      error(err instanceof Error ? err.message : "Failed to close vault");
    }
  };

  const loadVaultSettings = async () => {
    if (!vault) return;
    setIsVaultSettingsLoading(true);
    try {
      const nextSettings = await api.getVaultSettings();
      setVaultSettings(nextSettings);
    } catch (err) {
      error(err instanceof Error ? err.message : "Failed to load vault settings");
    } finally {
      setIsVaultSettingsLoading(false);
    }
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Today at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const toggleViewMode = () => {
    if (viewMode === "settings") {
      setViewMode("editor");
      return;
    }

    if (viewMode === "editor") {
      setGraphScope("node");
      setViewMode("graph");
      return;
    }

    setViewMode("editor");
  };

  const handleGraphNodeClick = async (path: string) => {
    setGraphSelection((previous) => ({ ...previous, path }));
    try {
      await loadNote(path);
    } catch (err) {
      error(err instanceof Error ? err.message : "Failed to select note from graph");
    }
  };

  const handleGraphRelationSelect = async (path: string) => {
    setGraphSelection((previous) => ({ ...previous, path }));
    try {
      await loadNote(path);
    } catch (err) {
      error(err instanceof Error ? err.message : "Failed to select note from graph context");
    }
  };

  const handleSearchResultSelect = async (path: string) => {
    try {
      await loadNote(path);
      setViewMode("editor");
    } catch (err) {
      error(err instanceof Error ? err.message : "Failed to load note");
    }
  };

  const handleOpenSettings = () => {
    setInspectorMode("details");
    setSettingsSection("general-keymaps");
    setInspectorRailOpen(false);
    setViewMode("settings");
    void loadVaultSettings();
  };

  const handleUpdateVaultSettings = async (patch: Partial<api.VaultSettings>) => {
    try {
      const updated = await api.updateVaultSettings(patch);
      setVaultSettings(updated);
      success("Vault settings updated");
    } catch (err) {
      error(err instanceof Error ? err.message : "Failed to update vault settings");
    }
  };

  const handleReindexVault = async () => {
    setIsReindexing(true);
    setReindexStatus(null);
    try {
      const result = await api.reindexVault();
      setReindexStatus(`Reindexed ${result.reindexed_count} notes.`);
      await loadNotes();
      if (currentNote) {
        await loadNote(currentNote.path);
      }
      success(`Reindexed ${result.reindexed_count} notes.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to reindex vault";
      setReindexStatus(message);
      error(message);
    } finally {
      setIsReindexing(false);
    }
  };

  const persistAppKeymapSettings = async (nextSettings: api.AppKeymapSettings, successMessage: string) => {
    const validation = validateAppKeymapSettings(nextSettings);
    if (!validation.ok) {
      setAppKeymapErrors(
        validation.errors.reduce<Partial<Record<ManagedShortcutFieldPath, string>>>((accumulator, issue) => {
          accumulator[issue.field] = issue.message;
          return accumulator;
        }, {})
      );
      return;
    }

    setIsAppKeymapSettingsLoading(true);
    try {
      const persisted = await api.updateAppKeymapSettings(nextSettings);
      setAppKeymapSettings(persisted);
      setAppKeymapDraft(persisted);
      setAppKeymapErrors({});
      success(successMessage);
    } catch (err) {
      error(err instanceof Error ? err.message : "Failed to update app keymap settings");
    } finally {
      setIsAppKeymapSettingsLoading(false);
    }
  };

  const handleAppKeymapChange = (field: ManagedShortcutFieldPath, value: string) => {
    setAppKeymapDraft((current) => setManagedShortcutValue(current, field, value));
    setAppKeymapErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const handleApplyAppKeymapSettings = () => {
    void persistAppKeymapSettings(appKeymapDraft, "App keymap settings updated");
  };

  const handleGraphReadabilityFloorPercentChange = (value: number) => {
    const nextValue = Math.max(40, Math.min(100, Math.floor(value || 0)));
    setAppKeymapDraft((current) => ({
      ...current,
      graph: {
        ...current.graph,
        readability_floor_percent: nextValue,
      },
    }));
  };

  const handleResetAppKeymapField = (field: ManagedShortcutFieldPath) => {
    const nextSettings = resetManagedShortcutField(appKeymapDraft, field);
    void persistAppKeymapSettings(nextSettings, "Shortcut reset to default");
  };

  const handleResetAllAppKeymaps = () => {
    void persistAppKeymapSettings(
      {
        ...DEFAULT_APP_KEYMAP_SETTINGS,
        graph: appKeymapDraft.graph,
      },
      "All keymaps reset to default"
    );
  };

  const handleUpdateUiAutomationSettings = async (settings: api.UiAutomationSettings) => {
    setIsUiAutomationSettingsLoading(true);
    try {
      const persisted = await api.updateUiAutomationSettings(settings);
      setUiAutomationSettings(persisted);
      success("UI automation settings updated");
    } catch (err) {
      error(err instanceof Error ? err.message : "Failed to update UI automation settings");
    } finally {
      setIsUiAutomationSettingsLoading(false);
    }
  };

  function handleToolModeSelect(nextMode: ShellToolMode): void {
    const currentMode = shell.toolMode;
    const isPanelVisible = !shell.isContextPanelCollapsed;

    if (nextMode === currentMode) {
      const nextVisibility = !isPanelVisible;
      if (TOOL_PANEL_POLICY[nextMode] === "panel-optional") {
        setOptionalPanelVisibilityByTool((state) => ({ ...state, [nextMode]: nextVisibility }));
      }
      toggleContextPanel();
      return;
    }

    setShellToolMode(nextMode);
    if (nextMode === "graph") {
      setGraphScope("vault");
      setViewMode("graph");
    } else if (viewMode === "settings") {
      setViewMode("editor");
    }
    const policy = TOOL_PANEL_POLICY[nextMode];

    if (policy === "panel-required") {
      if (!isPanelVisible) {
        toggleContextPanel();
      }
      return;
    }

    if (policy === "panel-optional") {
      const shouldBeVisible = optionalPanelVisibilityByTool[nextMode] ?? true;
      if (shouldBeVisible !== isPanelVisible) {
        toggleContextPanel();
      }
    }
  }

  const graphControlsContent = (
    <GraphContextPanel
      selectedTitle={graphSelection.title}
      selectedPath={graphSelection.path}
      neighbors={graphSelection.neighbors}
      backlinks={graphSelection.backlinks}
      scope={graphScope}
      nodeScopeDepth={nodeGraphDepth}
      onScopeChange={setGraphScope}
      onNodeScopeDepthChange={setNodeGraphDepth}
      onResetView={() => setGraphSize({ width: 900, height: 600 })}
      onOpenEditor={() => setViewMode("editor")}
      onRelationSelect={handleGraphRelationSelect}
      showLabels={shell.showTextLabels}
    />
  );

  const graphContextContent = null;
  return (
    <div
      className={`app ${shell.densityMode === "comfortable" ? "app--comfortable" : "app--adaptive"}`}
      data-ui-automation-view-id="window.main"
    >
      <ToolRail
        mode={shell.toolMode}
        showLabels={shell.showTextLabels}
        onModeChange={handleToolModeSelect}
        onOpenSettings={handleOpenSettings}
        settingsActive={viewMode === "settings"}
      />
      <ContextPanel
        mode={shell.toolMode}
        collapsed={shell.isContextPanelCollapsed}
        width={shell.contextPanelWidth}
        notesContent={
          <Sidebar
            recentVaults={recentVaults}
            onOpenVault={handleOpenVault}
            onCreateVault={handleCreateVault}
            onOpenRecent={handleOpenRecent}
            onCloseVault={handleCloseVault}
          />
        }
        searchContent={
          <div className="context-search">
            <SearchBox onResultSelect={handleSearchResultSelect} />
            <ul className="context-search__list">
              {noteList.map((note) => (
                <li key={note.path}>
                  <button type="button" onClick={() => handleSearchResultSelect(note.path)}>
                    {note.title || note.path}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        }
        graphControlsContent={graphControlsContent}
        graphContextContent={graphContextContent}
      />
      <main className="main-content">
        {/* Loading indicator */}
        {isLoading && (
          <div className="loading-overlay">
            <div className="loading-spinner" />
            <span>Loading...</span>
          </div>
        )}

        {vault ? (
          <div
            className={`content-area content-area--editor-${editorSurfaceMode} content-area--measure-${editorMeasureBand}`}
            ref={contentAreaRef}
            data-ui-automation-view-id={
              viewMode === "editor" ? "view.editor" : viewMode === "graph" ? "view.graph" : "view.settings"
            }
          >
            <div className="content-mode-toggle">
              <IconButton
                icon={SquarePen}
                label="Surface"
                className="btn-secondary editor-surface-toggle"
                showLabel={shell.showTextLabels}
                onClick={() => setEditorSurfaceMode((mode) => (mode === "sepia" ? "dark" : "sepia"))}
              />
              <IconButton
                icon={CaseSensitive}
                label="Labels"
                className="btn-secondary"
                showLabel={shell.showTextLabels}
                active={shell.showTextLabels}
                onClick={() => setShowTextLabels(!shell.showTextLabels)}
              />
              <IconButton
                icon={CircleEllipsis}
                label="Inspector"
                className="btn-secondary"
                showLabel={shell.showTextLabels}
                active={shell.isInspectorRailOpen}
                onClick={() => {
                  if (shell.isInspectorRailOpen && inspectorMode === "details") {
                    setInspectorRailOpen(false);
                    return;
                  }
                  setInspectorMode("details");
                  setInspectorRailOpen(true);
                }}
              />
              <IconButton
                icon={viewMode === "editor" ? Network : SquarePen}
                label={viewMode === "editor" ? "Graph mode" : "Edit note"}
                className="btn-secondary"
                showLabel={shell.showTextLabels}
                onClick={toggleViewMode}
              />
            </div>
            {viewMode === "editor" ? (
              <Editor key={currentNote?.path ?? "no-note-selected"} appKeymapSettings={appKeymapSettings} />
            ) : viewMode === "graph" ? (
              <GraphView
                width={graphSize.width}
                height={Math.max(240, graphSize.height - 52)}
                onNodeClick={handleGraphNodeClick}
                onSelectionChange={setGraphSelection}
                showLabels={shell.showTextLabels}
                scope={graphScope}
                centerNodeId={currentNote?.path ?? null}
                nodeScopeDepth={nodeGraphDepth}
                readabilityFloorPercent={appKeymapSettings.graph.readability_floor_percent}
                // SPEC: COMP-GRAPH-CONSISTENCY-001 FR-3
                selectedNodeId={graphSelection.path ?? currentNote?.path ?? null}
              />
            ) : (
              <SettingsPane
                section={settingsSection}
                onSectionChange={setSettingsSection}
                showTextLabels={shell.showTextLabels}
                onShowTextLabelsChange={setShowTextLabels}
                densityMode={shell.densityMode}
                onDensityModeChange={setDensityMode}
                contextPanelWidth={shell.contextPanelWidth}
                onContextPanelWidthChange={setContextPanelWidth}
                editorSurfaceMode={editorSurfaceMode}
                onEditorSurfaceModeChange={setEditorSurfaceMode}
                graphReadabilityFloorPercent={appKeymapDraft.graph.readability_floor_percent}
                onGraphReadabilityFloorPercentChange={handleGraphReadabilityFloorPercentChange}
                vaultSettings={vaultSettings}
                isVaultSettingsLoading={isVaultSettingsLoading}
                onRefreshVaultSettings={() => {
                  void loadVaultSettings();
                }}
                onUpdateVaultSettings={handleUpdateVaultSettings}
                onReindexVault={handleReindexVault}
                isReindexing={isReindexing}
                reindexStatus={reindexStatus}
                appKeymapSettings={appKeymapDraft}
                appKeymapErrors={appKeymapErrors}
                isAppKeymapSettingsLoading={isAppKeymapSettingsLoading}
                onAppKeymapChange={handleAppKeymapChange}
                onApplyAppKeymapSettings={handleApplyAppKeymapSettings}
                onResetAppKeymapField={handleResetAppKeymapField}
                onResetAllAppKeymaps={handleResetAllAppKeymaps}
                uiAutomationSettings={uiAutomationSettings}
                isUiAutomationSettingsLoading={isUiAutomationSettingsLoading}
                onUpdateUiAutomationSettings={handleUpdateUiAutomationSettings}
              />
            )}
          </div>
        ) : (
          <div className="vault-setup">
            <h1>Welcome to Knot</h1>
            <p className="subtitle">Your personal knowledge base</p>

            <div className="vault-actions">
              <button onClick={handleOpenVault} disabled={isLoading} className="btn-primary">
                {isLoading ? "Opening..." : "Open Existing Vault"}
              </button>
              <button onClick={handleCreateVault} disabled={isLoading} className="btn-secondary">
                {isLoading ? "Creating..." : "Create New Vault"}
              </button>
            </div>

            {/* Recent vaults list */}
            {recentVaults.length > 0 && (
              <div className="recent-vaults">
                <h2>Recent Vaults</h2>
                <ul>
                  {recentVaults.map((recent) => (
                    <li key={recent.path}>
                      <button
                        onClick={() => handleOpenRecent(recent.path)}
                        disabled={isLoading}
                        className="recent-vault-btn"
                      >
                        <span className="vault-name">{recent.name}</span>
                        <span className="vault-path">{recent.path}</span>
                        <span className="vault-date">{formatDate(recent.opened_at)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </main>
      <InspectorRail
        isOpen={shell.isInspectorRailOpen}
        mode={inspectorMode}
        title={inspectorMode === "settings" ? "Settings" : "Inspector"}
        onClose={() => setInspectorRailOpen(false)}
      >
        {inspectorMode === "settings" ? (
          <SettingsPane
            section={settingsSection}
            onSectionChange={setSettingsSection}
            showTextLabels={shell.showTextLabels}
            onShowTextLabelsChange={setShowTextLabels}
            densityMode={shell.densityMode}
            onDensityModeChange={setDensityMode}
            contextPanelWidth={shell.contextPanelWidth}
            onContextPanelWidthChange={setContextPanelWidth}
            editorSurfaceMode={editorSurfaceMode}
            onEditorSurfaceModeChange={setEditorSurfaceMode}
            graphReadabilityFloorPercent={appKeymapDraft.graph.readability_floor_percent}
            onGraphReadabilityFloorPercentChange={handleGraphReadabilityFloorPercentChange}
            vaultSettings={vaultSettings}
            isVaultSettingsLoading={isVaultSettingsLoading}
            onRefreshVaultSettings={() => {
              void loadVaultSettings();
            }}
            onUpdateVaultSettings={handleUpdateVaultSettings}
            onReindexVault={handleReindexVault}
            isReindexing={isReindexing}
            reindexStatus={reindexStatus}
            appKeymapSettings={appKeymapDraft}
            appKeymapErrors={appKeymapErrors}
            isAppKeymapSettingsLoading={isAppKeymapSettingsLoading}
            onAppKeymapChange={handleAppKeymapChange}
            onApplyAppKeymapSettings={handleApplyAppKeymapSettings}
            onResetAppKeymapField={handleResetAppKeymapField}
            onResetAllAppKeymaps={handleResetAllAppKeymaps}
            uiAutomationSettings={uiAutomationSettings}
            isUiAutomationSettingsLoading={isUiAutomationSettingsLoading}
            onUpdateUiAutomationSettings={handleUpdateUiAutomationSettings}
          />
        ) : (
          <>
            <p>Mode: {shell.toolMode}</p>
            {currentNote ? <p>Note: {currentNote.title || currentNote.path}</p> : <p>No note selected</p>}
          </>
        )}
      </InspectorRail>

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

export default App;
