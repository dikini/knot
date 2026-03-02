import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import App from "./App";
import { getEditorMeasureBand } from "@lib/editorMeasure";

const mockListen = vi.fn(async (..._args: unknown[]) => () => {});

vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: unknown[]) => mockListen(...args),
}));

const mockLoadNote = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
let editorMountCount = 0;
let editorUnmountCount = 0;
const mockStoreState: {
  vault: { path: string; name: string; note_count: number; last_modified: number } | null;
  noteList: Array<{
    id: string;
    path: string;
    title: string;
    created_at: number;
    modified_at: number;
    word_count: number;
  }>;
  currentNote: {
    id: string;
    path: string;
    title: string;
    content: string;
    created_at: number;
    modified_at: number;
    word_count: number;
    headings: unknown[];
    backlinks: unknown[];
  } | null;
  isLoading: boolean;
  shell: {
    toolMode: "notes" | "search" | "graph";
    isToolRailCollapsed: boolean;
    isContextPanelCollapsed: boolean;
    isInspectorRailOpen: boolean;
    contextPanelWidth: number;
    densityMode: "comfortable" | "adaptive";
    showTextLabels: boolean;
  };
  setVault: ReturnType<typeof vi.fn>;
  closeVault: ReturnType<typeof vi.fn>;
  loadNotes: ReturnType<typeof vi.fn>;
  loadNote: typeof mockLoadNote;
  setShellToolMode: ReturnType<typeof vi.fn>;
  toggleToolRail: ReturnType<typeof vi.fn>;
  toggleContextPanel: ReturnType<typeof vi.fn>;
  setInspectorRailOpen: ReturnType<typeof vi.fn>;
  setContextPanelWidth: ReturnType<typeof vi.fn>;
  setDensityMode: ReturnType<typeof vi.fn>;
  setShowTextLabels: ReturnType<typeof vi.fn>;
} = {
  vault: { path: "/tmp/vault", name: "vault", note_count: 0, last_modified: 0 },
  noteList: [],
  currentNote: null,
  isLoading: false,
  shell: {
    toolMode: "notes",
    isToolRailCollapsed: false,
    isContextPanelCollapsed: false,
    isInspectorRailOpen: false,
    contextPanelWidth: 320,
    densityMode: "comfortable",
    showTextLabels: false,
  },
  setVault: vi.fn(),
  closeVault: vi.fn(),
  loadNotes: vi.fn(),
  loadNote: mockLoadNote,
  setShellToolMode: vi.fn((mode: "notes" | "search" | "graph") => {
    mockStoreState.shell.toolMode = mode;
  }),
  toggleToolRail: vi.fn(() => {
    mockStoreState.shell.isToolRailCollapsed = !mockStoreState.shell.isToolRailCollapsed;
  }),
  toggleContextPanel: vi.fn(() => {
    mockStoreState.shell.isContextPanelCollapsed = !mockStoreState.shell.isContextPanelCollapsed;
  }),
  setInspectorRailOpen: vi.fn((isOpen: boolean) => {
    mockStoreState.shell.isInspectorRailOpen = isOpen;
  }),
  setContextPanelWidth: vi.fn((width: number) => {
    mockStoreState.shell.contextPanelWidth = width;
  }),
  setDensityMode: vi.fn((mode: "comfortable" | "adaptive") => {
    mockStoreState.shell.densityMode = mode;
  }),
  setShowTextLabels: vi.fn((show: boolean) => {
    mockStoreState.shell.showTextLabels = show;
  }),
};

vi.mock("@hooks/useToast", () => ({
  useToast: () => ({
    toasts: [],
    removeToast: vi.fn(),
    success: mockToastSuccess,
    error: mockToastError,
  }),
}));

