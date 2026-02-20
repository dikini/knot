import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "./App";

const mockLoadNote = vi.fn();
const mockStoreState: {
  vault: { path: string; name: string; note_count: number; last_modified: number } | null;
  isLoading: boolean;
  setVault: ReturnType<typeof vi.fn>;
  closeVault: ReturnType<typeof vi.fn>;
  loadNotes: ReturnType<typeof vi.fn>;
  loadNote: typeof mockLoadNote;
} = {
  vault: { path: "/tmp/vault", name: "vault", note_count: 0, last_modified: 0 },
  isLoading: false,
  setVault: vi.fn(),
  closeVault: vi.fn(),
  loadNotes: vi.fn(),
  loadNote: mockLoadNote,
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
});
