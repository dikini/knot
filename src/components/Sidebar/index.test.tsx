import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Sidebar } from "./index";

vi.mock("@components/VaultSwitcher", () => ({
  VaultSwitcher: () => <div data-testid="vault-switcher" />,
}));

vi.mock("@components/SearchBox", () => ({
  SearchBox: () => <div data-testid="search-box" />,
}));

const mockLoadNote = vi.fn();
const mockSaveCurrentNote = vi.fn();
const mockSetCurrentNote = vi.fn();
const mockLoadNotes = vi.fn();

vi.mock("@lib/store", () => ({
  useVaultStore: Object.assign(
    () => ({
      vault: { path: "/tmp/vault", name: "vault", note_count: 1, last_modified: 1 },
      noteList: [],
      currentNote: null,
      loadNote: mockLoadNote,
      saveCurrentNote: mockSaveCurrentNote,
      isLoading: false,
      setCurrentNote: mockSetCurrentNote,
    }),
    {
      getState: () => ({
        loadNotes: mockLoadNotes,
      }),
    }
  ),
  useEditorStore: () => ({
    isDirty: false,
    content: "",
  }),
}));

const mockGetExplorerTree = vi.fn();
const mockSetFolderExpanded = vi.fn();
const mockLoadNoteApi = vi.fn();
const mockListen = vi.fn();
let treeEventHandler: (() => void) | null = null;

vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: unknown[]) => mockListen(...args),
}));

vi.mock("@lib/api", () => ({
  getExplorerTree: (...args: unknown[]) => mockGetExplorerTree(...args),
  setFolderExpanded: (...args: unknown[]) => mockSetFolderExpanded(...args),
  createNote: (...args: unknown[]) => mockLoadNoteApi(...args),
  createDirectory: vi.fn(),
  renameDirectory: vi.fn(),
  renameNote: vi.fn(),
  deleteDirectory: vi.fn(),
  deleteNote: vi.fn(),
}));

describe("Sidebar Explorer M1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    treeEventHandler = null;
    mockListen.mockResolvedValue(() => {});
    mockListen.mockImplementation((_eventName: string, handler: () => void) => {
      treeEventHandler = handler;
      return Promise.resolve(() => {});
    });
    mockGetExplorerTree.mockResolvedValue({
      hidden_policy: "hide-dotfiles",
      root: {
        path: "",
        name: "vault",
        expanded: true,
        folders: [
          {
            path: "Programming",
            name: "Programming",
            expanded: true,
            folders: [],
            notes: [],
          },
        ],
        notes: [],
      },
    });
  });

  it("renders top explorer action icons", async () => {
    render(
      <Sidebar
        recentVaults={[]}
        onOpenVault={vi.fn()}
        onCreateVault={vi.fn()}
        onOpenRecent={vi.fn()}
        onCloseVault={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "New Note" })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "New Folder" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collapse" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
  });

  it("opens folder context menu on right click", async () => {
    render(
      <Sidebar
        recentVaults={[]}
        onOpenVault={vi.fn()}
        onCreateVault={vi.fn()}
        onOpenRecent={vi.fn()}
        onCloseVault={vi.fn()}
      />
    );

    const folderButton = await screen.findByRole("treeitem", { name: "Programming" });
    fireEvent.contextMenu(folderButton);

    expect(await screen.findByRole("button", { name: "New note here" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New folder" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rename folder" })).toBeInTheDocument();
  });

  it("supports keyboard navigation and folder toggle via arrows", async () => {
    mockSetFolderExpanded.mockResolvedValue(undefined);

    render(
      <Sidebar
        recentVaults={[]}
        onOpenVault={vi.fn()}
        onCreateVault={vi.fn()}
        onOpenRecent={vi.fn()}
        onCloseVault={vi.fn()}
      />
    );

    const tree = await screen.findByRole("tree", { name: "Notes explorer" });
    const folderButton = await screen.findByRole("treeitem", { name: "Programming" });
    folderButton.focus();
    fireEvent.keyDown(tree, { key: "ArrowLeft" });

    await waitFor(() => {
      expect(mockSetFolderExpanded).toHaveBeenCalledWith("Programming", false);
    });
  });

  it("refreshes explorer tree on vault tree-changed event", async () => {
    render(
      <Sidebar
        recentVaults={[]}
        onOpenVault={vi.fn()}
        onCreateVault={vi.fn()}
        onOpenRecent={vi.fn()}
        onCloseVault={vi.fn()}
      />
    );

    await screen.findByRole("tree", { name: "Notes explorer" });
    expect(mockListen).toHaveBeenCalledWith("vault://tree-changed", expect.any(Function));
    expect(treeEventHandler).toBeTruthy();

    treeEventHandler?.();

    await waitFor(() => {
      expect(mockGetExplorerTree.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });
});
