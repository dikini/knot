import { useEffect } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, mocked, userEvent, waitFor } from "storybook/test";
import { Sidebar } from "./index";
import { useEditorStore, useVaultStore } from "@lib/store";
import { getExplorerTree, setFolderExpanded } from "@lib/api";
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
        ],
      },
    ],
    notes: [],
  },
};

type SidebarHarnessArgs = {
  withVault: boolean;
  recentVaults: Array<{ path: string; name: string; opened_at: number }>;
  onOpenVault: () => void;
  onCreateVault: () => void;
  onOpenRecent: (path: string) => void;
  onCloseVault: () => void;
};

function SidebarHarness({
  withVault,
  recentVaults,
  onOpenVault,
  onCreateVault,
  onOpenRecent,
  onCloseVault,
}: SidebarHarnessArgs) {
  useEffect(() => {
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
          ]
        : [],
      currentNote: null,
      isLoading: false,
      error: null,
    }));
    useEditorStore.setState({
      content: "",
      isDirty: false,
      cursorPosition: 0,
    });
  }, [withVault]);

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
  },
  beforeEach: async () => {
    mocked(getExplorerTree).mockResolvedValue(demoTree);
    mocked(setFolderExpanded).mockResolvedValue(undefined);
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
      expect(setFolderExpanded).toHaveBeenCalled();
    });
    await expect(tree).toBeInTheDocument();
  },
};
