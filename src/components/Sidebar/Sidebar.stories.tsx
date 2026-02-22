import { useEffect } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, mocked, userEvent, waitFor } from "storybook/test";
import { Sidebar } from "./index";
import { useEditorStore, useVaultStore } from "@lib/store";
import * as api from "@lib/api";
import { listen } from "@tauri-apps/api/event";
import type { ExplorerTree, VaultInfo } from "@/types/vault";

// Trace: DESIGN-storybook-sidebar-coverage-2026-02-22
const demoVault: VaultInfo = {
  path: "/tmp/canonical-vault",
  name: "Canonical Vault",
  note_count: 3,
  last_modified: 1_708_700_000,
};

const demoTree: ExplorerTree = {
  hidden_policy: "hide-dotfiles",
  root: {
    path: "",
    name: "canonical",
    expanded: true,
    folders: [
      {
        path: "english-research",
        name: "english-research",
        expanded: true,
        folders: [],
        notes: [
          {
            path: "english-research/language-model-evaluation.md",
            title: "Language Model Evaluation",
            display_title: "Language Model Evaluation",
            modified_at: 1_708_700_000,
            word_count: 120,
          },
          {
            path: "english-research/roadmap-brief.md",
            title: "Roadmap Brief",
            display_title: "Roadmap Brief",
            modified_at: 1_708_700_100,
            word_count: 64,
          },
        ],
      },
    ],
    notes: [],
  },
};
// Trace: DESIGN-storybook-coverage-closure-2026-02-22

type SidebarHarnessArgs = {
  withVault: boolean;
  recentVaults: Array<{ path: string; name: string; opened_at: number }>;
  onOpenVault: () => void;
  onCreateVault: () => void;
  onOpenRecent: (path: string) => void;
  onCloseVault: () => void;
  currentNotePath: string | null;
  dirty: boolean;
  editorContent: string;
};

function SidebarHarness({
  withVault,
  recentVaults,
  onOpenVault,
  onCreateVault,
  onOpenRecent,
  onCloseVault,
  currentNotePath,
  dirty,
  editorContent,
}: SidebarHarnessArgs) {
  useEffect(() => {
    const currentNote =
      currentNotePath === null
        ? null
        : {
            id: "n-current",
            path: currentNotePath,
            title: currentNotePath.endsWith("roadmap-brief.md")
              ? "Roadmap Brief"
              : "Language Model Evaluation",
            content: "# Story content",
            created_at: 1_708_700_000,
            modified_at: 1_708_700_000,
            word_count: 120,
            headings: [],
            backlinks: [],
          };

    useVaultStore.setState((state) => ({
      ...state,
      vault: withVault ? demoVault : null,
      noteList: withVault
        ? [
            {
              id: "n1",
              path: "english-research/language-model-evaluation.md",
              title: "Language Model Evaluation",
              created_at: 1_708_700_000,
              modified_at: 1_708_700_000,
              word_count: 120,
            },
            {
              id: "n2",
              path: "english-research/roadmap-brief.md",
              title: "Roadmap Brief",
              created_at: 1_708_700_000,
              modified_at: 1_708_700_100,
              word_count: 64,
            },
          ]
        : [],
      currentNote,
      isLoading: false,
      error: null,
    }));
    useEditorStore.setState({
      content: editorContent,
      isDirty: dirty,
      cursorPosition: 0,
    });
  }, [currentNotePath, dirty, editorContent, withVault]);

  return (
    <div style={{ width: 360, minHeight: "100vh", borderRight: "1px solid var(--color-border-muted)" }}>
      <Sidebar
        recentVaults={recentVaults}
        onOpenVault={onOpenVault}
        onCreateVault={onCreateVault}
        onOpenRecent={onOpenRecent}
        onCloseVault={onCloseVault}
      />
    </div>
  );
}

