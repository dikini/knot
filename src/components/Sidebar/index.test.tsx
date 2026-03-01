import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
const mockVaultStoreState = {
  vault: { path: "/tmp/vault", name: "vault", note_count: 1, last_modified: 1 },
  noteList: [],
  currentNote: null as null | {
    id: string;
    path: string;
    title: string;
    content: string;
    created_at: number;
    modified_at: number;
    word_count: number;
    headings: [];
    backlinks: [];
  },
  loadNote: mockLoadNote,
  saveCurrentNote: mockSaveCurrentNote,
  isLoading: false,
  setCurrentNote: mockSetCurrentNote,
};

vi.mock("@lib/store", () => ({
  useVaultStore: Object.assign(
    () => mockVaultStoreState,
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
const mockCreateNoteApi = vi.fn();
const mockRenameNoteApi = vi.fn();
const mockListen = vi.fn();
let treeEventHandler: (() => void) | null = null;

vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: unknown[]) => mockListen(...args),
}));

vi.mock("@lib/api", () => ({
  getExplorerTree: (...args: unknown[]) => mockGetExplorerTree(...args),
  setFolderExpanded: (...args: unknown[]) => mockSetFolderExpanded(...args),
  createNote: (...args: unknown[]) => mockCreateNoteApi(...args),
  createDirectory: vi.fn(),
  renameDirectory: vi.fn(),
  renameNote: (...args: unknown[]) => mockRenameNoteApi(...args),
  deleteDirectory: vi.fn(),
  deleteNote: vi.fn(),
}));

describe("Sidebar Explorer M1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    treeEventHandler = null;
    mockVaultStoreState.currentNote = null;
    window.prompt = vi.fn();
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
            notes: [
              {
                path: "Programming/daily.md",
                display_title: "daily",
              },
            ],
          },
        ],
        notes: [],
      },
    });
    mockCreateNoteApi.mockResolvedValue({
      id: "created",
      path: "Programming/draft.md",
      title: "draft",
      content: "# New Note\n\nStart writing...",
      created_at: 1,
      modified_at: 1,
      word_count: 3,
      headings: [],
      backlinks: [],
    });
    mockRenameNoteApi.mockResolvedValue(undefined);
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
    expect(screen.queryByText("+ New Note")).not.toBeInTheDocument();
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

    expect(await screen.findByRole("menuitem", { name: "New note here" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "New folder" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Rename folder" })).toBeInTheDocument();
  });

  it("creates a note inside the selected folder", async () => {
    vi.mocked(window.prompt).mockReturnValue("draft");

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
    fireEvent.click(await screen.findByRole("menuitem", { name: "New note here" }));

    await waitFor(() => {
      expect(mockCreateNoteApi).toHaveBeenCalledWith(
        "Programming/draft.md",
        "# New Note\n\nStart writing..."
      );
    });
    expect(mockSetCurrentNote).toHaveBeenCalledWith(
      expect.objectContaining({ path: "Programming/draft.md" })
    );
  });

  it("shows separate note rename and move actions", async () => {
    render(
      <Sidebar
        recentVaults={[]}
        onOpenVault={vi.fn()}
        onCreateVault={vi.fn()}
        onOpenRecent={vi.fn()}
        onCloseVault={vi.fn()}
      />
    );

    const noteButton = (await screen.findByText("daily")).closest("li");
    expect(noteButton).not.toBeNull();
    fireEvent.contextMenu(noteButton!);

    expect(await screen.findByRole("menuitem", { name: "Rename file" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Rename note" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Move note" })).toBeInTheDocument();
  });

  it("renames the active note file inside its current directory", async () => {
    vi.mocked(window.prompt).mockReturnValue("renamed.md");
    mockVaultStoreState.currentNote = {
      id: "note-1",
      path: "Programming/daily.md",
      title: "daily",
      content: "# Daily",
      created_at: 1,
      modified_at: 1,
      word_count: 1,
      headings: [],
      backlinks: [],
    };

    render(
      <Sidebar
        recentVaults={[]}
        onOpenVault={vi.fn()}
        onCreateVault={vi.fn()}
        onOpenRecent={vi.fn()}
        onCloseVault={vi.fn()}
      />
    );

    const noteButton = (await screen.findByText("daily")).closest("li");
    expect(noteButton).not.toBeNull();
    fireEvent.contextMenu(noteButton!);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Rename file" }));

    await waitFor(() => {
      expect(mockRenameNoteApi).toHaveBeenCalledWith(
        "Programming/daily.md",
        "Programming/renamed.md"
      );
    });
    expect(mockSetCurrentNote).toHaveBeenCalledWith(
      expect.objectContaining({ path: "Programming/renamed.md", title: "renamed" })
    );
  });

  it("renames the active note title while preserving the directory", async () => {
    vi.mocked(window.prompt).mockReturnValue("weekly-plan");
    mockVaultStoreState.currentNote = {
      id: "note-1",
      path: "Programming/daily.md",
      title: "daily",
      content: "# Daily",
      created_at: 1,
      modified_at: 1,
      word_count: 1,
      headings: [],
      backlinks: [],
    };

    render(
      <Sidebar
        recentVaults={[]}
        onOpenVault={vi.fn()}
        onCreateVault={vi.fn()}
        onOpenRecent={vi.fn()}
        onCloseVault={vi.fn()}
      />
    );

    const noteButton = (await screen.findByText("daily")).closest("li");
    expect(noteButton).not.toBeNull();
    fireEvent.contextMenu(noteButton!);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Rename note" }));

    await waitFor(() => {
      expect(mockRenameNoteApi).toHaveBeenCalledWith(
        "Programming/daily.md",
        "Programming/weekly-plan.md"
      );
    });
    expect(mockSetCurrentNote).toHaveBeenCalledWith(
      expect.objectContaining({ path: "Programming/weekly-plan.md", title: "weekly-plan" })
    );
  });

  it("moves the active note to a different directory while preserving basename", async () => {
    vi.mocked(window.prompt).mockReturnValue("Archive");
    mockVaultStoreState.currentNote = {
      id: "note-1",
      path: "Programming/daily.md",
      title: "daily",
      content: "# Daily",
      created_at: 1,
      modified_at: 1,
      word_count: 1,
      headings: [],
      backlinks: [],
    };

    render(
      <Sidebar
        recentVaults={[]}
        onOpenVault={vi.fn()}
        onCreateVault={vi.fn()}
        onOpenRecent={vi.fn()}
        onCloseVault={vi.fn()}
      />
    );

    const noteButton = (await screen.findByText("daily")).closest("li");
    expect(noteButton).not.toBeNull();
    fireEvent.contextMenu(noteButton!);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Move note" }));

    await waitFor(() => {
      expect(mockRenameNoteApi).toHaveBeenCalledWith(
        "Programming/daily.md",
        "Archive/daily.md"
      );
    });
    expect(mockSetCurrentNote).toHaveBeenCalledWith(
      expect.objectContaining({ path: "Archive/daily.md", title: "daily" })
    );
  });

  it("supports keyboard navigation and folder toggle via arrows", async () => {
    // BUG-COMP-FRONTEND-001: wrap keyboard-triggered state updates in act for stable React 18 tests.
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

    await screen.findByRole("tree", { name: "Notes explorer" });
    const folderButton = await screen.findByRole("treeitem", { name: "Programming" });
    act(() => {
      folderButton.focus();
      fireEvent.keyDown(folderButton, { key: "ArrowLeft", code: "ArrowLeft", keyCode: 37 });
    });

    await waitFor(() => {
      expect(folderButton).toHaveAttribute("aria-expanded", "false");
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
