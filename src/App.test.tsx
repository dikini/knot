import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "./App";

const mockLoadNote = vi.fn();
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
  getRecentVaults: vi.fn().mockResolvedValue([]),
  isVaultOpen: vi.fn().mockResolvedValue(false),
  getVaultInfo: vi.fn().mockResolvedValue(null),
  syncExternalChanges: vi.fn().mockResolvedValue(undefined),
  openVaultDialog: vi.fn(),
  addRecentVault: vi.fn(),
  createVaultDialog: vi.fn(),
  openVault: vi.fn(),
}));

vi.mock("@lib/store", () => ({
  useVaultStore: () => mockStoreState,
}));

vi.mock("@components/Sidebar", () => ({
  Sidebar: () => <div data-testid="sidebar" />,
}));

vi.mock("@components/Editor", () => ({
  Editor: () => <div data-testid="editor-view">Editor</div>,
}));

vi.mock("@components/GraphView", () => ({
  GraphView: ({ onNodeClick }: { onNodeClick: (path: string) => void }) => (
    <div data-testid="graph-view">
      Graph
      <button onClick={() => onNodeClick("note1.md")}>Open Note 1</button>
    </div>
  ),
}));

describe("App Graph Toggle (COMP-GRAPH-UI-001 FR-4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
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
    };
  });

  it("shows graph toggle when a vault is open and switches views", async () => {
    render(<App />);

    expect(await screen.findByTestId("editor-view")).toBeInTheDocument();
    const graphToggle = screen.getByRole("button", { name: /graph view/i });
    fireEvent.click(graphToggle);

    expect(screen.getByTestId("graph-view")).toBeInTheDocument();
    expect(screen.queryByTestId("editor-view")).not.toBeInTheDocument();
  });

  it("hides graph toggle when no vault is open", () => {
    mockStoreState.vault = null;
    render(<App />);

    expect(screen.queryByRole("button", { name: /graph view/i })).not.toBeInTheDocument();
  });

  it("loads note from graph click and returns to editor view", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /graph view/i }));
    fireEvent.click(await screen.findByRole("button", { name: /open note 1/i }));

    await waitFor(() => {
      expect(mockLoadNote).toHaveBeenCalledWith("note1.md");
      expect(screen.getByTestId("editor-view")).toBeInTheDocument();
    });
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
      expect(screen.getByRole("button", { name: /graph view/i })).toBeInTheDocument();
    });

    // Switch store state to vault B and rerender.
    mockStoreState.vault = { path: vaultB, name: "vault-b", note_count: 0, last_modified: 0 };
    rerender(<App />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /editor view/i })).toBeInTheDocument();
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
      })
    );

    mockStoreState.vault = { path: vaultA, name: "vault-a", note_count: 0, last_modified: 0 };
    const { rerender } = render(<App />);

    await waitFor(() => {
      expect(mockStoreState.setShellToolMode).toHaveBeenCalledWith("graph");
      expect(mockStoreState.setContextPanelWidth).toHaveBeenCalledWith(480);
      expect(mockStoreState.setDensityMode).toHaveBeenCalledWith("adaptive");
    });

    mockStoreState.vault = { path: vaultB, name: "vault-b", note_count: 0, last_modified: 0 };
    rerender(<App />);

    await waitFor(() => {
      expect(mockStoreState.setShellToolMode).toHaveBeenCalledWith("search");
      expect(mockStoreState.setContextPanelWidth).toHaveBeenCalledWith(360);
      expect(mockStoreState.setDensityMode).toHaveBeenCalledWith("comfortable");
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
});