vi.mock("@lib/api", () => ({
  // Keep mount-time API effects pending by default so tests don't get
  // post-assertion state updates that trigger act(...) warnings.
  getRecentVaults: vi.fn(() => new Promise<never>(() => {})),
  isVaultOpen: vi.fn(() => new Promise<never>(() => {})),
  getVaultInfo: vi.fn().mockResolvedValue(null),
  syncExternalChanges: vi.fn().mockResolvedValue(undefined),
  openVaultDialog: vi.fn(),
  addRecentVault: vi.fn(),
  createVaultDialog: vi.fn(),
  openVault: vi.fn(),
  saveNote: vi.fn(),
  setUnsavedChanges: vi.fn(),
  getVaultSettings: vi.fn().mockResolvedValue({
    name: "vault",
    plugins_enabled: false,
    plugin_overrides: {},
    file_visibility: "all_files",
    sync: { enabled: false, peers: [] },
    editor: { font_size: 14, tab_size: 4 },
  }),
  listVaultPlugins: vi.fn().mockResolvedValue([]),
  updateVaultSettings: vi.fn().mockResolvedValue({
    name: "vault",
    plugins_enabled: false,
    plugin_overrides: {},
    file_visibility: "all_files",
    sync: { enabled: false, peers: [] },
    editor: { font_size: 14, tab_size: 4 },
  }),
  reindexVault: vi.fn().mockResolvedValue({ reindexed_count: 2 }),
  getAppKeymapSettings: vi.fn().mockResolvedValue({
    keymaps: {
      general: {
        save_note: "Mod-s",
        switch_notes: "Mod-1",
        switch_search: "Mod-2",
        switch_graph: "Mod-3",
      },
      editor: {
        undo: "Mod-z",
        redo: "Mod-Shift-z, Mod-y",
        clear_paragraph: "Mod-Alt-0",
      },
    },
    graph: {
      readability_floor_percent: 70,
    },
  }),
  updateAppKeymapSettings: vi.fn().mockResolvedValue({
    keymaps: {
      general: {
        save_note: "Mod-s",
        switch_notes: "Mod-1",
        switch_search: "Mod-2",
        switch_graph: "Mod-3",
      },
      editor: {
        undo: "Mod-z",
        redo: "Mod-Shift-z, Mod-y",
        clear_paragraph: "Mod-Alt-0",
      },
    },
    graph: {
      readability_floor_percent: 70,
    },
  }),
  getUiAutomationSettings: vi.fn().mockResolvedValue({
    enabled: false,
    groups: { navigation: false, screenshots: false, behaviors: false },
  }),
  updateUiAutomationSettings: vi.fn().mockResolvedValue({
    enabled: false,
    groups: { navigation: false, screenshots: false, behaviors: false },
  }),
  syncUiAutomationRegistry: vi.fn().mockResolvedValue(undefined),
  syncUiAutomationState: vi.fn().mockResolvedValue(undefined),
  completeUiAutomationRequest: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@lib/store", () => ({
  useVaultStore: () => mockStoreState,
  useEditorStore: {
    getState: vi.fn(() => ({
      isDirty: false,
      content: "",
      markDirty: vi.fn(),
    })),
  },
}));

vi.mock("@components/Sidebar", () => ({
  Sidebar: () => <div data-testid="sidebar" />,
}));

vi.mock("@components/Editor", () => ({
  Editor: () => {
    useEffect(() => {
      editorMountCount += 1;
      const handleUiAutomationRequest = (event: Event) => {
        const custom = event as CustomEvent<{
          requestId: string;
          actionId?: string;
          path: string;
          mode?: "meta" | "source" | "edit" | "view";
        }>;

        if (custom.detail?.actionId !== "core.select.editor-mode") {
          return;
        }

        window.dispatchEvent(
          new CustomEvent("ui-automation-editor-result", {
            detail: {
              requestId: custom.detail.requestId,
              success: true,
              message: `Switched editor mode to ${custom.detail.mode ?? "view"}`,
              payload: {
                active_note_path: custom.detail.path,
                active_view: "view.editor",
                editor_mode: custom.detail.mode ?? "view",
              },
            },
          })
        );
      };

      window.addEventListener("ui-automation-editor-request", handleUiAutomationRequest as EventListener);
      return () => {
        editorUnmountCount += 1;
        window.removeEventListener("ui-automation-editor-request", handleUiAutomationRequest as EventListener);
      };
    }, []);
    return <div data-testid="editor-view">Editor</div>;
  },
}));

vi.mock("@components/GraphView", () => ({
  GraphView: ({
    onNodeClick,
    onSelectionChange,
    scope,
    nodeScopeDepth,
  }: {
    onNodeClick: (path: string) => void;
    onSelectionChange?: (selection: {
      path: string | null;
      title: string | null;
      neighbors: string[];
      backlinks: string[];
    }) => void;
    scope?: "vault" | "node";
    nodeScopeDepth?: number;
  }) => (
    <div data-testid="graph-view">
      Graph
      <div data-testid="graph-scope">{scope ?? "vault"}</div>
      <div data-testid="graph-depth">{nodeScopeDepth ?? 1}</div>
      <button onClick={() => onNodeClick("note1.md")}>Select Node 1</button>
      <button
        onClick={() =>
          onSelectionChange?.({
            path: "note1.md",
            title: "Note 1",
            neighbors: ["note2.md"],
            backlinks: ["note3.md"],
          })
        }
      >
        Emit Selection
      </button>
    </div>
  ),
}));

