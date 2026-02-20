import { useEffect, useRef, useState } from "react";
import { Editor } from "@components/Editor";
import { GraphContextPanel } from "@components/GraphView/GraphContextPanel";
import { GraphView } from "@components/GraphView";
import { ContextPanel } from "@components/Shell/ContextPanel";
import { InspectorRail } from "@components/Shell/InspectorRail";
import { ToolRail } from "@components/Shell/ToolRail";
import { SearchBox } from "@components/SearchBox";
import { Sidebar } from "@components/Sidebar";
import { ToastContainer } from "@components/Toast";
import { useToast } from "@hooks/useToast";
import { useVaultStore } from "@lib/store";
import { getEditorMeasureBand } from "@lib/editorMeasure";
import * as api from "@lib/api";
import type { RecentVault } from "@lib/api";
import "./styles/App.css";

// SPEC: COMP-UI-LAYOUT-002 FR-5, FR-6
// SPEC: COMP-FRONTEND-001 FR-1, FR-2
// SPEC: COMP-GRAPH-UI-001 FR-4
// SPEC: COMP-LAYOUT-RECOVERY-001 FR-1, FR-2
function App() {
  const [recentVaults, setRecentVaults] = useState<RecentVault[]>([]);
  const [viewMode, setViewMode] = useState<"editor" | "graph">("editor");
  const [editorSurfaceMode, setEditorSurfaceMode] = useState<"sepia" | "dark">("sepia");
  const [editorMeasureBand, setEditorMeasureBand] = useState<45 | 54 | 62 | 70>(54);
  // SPEC: COMP-COMPLIANCE-001 FR-1, FR-2
  const [hydratedViewModeVaultPath, setHydratedViewModeVaultPath] = useState<string | null>(null);
  const [hydratedShellVaultPath, setHydratedShellVaultPath] = useState<string | null>(null);
  const [graphSize, setGraphSize] = useState({ width: 900, height: 600 });
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
    if (shell.toolMode === "graph") {
      setViewMode("graph");
      return;
    }
    setViewMode("editor");
  }, [shell.toolMode]);

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
    setViewMode((mode) => (mode === "editor" ? "graph" : "editor"));
  };

  const handleGraphNodeClick = async (path: string) => {
    try {
      await loadNote(path);
      setViewMode("editor");
    } catch (err) {
      error(err instanceof Error ? err.message : "Failed to open note from graph");
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

  const graphControlsContent = (
    <GraphContextPanel
      selectedTitle={currentNote?.title ?? null}
      selectedPath={currentNote?.path ?? null}
      neighbors={[]}
      backlinks={[]}
      onResetView={() => setGraphSize({ width: 900, height: 600 })}
      onOpenEditor={() => setViewMode("editor")}
    />
  );

  const graphContextContent = null;
  return (
    <div className={`app ${shell.densityMode === "comfortable" ? "app--comfortable" : "app--adaptive"}`}>
      <ToolRail
        mode={shell.toolMode}
        onModeChange={setShellToolMode}
      />
      <ContextPanel
        mode={shell.toolMode}
        collapsed={shell.isContextPanelCollapsed}
        width={shell.contextPanelWidth}
        onToggleCollapse={toggleContextPanel}
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
              <button
                type="button"
                onClick={() => setEditorSurfaceMode((mode) => (mode === "sepia" ? "dark" : "sepia"))}
                className="btn-secondary editor-surface-toggle"
              >
                Editor: {editorSurfaceMode === "sepia" ? "Sepia" : "Dark"}
              </button>
              <button
                type="button"
                onClick={() => setInspectorRailOpen(!shell.isInspectorRailOpen)}
                className="btn-secondary"
              >
                {shell.isInspectorRailOpen ? "Hide Inspector" : "Inspector"}
              </button>
              <button type="button" onClick={toggleViewMode} className="btn-secondary">
                {viewMode === "editor" ? "Graph View" : "Editor View"}
              </button>
            </div>
            {viewMode === "editor" ? (
              <Editor key={currentNote?.path ?? "no-note-selected"} />
            ) : (
              <GraphView
                width={graphSize.width}
                height={Math.max(240, graphSize.height - 52)}
                onNodeClick={handleGraphNodeClick}
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
