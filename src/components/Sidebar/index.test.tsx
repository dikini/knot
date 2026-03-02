import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
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
const mockCreateYouTubeNoteApi = vi.fn();
const mockRenameNoteApi = vi.fn();
const mockListen = vi.fn();
let treeEventHandler: (() => void) | null = null;

const createDataTransfer = (): DataTransfer =>
  ({
    effectAllowed: "all",
    dropEffect: "move",
    types: [],
    setData: vi.fn(),
    getData: vi.fn(),
    clearData: vi.fn(),
  }) as unknown as DataTransfer;

vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: unknown[]) => mockListen(...args),
}));

vi.mock("@lib/api", () => ({
  getExplorerTree: (...args: unknown[]) => mockGetExplorerTree(...args),
  setFolderExpanded: (...args: unknown[]) => mockSetFolderExpanded(...args),
  createNote: (...args: unknown[]) => mockCreateNoteApi(...args),
  createYouTubeNote: (...args: unknown[]) => mockCreateYouTubeNoteApi(...args),
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
                type_badge: null,
                is_dimmed: false,
              },
            ],
          },
          {
            path: "Archive",
            name: "Archive",
            expanded: false,
            folders: [],
            notes: [
              {
                path: "Archive/ideas.md",
                display_title: "ideas",
                type_badge: null,
                is_dimmed: false,
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
    mockCreateYouTubeNoteApi.mockResolvedValue({
      id: "yt-created",
      path: "Programming/sample-video.youtube.md",
      title: "Sample Video",
      content: "# Sample Video\n\nTranscript",
      created_at: 1,
      modified_at: 1,
      word_count: 2,
      headings: [],
      backlinks: [],
      note_type: "youtube",
      available_modes: { meta: true, source: true, edit: true, view: true },
      metadata: {
        extra: {
          youtube_url: "https://www.youtube.com/watch?v=abc123xyz00",
          youtube_video_id: "abc123xyz00",
        },
      },
      type_badge: "YT",
      media: null,
      is_dimmed: false,
    });
    mockRenameNoteApi.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
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
    expect(screen.getByRole("button", { name: "New YouTube Note" })).toBeInTheDocument();
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

  it("creates a YouTube note inside the selected folder", async () => {
    vi.mocked(window.prompt).mockReturnValue("https://www.youtube.com/watch?v=abc123xyz00");

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
    fireEvent.click(await screen.findByRole("menuitem", { name: "New YouTube note here" }));

    await waitFor(() => {
      expect(mockCreateYouTubeNoteApi).toHaveBeenCalledWith(
        "Programming",
        "https://www.youtube.com/watch?v=abc123xyz00"
      );
    });
    expect(mockSetCurrentNote).toHaveBeenCalledWith(
      expect.objectContaining({ path: "Programming/sample-video.youtube.md", note_type: "youtube" })
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

  it("renders non-markdown type badges for explorer notes", async () => {
    mockGetExplorerTree.mockResolvedValueOnce({
      hidden_policy: "show-all-files",
      root: {
        path: "",
        name: "vault",
        expanded: true,
        folders: [],
        notes: [
          {
            path: "photo.png",
            title: "photo",
            display_title: "photo",
            modified_at: 1,
            word_count: 0,
            type_badge: "PNG",
            is_dimmed: false,
          },
        ],
      },
    });

    render(
      <Sidebar
        recentVaults={[]}
        onOpenVault={vi.fn()}
        onCreateVault={vi.fn()}
        onOpenRecent={vi.fn()}
        onCloseVault={vi.fn()}
      />
    );

    expect(await screen.findByText("photo")).toBeInTheDocument();
    expect(screen.getByText("PNG")).toBeInTheDocument();
  });

  it("dims unknown file types in the explorer", async () => {
    mockGetExplorerTree.mockResolvedValueOnce({
      hidden_policy: "show-all-files",
      root: {
        path: "",
        name: "vault",
        expanded: true,
        folders: [],
        notes: [
          {
            path: "archive.bin",
            title: "archive",
            display_title: "archive",
            modified_at: 1,
            word_count: 0,
            type_badge: "BIN",
            is_dimmed: true,
          },
        ],
      },
    });

    render(
      <Sidebar
        recentVaults={[]}
        onOpenVault={vi.fn()}
        onCreateVault={vi.fn()}
        onOpenRecent={vi.fn()}
        onCloseVault={vi.fn()}
      />
    );

    const noteRow = (await screen.findByText("archive")).closest("li");
    expect(noteRow).toHaveClass("explorer-tree__note--dimmed");
    expect(screen.getByText("BIN")).toBeInTheDocument();
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

  it("moves a note when dropped onto a folder row", async () => {
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

    const draggedNote = (await screen.findByText("daily")).closest("li");
    const targetFolder = await screen.findByRole("treeitem", { name: "Archive" });
    expect(draggedNote).not.toBeNull();

    const dataTransfer = createDataTransfer();
    fireEvent.dragStart(draggedNote!, { dataTransfer });
    fireEvent.dragEnter(targetFolder, { dataTransfer });
    fireEvent.dragOver(targetFolder, { dataTransfer });
    fireEvent.drop(targetFolder, { dataTransfer });

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

  it("moves a note into the target note parent folder when dropped onto a note row", async () => {
    render(
      <Sidebar
        recentVaults={[]}
        onOpenVault={vi.fn()}
        onCreateVault={vi.fn()}
        onOpenRecent={vi.fn()}
        onCloseVault={vi.fn()}
      />
    );

    const draggedNote = (await screen.findByText("daily")).closest("li");
    const archiveFolder = await screen.findByRole("treeitem", { name: "Archive" });
    fireEvent.click(archiveFolder.querySelector(".explorer-tree__folder-row") ?? archiveFolder);
    const targetNote = (await screen.findByText("ideas")).closest("li");
    expect(draggedNote).not.toBeNull();
    expect(targetNote).not.toBeNull();

    const dataTransfer = createDataTransfer();
    fireEvent.dragStart(draggedNote!, { dataTransfer });
    fireEvent.dragEnter(targetNote!, { dataTransfer });
    fireEvent.dragOver(targetNote!, { dataTransfer });
    fireEvent.drop(targetNote!, { dataTransfer });

    await waitFor(() => {
      expect(mockRenameNoteApi).toHaveBeenCalledWith(
        "Programming/daily.md",
        "Archive/daily.md"
      );
    });
  });

  it("ignores drag-drop moves into the current parent folder", async () => {
    render(
      <Sidebar
        recentVaults={[]}
        onOpenVault={vi.fn()}
        onCreateVault={vi.fn()}
        onOpenRecent={vi.fn()}
        onCloseVault={vi.fn()}
      />
    );

    const draggedNote = (await screen.findByText("daily")).closest("li");
    const targetFolder = await screen.findByRole("treeitem", { name: "Programming" });
    expect(draggedNote).not.toBeNull();

    const dataTransfer = createDataTransfer();
    fireEvent.dragStart(draggedNote!, { dataTransfer });
    fireEvent.dragEnter(targetFolder, { dataTransfer });
    fireEvent.dragOver(targetFolder, { dataTransfer });
    fireEvent.drop(targetFolder, { dataTransfer });

    await waitFor(() => {
      expect(mockRenameNoteApi).not.toHaveBeenCalled();
    });
    expect(mockSetCurrentNote).not.toHaveBeenCalled();
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

    await waitFor(
      () => {
        expect(mockGetExplorerTree.mock.calls.length).toBeGreaterThanOrEqual(2);
      },
      { timeout: 1000 }
    );
  });

  it("auto-expands a collapsed folder after a short drag hover delay", async () => {
    render(
      <Sidebar
        recentVaults={[]}
        onOpenVault={vi.fn()}
        onCreateVault={vi.fn()}
        onOpenRecent={vi.fn()}
        onCloseVault={vi.fn()}
      />
    );

    const draggedNote = (await screen.findByText("daily")).closest("li");
    const targetFolder = await screen.findByRole("treeitem", { name: "Archive" });
    expect(draggedNote).not.toBeNull();
    expect(targetFolder).toHaveAttribute("aria-expanded", "false");

    vi.useFakeTimers();
    const dataTransfer = createDataTransfer();
    fireEvent.dragStart(draggedNote!, { dataTransfer });
    fireEvent.dragEnter(targetFolder, { dataTransfer });

    await act(async () => {
      vi.advanceTimersByTime(600);
      await Promise.resolve();
    });

    expect(mockSetFolderExpanded).toHaveBeenCalledWith("Archive", true);
  });

  it("does not auto-expand a collapsed folder when drag leaves before the delay", async () => {
    render(
      <Sidebar
        recentVaults={[]}
        onOpenVault={vi.fn()}
        onCreateVault={vi.fn()}
        onOpenRecent={vi.fn()}
        onCloseVault={vi.fn()}
      />
    );

    const draggedNote = (await screen.findByText("daily")).closest("li");
    const targetFolder = await screen.findByRole("treeitem", { name: "Archive" });
    expect(draggedNote).not.toBeNull();

    vi.useFakeTimers();
    const dataTransfer = createDataTransfer();
    fireEvent.dragStart(draggedNote!, { dataTransfer });
    fireEvent.dragEnter(targetFolder, { dataTransfer });
    fireEvent.dragLeave(targetFolder, { dataTransfer });

    await act(async () => {
      vi.advanceTimersByTime(600);
      await Promise.resolve();
    });

    expect(mockSetFolderExpanded).not.toHaveBeenCalledWith("Archive", true);
  });

  it("creates a YouTube note when a YouTube URL is dropped on a folder row", async () => {
    render(
      <Sidebar
        recentVaults={[]}
        onOpenVault={vi.fn()}
        onCreateVault={vi.fn()}
        onOpenRecent={vi.fn()}
        onCloseVault={vi.fn()}
      />
    );

    const targetFolder = await screen.findByRole("treeitem", { name: "Programming" });
    const dataTransfer = createDataTransfer();
    Object.assign(dataTransfer, {
      types: ["text/uri-list"],
      getData: vi.fn((type: string) =>
        type === "text/uri-list" ? "https://www.youtube.com/watch?v=abc123xyz00" : ""
      ),
    });

    fireEvent.dragEnter(targetFolder, { dataTransfer });
    fireEvent.dragOver(targetFolder, { dataTransfer });
    fireEvent.drop(targetFolder, { dataTransfer });

    await waitFor(() => {
      expect(mockCreateYouTubeNoteApi).toHaveBeenCalledWith(
        "Programming",
        "https://www.youtube.com/watch?v=abc123xyz00"
      );
    });
  });
});