describe("App Graph Toggle (COMP-GRAPH-UI-001 FR-4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockListen.mockClear();
    editorMountCount = 0;
    editorUnmountCount = 0;
    mockStoreState.vault = { path: "/tmp/vault", name: "vault", note_count: 0, last_modified: 0 };
    mockStoreState.noteList = [];
    mockStoreState.currentNote = null;
    mockStoreState.shell = {
      toolMode: "notes",
      isToolRailCollapsed: false,
      isContextPanelCollapsed: false,
      isInspectorRailOpen: false,
      contextPanelWidth: 320,
      densityMode: "comfortable",
      showTextLabels: false,
    };
    mockToastSuccess.mockClear();
    mockToastError.mockClear();
  });

  it("shows graph toggle when a vault is open and switches views", async () => {
    render(<App />);

    expect(await screen.findByTestId("editor-view")).toBeInTheDocument();
    const graphToggle = screen.getByRole("button", { name: /graph mode/i });
    fireEvent.click(graphToggle);

    expect(screen.getByTestId("graph-view")).toBeInTheDocument();
    expect(screen.getByTestId("graph-scope")).toHaveTextContent("node");
    expect(screen.queryByTestId("editor-view")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit note/i })).toBeInTheDocument();
  });

  it("toggles editor <-> node graph via mode toggle", async () => {
    render(<App />);
    const modeToggle = await screen.findByRole("button", { name: /graph mode/i });

    fireEvent.click(modeToggle);
    expect(screen.getByTestId("graph-view")).toBeInTheDocument();
    expect(screen.getByTestId("graph-scope")).toHaveTextContent("node");
    expect(screen.getByTestId("graph-depth")).toHaveTextContent("1");

    fireEvent.click(screen.getByRole("button", { name: /edit note/i }));
    expect(screen.getByTestId("editor-view")).toBeInTheDocument();
    expect(screen.queryByTestId("graph-view")).not.toBeInTheDocument();
  });

  it("hides graph toggle when no vault is open", () => {
    mockStoreState.vault = null;
    render(<App />);

    expect(screen.queryByRole("button", { name: /graph mode/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit note/i })).not.toBeInTheDocument();
  });

  it("keeps graph open and globally selects note on graph click", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /graph mode/i }));
    fireEvent.click(await screen.findByRole("button", { name: /select node 1/i }));

    await waitFor(() => {
      expect(mockLoadNote).toHaveBeenCalledWith("note1.md");
    });
    expect(screen.getByTestId("graph-view")).toBeInTheDocument();
  });

  it("can switch to editor from mode toggle while graph tool is active", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Graph" }));
    fireEvent.click(screen.getByRole("button", { name: /edit note/i }));

    expect(screen.getByTestId("editor-view")).toBeInTheDocument();
    expect(screen.queryByTestId("graph-view")).not.toBeInTheDocument();
  });

  it("shows neighbors and backlinks in graph context panel after selection update", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /graph mode/i }));
    fireEvent.click(screen.getByRole("button", { name: "Graph" }));
    fireEvent.click(await screen.findByRole("button", { name: /emit selection/i }));

    expect(screen.getByText("Selected Node")).toBeInTheDocument();
    expect(screen.getByText("Note 1")).toBeInTheDocument();
    expect(screen.getByText("note1.md")).toBeInTheDocument();
    expect(screen.getByText("note2.md")).toBeInTheDocument();
    expect(screen.getByText("note3.md")).toBeInTheDocument();
  });

  it("keeps graph mode when selecting neighbors/backlinks from graph context", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /graph mode/i }));
    fireEvent.click(screen.getByRole("button", { name: "Graph" }));
    fireEvent.click(await screen.findByRole("button", { name: /emit selection/i }));

    fireEvent.click(screen.getByRole("button", { name: "note2.md" }));

    await waitFor(() => {
      expect(mockLoadNote).toHaveBeenCalledWith("note2.md");
    });
    expect(screen.getByTestId("graph-view")).toBeInTheDocument();
    expect(screen.queryByTestId("editor-view")).not.toBeInTheDocument();
  });

  it("does not write stale view mode when switching to a different vault", async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    const vaultA = "/tmp/vault-a";
    const vaultB = "/tmp/vault-b";
    localStorage.setItem(`knot:view-mode:${vaultA}`, "editor");
    localStorage.setItem(`knot:view-mode:${vaultB}`, "graph");

    mockStoreState.vault = { path: vaultA, name: "vault-a", note_count: 0, last_modified: 0 };
    const { rerender } = render(<App />);

    // Hydrate from vault A preference.
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /graph mode|edit note/i })).toBeInTheDocument();
    });

    // Switch store state to vault B and rerender.
    mockStoreState.vault = { path: vaultB, name: "vault-b", note_count: 0, last_modified: 0 };
    rerender(<App />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /graph mode|edit note/i })).toBeInTheDocument();
    });

    expect(setItemSpy).not.toHaveBeenCalledWith(`knot:view-mode:${vaultB}`, "editor");
    setItemSpy.mockRestore();
  });

  it("hydrates shell preferences per vault and persists updated shell state", async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    const vaultA = "/tmp/vault-a";
    const vaultB = "/tmp/vault-b";
    localStorage.setItem(
      `knot:shell:${vaultA}`,
      JSON.stringify({
        toolMode: "graph",
        isToolRailCollapsed: true,
        isContextPanelCollapsed: true,
        isInspectorRailOpen: true,
        contextPanelWidth: 480,
        densityMode: "adaptive",
        showTextLabels: true,
      })
    );
    localStorage.setItem(
      `knot:shell:${vaultB}`,
      JSON.stringify({
        toolMode: "search",
        isToolRailCollapsed: false,
        isContextPanelCollapsed: false,
        isInspectorRailOpen: false,
        contextPanelWidth: 360,
        densityMode: "comfortable",
        showTextLabels: false,
      })
    );

    mockStoreState.vault = { path: vaultA, name: "vault-a", note_count: 0, last_modified: 0 };
    const { rerender } = render(<App />);

    await waitFor(() => {
      expect(mockStoreState.setShellToolMode).toHaveBeenCalledWith("graph");
      expect(mockStoreState.setContextPanelWidth).toHaveBeenCalledWith(480);
      expect(mockStoreState.setDensityMode).toHaveBeenCalledWith("adaptive");
      expect(mockStoreState.setShowTextLabels).toHaveBeenCalledWith(true);
    });

    mockStoreState.vault = { path: vaultB, name: "vault-b", note_count: 0, last_modified: 0 };
    rerender(<App />);

    await waitFor(() => {
      expect(mockStoreState.setShellToolMode).toHaveBeenCalledWith("search");
      expect(mockStoreState.setContextPanelWidth).toHaveBeenCalledWith(360);
      expect(mockStoreState.setDensityMode).toHaveBeenCalledWith("comfortable");
      expect(mockStoreState.setShowTextLabels).toHaveBeenCalledWith(false);
    });

    expect(setItemSpy).not.toHaveBeenCalledWith(
      `knot:shell:${vaultB}`,
      expect.stringContaining('"toolMode":"graph"')
    );
    setItemSpy.mockRestore();
  });

  it("switches shell tool mode with persisted managed shortcuts", async () => {
    localStorage.setItem(
      "knot:shell:/tmp/vault",
      JSON.stringify({
        toolMode: "search",
        isToolRailCollapsed: false,
        isContextPanelCollapsed: false,
        isInspectorRailOpen: false,
        contextPanelWidth: 320,
        densityMode: "comfortable",
        showTextLabels: false,
      })
    );
    render(<App />);

    await waitFor(() => {
      expect(mockStoreState.setShellToolMode).toHaveBeenCalledWith("search");
    });
    mockStoreState.setShellToolMode.mockClear();

    fireEvent.keyDown(window, { key: "1", ctrlKey: true });
    fireEvent.keyDown(window, { key: "2", metaKey: true });
    fireEvent.keyDown(window, { key: "3", ctrlKey: true });

    expect(mockStoreState.setShellToolMode).toHaveBeenCalledWith("notes");
    expect(mockStoreState.setShellToolMode).toHaveBeenCalledWith("search");
    expect(mockStoreState.setShellToolMode).toHaveBeenCalledWith("graph");
  });

  it("handles semantic editor mode automation requests", async () => {
    mockStoreState.currentNote = {
      id: "n-yt",
      path: "knot/demo.youtube.md",
      title: "Demo",
      content: "body",
      created_at: 0,
      modified_at: 0,
      word_count: 1,
      headings: [],
      backlinks: [],
      available_modes: {
        meta: true,
        source: true,
        edit: true,
        view: true,
      },
    } as typeof mockStoreState.currentNote;

    const api = await import("@lib/api");
    render(<App />);

    await waitFor(() => {
      expect(mockListen).toHaveBeenCalled();
    });

    const automationCall = mockListen.mock.calls.find((call) => call[0] === "ui-automation://request");
    expect(automationCall).toBeTruthy();

    const handler = automationCall?.[1] as unknown as (event: {
      payload: {
        kind: "invoke_action";
        request_id: string;
        action_id: string;
        args: Record<string, unknown>;
      };
    }) => Promise<void>;

    await handler({
      payload: {
        kind: "invoke_action",
        request_id: "req-editor-mode",
        action_id: "core.select.editor-mode",
        args: { mode: "meta" },
      },
    });

    expect(api.completeUiAutomationRequest).toHaveBeenCalledWith("req-editor-mode", {
      success: true,
      message: "Switched editor mode to meta",
      payload: {
        active_note_path: "knot/demo.youtube.md",
        active_view: "view.editor",
        editor_mode: "meta",
      },
    });
  });

  it("uses custom persisted tool-switch shortcuts instead of hard-coded defaults", async () => {
    const api = await import("@lib/api");
    localStorage.setItem(
      "knot:shell:/tmp/vault",
      JSON.stringify({
        toolMode: "search",
        isToolRailCollapsed: false,
        isContextPanelCollapsed: false,
        isInspectorRailOpen: false,
        contextPanelWidth: 320,
        densityMode: "comfortable",
        showTextLabels: false,
      })
    );
    vi.mocked(api.getAppKeymapSettings).mockResolvedValueOnce({
      keymaps: {
        general: {
          save_note: "Mod-s",
          switch_notes: "Alt-1",
          switch_search: "Alt-2",
          switch_graph: "Alt-3",
        },
        editor: {
          undo: "Mod-z",
          redo: "Mod-Shift-z, Mod-y",
          clear_paragraph: "Mod-Alt-0",
        },
      },
      graph: {
        readability_floor_percent: 70,
      },
    });

    render(<App />);

    await waitFor(() => {
      expect(api.getAppKeymapSettings).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockStoreState.setShellToolMode).toHaveBeenCalledWith("search");
    });
    mockStoreState.setShellToolMode.mockClear();

    fireEvent.keyDown(window, { key: "1", altKey: true });
    fireEvent.keyDown(window, { key: "2", altKey: true });
    fireEvent.keyDown(window, { key: "3", altKey: true });

    expect(mockStoreState.setShellToolMode).toHaveBeenCalledWith("notes");
    expect(mockStoreState.setShellToolMode).toHaveBeenCalledWith("search");
    expect(mockStoreState.setShellToolMode).toHaveBeenCalledWith("graph");
  });

  it("ignores shell shortcuts when no vault is open", () => {
    mockStoreState.vault = null;
    render(<App />);

    fireEvent.keyDown(window, { key: "1", ctrlKey: true });
    expect(mockStoreState.setShellToolMode).not.toHaveBeenCalled();
  });

  it("toggles inspector rail from shell controls", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /inspector/i }));
    expect(mockStoreState.setInspectorRailOpen).toHaveBeenCalledWith(true);
  });

  it("toggles icon label preference from shell controls", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /labels/i }));
    expect(mockStoreState.setShowTextLabels).toHaveBeenCalledWith(true);
  });

  it("toggles context panel when clicking the active tool", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /notes/i }));

    expect(mockStoreState.toggleContextPanel).toHaveBeenCalledTimes(1);
    expect(mockStoreState.setShellToolMode).not.toHaveBeenCalledWith("notes");
  });

  it("forces context panel open when activating required tools", async () => {
    mockStoreState.shell.toolMode = "graph";
    mockStoreState.shell.isContextPanelCollapsed = true;
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /search/i }));

    expect(mockStoreState.setShellToolMode).toHaveBeenCalledWith("search");
    expect(mockStoreState.toggleContextPanel).toHaveBeenCalledTimes(1);
  });

  it("restores graph panel visibility when graph is re-activated", async () => {
    mockStoreState.shell.toolMode = "graph";
    mockStoreState.shell.isContextPanelCollapsed = false;
    const { rerender } = render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Graph" }));
    expect(mockStoreState.toggleContextPanel).toHaveBeenCalledTimes(1);

    rerender(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /notes/i }));
    expect(mockStoreState.toggleContextPanel).toHaveBeenCalledTimes(2);

    rerender(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Graph" }));
    expect(mockStoreState.toggleContextPanel).toHaveBeenCalledTimes(3);
  });

  it("applies comfortable shell class by default", () => {
    const { container } = render(<App />);
    const appShell = container.querySelector(".app");
    expect(appShell).toHaveClass("app--comfortable");
  });

  it("defaults editor surface to sepia and toggles to dark", async () => {
    render(<App />);

    const contentArea = await screen.findByTestId("editor-view");
    expect(contentArea.closest(".content-area")).toHaveClass("content-area--editor-sepia");

    fireEvent.click(screen.getByRole("button", { name: /surface/i }));
    expect(contentArea.closest(".content-area")).toHaveClass("content-area--editor-dark");
  });

  it("remounts editor when selected note path changes", async () => {
    mockStoreState.currentNote = {
      id: "n1",
      path: "a.md",
      title: "A",
      content: "A",
      created_at: 0,
      modified_at: 0,
      word_count: 1,
      headings: [],
      backlinks: [],
    };

    const { rerender } = render(<App />);
    expect(await screen.findByTestId("editor-view")).toBeInTheDocument();
    expect(editorMountCount).toBe(1);
    expect(editorUnmountCount).toBe(0);

    mockStoreState.currentNote = {
      id: "n2",
      path: "b.md",
      title: "B",
      content: "B",
      created_at: 0,
      modified_at: 0,
      word_count: 1,
      headings: [],
      backlinks: [],
    };
    rerender(<App />);

    await waitFor(() => {
      expect(editorMountCount).toBe(2);
      expect(editorUnmountCount).toBe(1);
    });
  });

  it("auto-expands tool rail if legacy collapsed state is hydrated", async () => {
    mockStoreState.shell.isToolRailCollapsed = true;

    render(<App />);

    await waitFor(() => {
      expect(mockStoreState.toggleToolRail).toHaveBeenCalledTimes(1);
    });
  });

  it("opens settings mode from the settings affordance and shows General keymaps first", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /settings/i }));

    expect(await screen.findByRole("heading", { name: /general/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Mod-s")).toBeInTheDocument();
  });

  it("switches settings sections and renders editor keymap fields", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /settings/i }));
    fireEvent.click(await screen.findByRole("button", { name: /editor keymaps/i }));

    expect(await screen.findByDisplayValue("Mod-z")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Mod-Shift-z, Mod-y")).toBeInTheDocument();
  });

  it("triggers reindex action and reports success toast", async () => {
    const api = await import("@lib/api");
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /settings/i }));
    fireEvent.click(await screen.findByRole("button", { name: /maintenance/i }));
    fireEvent.click(await screen.findByRole("button", { name: /reindex vault/i }));

    await waitFor(() => {
      expect(api.reindexVault).toHaveBeenCalledTimes(1);
      expect(mockToastSuccess).toHaveBeenCalled();
    });
  });

});

describe("getEditorMeasureBand (COMP-EDITOR-READING-001 FR-4)", () => {
  it("maps narrow widths to 45ch band", () => {
    expect(getEditorMeasureBand(320)).toBe(45);
    expect(getEditorMeasureBand(759)).toBe(45);
  });

  it("maps medium widths to 54ch band", () => {
    expect(getEditorMeasureBand(760)).toBe(54);
    expect(getEditorMeasureBand(839)).toBe(54);
  });

  it("maps large widths to 62ch band", () => {
    expect(getEditorMeasureBand(840)).toBe(62);
    expect(getEditorMeasureBand(1079)).toBe(62);
  });

  it("maps extra large widths to 70ch band", () => {
    expect(getEditorMeasureBand(1080)).toBe(70);
    expect(getEditorMeasureBand(1800)).toBe(70);
  });
});