const meta = {
  title: "Sidebar/Sidebar",
  component: SidebarHarness,
  args: {
    withVault: true,
    recentVaults: [
      { path: "/tmp/canonical-vault", name: "Canonical Vault", opened_at: 1_708_700_000 },
      { path: "/tmp/work-vault", name: "Work Vault", opened_at: 1_708_690_000 },
    ],
    onOpenVault: fn(),
    onCreateVault: fn(),
    onOpenRecent: fn(),
    onCloseVault: fn(),
    currentNotePath: null,
    dirty: false,
    editorContent: "",
  },
  beforeEach: async () => {
    mocked(api.getExplorerTree).mockResolvedValue(demoTree);
    mocked(api.setFolderExpanded).mockResolvedValue(undefined);
    mocked(api.saveNote).mockResolvedValue(undefined);
    mocked(api.listNotes).mockResolvedValue([]);
    mocked(api.getNote).mockImplementation(async (path: string) => ({
      id: path,
      path,
      title: path.split("/").pop()?.replace(/\.md$/i, "") ?? path,
      content: `# ${path}`,
      created_at: 1_708_700_000,
      modified_at: 1_708_700_000,
      word_count: 3,
      headings: [],
      backlinks: [],
    }));
    mocked(api.createNote).mockResolvedValue({
      id: "new-note",
      path: "english-research/story-note.md",
      title: "story-note",
      content: "# New Note\n\nStart writing...",
      created_at: 1_708_700_000,
      modified_at: 1_708_700_000,
      word_count: 5,
      headings: [],
      backlinks: [],
    });
    mocked(listen).mockResolvedValue(fn());
  },
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof SidebarHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoVaultOpen: Story = {
  args: {
    withVault: false,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("No vault open")).toBeInTheDocument();
  },
};

export const ExplorerTreeLoaded: Story = {
  play: async ({ canvas }) => {
    await waitFor(() => {
      expect(canvas.getByRole("tree", { name: "Notes explorer" })).toBeInTheDocument();
    });
    await expect(canvas.getByRole("button", { name: "New Note" })).toBeInTheDocument();
    await expect(canvas.getByRole("treeitem", { name: "english-research" })).toBeInTheDocument();
  },
};

export const KeyboardFolderToggle: Story = {
  play: async ({ canvas }) => {
    await waitFor(() => {
      expect(canvas.getByRole("tree", { name: "Notes explorer" })).toBeInTheDocument();
    });

    const tree = canvas.getByRole("tree", { name: "Notes explorer" });
    const folder = canvas.getByRole("treeitem", { name: "english-research" });
    folder.focus();
    await userEvent.keyboard("{ArrowLeft}");
    await waitFor(() => {
      expect(api.setFolderExpanded).toHaveBeenCalled();
    });
    await expect(tree).toBeInTheDocument();
  },
};

export const DirtySwitchSavesBeforeOpen: Story = {
  args: {
    currentNotePath: "english-research/language-model-evaluation.md",
    dirty: true,
    editorContent: "# Draft content",
  },
  play: async ({ canvas }) => {
    const originalConfirm = window.confirm;
    window.confirm = () => true;

    try {
      await waitFor(() => {
        expect(canvas.getByRole("tree", { name: "Notes explorer" })).toBeInTheDocument();
      });
      await userEvent.click(canvas.getByRole("treeitem", { name: "Roadmap Brief" }));
      await waitFor(() => {
        expect(api.saveNote).toHaveBeenCalledWith(
          "english-research/language-model-evaluation.md",
          "# Draft content"
        );
      });
      await expect(api.getNote).toHaveBeenCalledWith("english-research/roadmap-brief.md");
    } finally {
      window.confirm = originalConfirm;
    }
  },
};

export const ExplorerContextMenuCreateNote: Story = {
  play: async ({ canvas }) => {
    const originalPrompt = window.prompt;
    window.prompt = () => "story-note";

    try {
      await waitFor(() => {
        expect(canvas.getByRole("tree", { name: "Notes explorer" })).toBeInTheDocument();
      });
      const folder = canvas.getByRole("treeitem", { name: "english-research" });
      folder.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: 120,
          clientY: 120,
        })
      );
      await userEvent.click(canvas.getByRole("button", { name: "New note here" }));
      await waitFor(() => {
        expect(api.createNote).toHaveBeenCalledWith(
          "english-research/story-note.md",
          "# New Note\n\nStart writing..."
        );
      });
    } finally {
      window.prompt = originalPrompt;
    }
  },
};

export const IconOnlyActionAffordances: Story = {
  play: async ({ canvas }) => {
    await waitFor(() => {
      expect(canvas.getByRole("button", { name: "New Note" })).toBeInTheDocument();
    });
    await expect(canvas.getByRole("button", { name: "New Folder" })).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Collapse" })).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Expand" })).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
  },
};

export const ExplorerPanelHasNoSearchBox: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Spec: COMP-EXPLORER-PANEL-SEARCH-001 FR-1/FR-2. Explorer panel intentionally omits search input while SearchBox remains a dedicated tool-mode surface.",
      },
    },
  },
  play: async ({ canvas }) => {
    await waitFor(() => {
      expect(canvas.getByRole("tree", { name: "Notes explorer" })).toBeInTheDocument();
    });
    await expect(canvas.queryByRole("textbox", { name: "Search notes" })).not.toBeInTheDocument();
    await expect(canvas.queryByPlaceholderText("Search notes...")).not.toBeInTheDocument();
  },
};
