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
import { ToastContainer } from "@components/Toast";
import { useToast } from "@hooks/useToast";
import { useVaultStore } from "@lib/store";
import type { ShellToolMode } from "@lib/store";
import { getEditorMeasureBand } from "@lib/editorMeasure";
import * as api from "@lib/api";
import type { RecentVault } from "@lib/api";
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

function App() {
  const [recentVaults, setRecentVaults] = useState<RecentVault[]>([]);
  const [viewMode, setViewMode] = useState<"editor" | "graph">("editor");
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

  // Load recent vaults and check for existing vault on mount
  useEffect(() => {
    // Load recent vaults
    api.getRecentVaults().then(setRecentVaults).catch(console.error);

    // Check if there's already a vault open
    api.isVaultOpen().then((isOpen) => {
      if (isOpen) {
        api.getVaultInfo().then((info) => {
          if (info) {
            setVault(info);
            loadNotes();
          }
        });
      }
    });
  }, [setVault, loadNotes]);

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
      return;
    }

    const key = `knot:view-mode:${vault.path}`;
    const stored = localStorage.getItem(key);
    if (stored === "graph" || stored === "editor") {
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
      if (!(event.ctrlKey || event.metaKey)) return;

      if (event.key === "1") {
        event.preventDefault();
        setShellToolMode("notes");
      } else if (event.key === "2") {
        event.preventDefault();
        setShellToolMode("search");
      } else if (event.key === "3") {
        event.preventDefault();
        setShellToolMode("graph");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setShellToolMode, vault]);

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

  const handleToolModeSelect = (nextMode: ShellToolMode) => {
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
  };

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
    <div className={`app ${shell.densityMode === "comfortable" ? "app--comfortable" : "app--adaptive"}`}>
      <ToolRail
        mode={shell.toolMode}
        showLabels={shell.showTextLabels}
        onModeChange={handleToolModeSelect}
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
                onClick={() => setInspectorRailOpen(!shell.isInspectorRailOpen)}
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
              <Editor key={currentNote?.path ?? "no-note-selected"} />
            ) : (
              <GraphView
                width={graphSize.width}
                height={Math.max(240, graphSize.height - 52)}
                onNodeClick={handleGraphNodeClick}
                onSelectionChange={setGraphSelection}
                showLabels={shell.showTextLabels}
                scope={graphScope}
                centerNodeId={currentNote?.path ?? null}
                nodeScopeDepth={nodeGraphDepth}
                // SPEC: COMP-GRAPH-CONSISTENCY-001 FR-3
                selectedNodeId={graphSelection.path ?? currentNote?.path ?? null}
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
                <h3>Recent Vaults</h3>
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
      <InspectorRail isOpen={shell.isInspectorRailOpen} onClose={() => setInspectorRailOpen(false)}>
        <p>Mode: {shell.toolMode}</p>
        {currentNote ? <p>Note: {currentNote.title || currentNote.path}</p> : <p>No note selected</p>}
      </InspectorRail>

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

export default App;
