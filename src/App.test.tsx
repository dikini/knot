import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import App from "./App";
import { getEditorMeasureBand } from "@lib/editorMeasure";
import { setMarkdownEngineConfig } from "@editor/markdown";

const mockLoadNote = vi.fn();
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
    success: vi.fn(),
    error: vi.fn(),
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

vi.mock("@editor/markdown", () => ({
  setMarkdownEngineConfig: vi.fn(),
}));

vi.mock("@components/Sidebar", () => ({
  Sidebar: () => <div data-testid="sidebar" />,
}));

vi.mock("@components/Editor", () => ({
  Editor: () => {
    useEffect(() => {
      editorMountCount += 1;
      return () => {
        editorUnmountCount += 1;
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

  it("switches shell tool mode with Ctrl/Cmd+1/2/3", () => {
    render(<App />);

    fireEvent.keyDown(window, { key: "1", ctrlKey: true });
    fireEvent.keyDown(window, { key: "2", metaKey: true });
    fireEvent.keyDown(window, { key: "3", ctrlKey: true });

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

  it("defaults markdown engine to next and toggles to legacy", async () => {
    render(<App />);

    const engineToggle = await screen.findByRole("button", { name: /engine:\s*next/i });
    expect(engineToggle).toBeInTheDocument();
    expect(setMarkdownEngineConfig).toHaveBeenCalledWith({
      activeEngine: "next",
      enableLegacyFallback: true,
    });

    fireEvent.click(engineToggle);
    expect(screen.getByRole("button", { name: /engine:\s*legacy/i })).toBeInTheDocument();
    expect(setMarkdownEngineConfig).toHaveBeenCalledWith({
      activeEngine: "legacy",
      enableLegacyFallback: true,
    });
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
