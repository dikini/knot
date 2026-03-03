import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, mocked, userEvent, waitFor } from "storybook/test";
import { listen } from "@tauri-apps/api/event";
import App from "./App";
import { useEditorStore, useVaultStore, type ShellState } from "@lib/store";
import * as api from "@lib/api";
import type { GraphLayout, NoteData, NoteSummary, VaultInfo } from "@/types/vault";

// Trace: DESIGN-storybook-app-shell-coverage-2026-02-22
const baseShell: ShellState = {
  toolMode: "notes",
  isToolRailCollapsed: false,
  isContextPanelCollapsed: false,
  isInspectorRailOpen: false,
  contextPanelWidth: 320,
  densityMode: "comfortable",
  showTextLabels: false,
};

const demoVault: VaultInfo = {
  path: "/tmp/canonical-vault",
  name: "Canonical Vault",
  note_count: 2,
  last_modified: 1_708_700_000,
};

const demoNotes: NoteSummary[] = [
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
    path: "product-docs/roadmap-brief.md",
    title: "Roadmap Brief",
    created_at: 1_708_700_000,
    modified_at: 1_708_700_000,
    word_count: 80,
  },
];

const demoCurrentNote: NoteData = {
  id: "n1",
  path: "english-research/language-model-evaluation.md",
  title: "Language Model Evaluation",
  content: "# Language Model Evaluation\n\nStorybook app-shell note.",
  created_at: 1_708_700_000,
  modified_at: 1_708_700_000,
  word_count: 120,
  headings: [],
  backlinks: [],
};

const demoLayout: GraphLayout = {
  nodes: [
    { id: demoCurrentNote.path, label: "Language Model Evaluation", x: 220, y: 120 },
    { id: "product-docs/roadmap-brief.md", label: "Roadmap Brief", x: 380, y: 220 },
  ],
  edges: [{ source: demoCurrentNote.path, target: "product-docs/roadmap-brief.md" }],
};

const demoAppKeymapSettings = {
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
} satisfies Awaited<ReturnType<typeof api.getAppKeymapSettings>>;

const demoUiAutomationSettings = {
  enabled: false,
  groups: {
    navigation: false,
    screenshots: false,
    behaviors: false,
  },
} satisfies Awaited<ReturnType<typeof api.getUiAutomationSettings>>;

type AppStoryArgs = {
  vault: VaultInfo | null;
  noteList: NoteSummary[];
  currentNote: NoteData | null;
  shell: Partial<ShellState>;
  editorContent: string;
  editorDirty: boolean;
  preserveLocalStorage?: boolean;
};

function setupStores(args: AppStoryArgs) {
  useVaultStore.setState((state) => ({
    ...state,
    vault: args.vault,
    noteList: args.noteList,
    currentNote: args.currentNote,
    isLoading: false,
    error: null,
    shell: { ...baseShell, ...args.shell },
  }));
  useEditorStore.setState({
    content: args.editorContent,
    isDirty: args.editorDirty,
    cursorPosition: 0,
  });
}

const meta: Meta<AppStoryArgs> = {
  title: "App/Shell",
  component: App,
  args: {
    vault: null,
    noteList: [],
    currentNote: null,
    shell: {},
    editorContent: "",
    editorDirty: false,
    preserveLocalStorage: false,
  },
  render: (args) => {
    if (!args.preserveLocalStorage) {
      localStorage.clear();
    }
    setupStores(args);
    return <App />;
  },
  beforeEach: async () => {
    mocked(api.getRecentVaults).mockResolvedValue([
      { path: "/tmp/canonical-vault", name: "Canonical Vault", opened_at: 1_708_700_000 },
    ]);
    mocked(api.isVaultOpen).mockResolvedValue(false);
    mocked(api.getVaultInfo).mockResolvedValue(null);
    mocked(api.syncExternalChanges).mockResolvedValue(undefined);
    mocked(api.syncUiAutomationRegistry).mockResolvedValue(undefined);
    mocked(api.syncUiAutomationState).mockResolvedValue(undefined);
    mocked(api.completeUiAutomationRequest).mockResolvedValue(undefined);
    mocked(api.getAppKeymapSettings).mockResolvedValue(demoAppKeymapSettings);
    mocked(api.updateAppKeymapSettings).mockResolvedValue(demoAppKeymapSettings);
    mocked(api.getUiAutomationSettings).mockResolvedValue(demoUiAutomationSettings);
    mocked(api.updateUiAutomationSettings).mockResolvedValue(demoUiAutomationSettings);
    mocked(api.getGraphLayout).mockResolvedValue(demoLayout);
    mocked(api.openVaultDialog).mockRejectedValue(new Error("cancelled"));
    mocked(api.createVaultDialog).mockRejectedValue(new Error("cancelled"));
    mocked(api.openVault).mockRejectedValue(new Error("not used in story"));
    mocked(api.addRecentVault).mockResolvedValue(undefined);
    mocked(api.saveNote).mockResolvedValue(undefined);
    mocked(api.setUnsavedChanges).mockResolvedValue(undefined);
    mocked(api.listNotes).mockResolvedValue(demoNotes);
    mocked(api.getNote).mockResolvedValue(demoCurrentNote);
    mocked(listen).mockResolvedValue(() => undefined);
  },
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<AppStoryArgs>;

export const NoVaultOpen: Story = {
  args: {
    vault: null,
    noteList: [],
    currentNote: null,
    shell: {},
    editorContent: "",
    editorDirty: false,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: "Welcome to Knot" })).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Open Existing Vault" })).toBeInTheDocument();
  },
};

export const VaultOpenNoNoteSelected: Story = {
  args: {
    vault: demoVault,
    noteList: demoNotes,
    currentNote: null,
    shell: { toolMode: "notes", isContextPanelCollapsed: false },
    editorContent: "",
    editorDirty: false,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Graph mode" })).toBeInTheDocument();
    await expect(canvas.getByText("No note selected")).toBeInTheDocument();
  },
};

export const EditorActive: Story = {
  args: {
    vault: demoVault,
    noteList: demoNotes,
    currentNote: demoCurrentNote,
    shell: { toolMode: "notes", isContextPanelCollapsed: false },
    editorContent: demoCurrentNote.content,
    editorDirty: false,
  },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "Language Model Evaluation" })
    ).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Graph mode" })).toBeInTheDocument();
  },
};

export const GraphActive: Story = {
  args: {
    vault: demoVault,
    noteList: demoNotes,
    currentNote: demoCurrentNote,
    shell: { toolMode: "graph", isContextPanelCollapsed: false, showTextLabels: true },
    editorContent: demoCurrentNote.content,
    editorDirty: false,
  },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Graph mode" }));
    await waitFor(() => {
      expect(canvas.getByRole("img", { name: "Note link graph" })).toBeInTheDocument();
    });
    await expect(canvas.getByRole("button", { name: "Edit note" })).toBeInTheDocument();
  },
};

export const AdaptiveLayoutRecovery: Story = {
  args: {
    vault: demoVault,
    noteList: demoNotes,
    currentNote: demoCurrentNote,
    shell: {
      toolMode: "graph",
      densityMode: "adaptive",
      isContextPanelCollapsed: true,
      showTextLabels: true,
      isInspectorRailOpen: true,
      contextPanelWidth: 420,
    },
    editorContent: demoCurrentNote.content,
    editorDirty: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Specs: COMP-UI-LAYOUT-002, COMP-LAYOUT-RECOVERY-001, COMP-GRAPH-UI-CONTINUITY-003. Restores adaptive density, collapsed context panel, labels enabled, and open inspector from shell state.",
      },
    },
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelector(".app--adaptive")).not.toBeNull();
    await expect(
      canvas.queryByRole("complementary", { name: "Context panel" })
    ).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Graph mode" }));
    await expect(canvas.getByRole("button", { name: "Edit note" })).toBeInTheDocument();
    await expect(canvas.getByRole("complementary", { name: "Inspector rail" })).toBeInTheDocument();
  },
};

export const NoCustomWindowControlButtons: Story = {
  args: {
    vault: demoVault,
    noteList: demoNotes,
    currentNote: demoCurrentNote,
    shell: { toolMode: "notes" },
    editorContent: demoCurrentNote.content,
    editorDirty: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Spec: COMP-WINDOW-STARTUP-003 FR-3. Confirms app chrome does not add custom minimize/maximize/close controls and relies on native OS window controls.",
      },
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole("button", { name: /minimize/i })).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: /maximize/i })).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: /close window/i })).not.toBeInTheDocument();
  },
};

export const OpenVaultErrorToast: Story = {
  args: {
    vault: null,
    noteList: [],
    currentNote: null,
    shell: {},
    editorContent: "",
    editorDirty: false,
  },
  beforeEach: async () => {
    mocked(api.openVaultDialog).mockRejectedValueOnce(new Error("open failed"));
  },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Open Existing Vault" }));
    await waitFor(() => {
      expect(canvas.getByText("open failed")).toBeInTheDocument();
    });
  },
};

export const OpenRecentVaultSuccess: Story = {
  args: {
    vault: null,
    noteList: [],
    currentNote: null,
    shell: {},
    editorContent: "",
    editorDirty: false,
  },
  beforeEach: async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    mocked(api.getRecentVaults).mockResolvedValue([
      { path: "/tmp/today-vault", name: "Today Vault", opened_at: nowSec - 60 },
      { path: "/tmp/yesterday-vault", name: "Yesterday Vault", opened_at: nowSec - 86400 },
      { path: "/tmp/older-vault", name: "Older Vault", opened_at: nowSec - 86400 * 8 },
    ]);
    mocked(api.openVault).mockResolvedValue({
      ...demoVault,
      path: "/tmp/today-vault",
      name: "Today Vault",
    });
  },
  play: async ({ canvas }) => {
    await waitFor(() => {
      expect(canvas.getByText("Today Vault")).toBeInTheDocument();
    });
    await expect(canvas.getByText("Yesterday")).toBeInTheDocument();
    await userEvent.click(canvas.getByText("Today Vault"));
    await waitFor(() => {
      expect(canvas.getByText('Opened vault "Today Vault"')).toBeInTheDocument();
    });
  },
};

export const SearchModeSelectResult: Story = {
  args: {
    vault: demoVault,
    noteList: demoNotes,
    currentNote: demoCurrentNote,
    shell: { toolMode: "notes", isContextPanelCollapsed: false, showTextLabels: true },
    editorContent: demoCurrentNote.content,
    editorDirty: false,
  },
  beforeEach: async () => {
    mocked(api.getNote).mockResolvedValueOnce({
      ...demoCurrentNote,
      id: "n2",
      path: "product-docs/roadmap-brief.md",
      title: "Roadmap Brief",
      content: "# Roadmap Brief",
    });
  },
  play: async ({ canvas }) => {
    await userEvent.keyboard("{Control>}2{/Control}");
    await waitFor(() => {
      expect(canvas.getByRole("textbox", { name: "Search notes" })).toBeInTheDocument();
    });
    await userEvent.click(canvas.getByRole("button", { name: "Roadmap Brief" }));
    await waitFor(() => {
      expect(api.getNote).toHaveBeenCalledWith("product-docs/roadmap-brief.md");
    });
  },
};

export const HydratesPersistedShellAndView: Story = {
  args: {
    preserveLocalStorage: true,
    vault: demoVault,
    noteList: demoNotes,
    currentNote: demoCurrentNote,
    shell: { toolMode: "notes", isContextPanelCollapsed: false, showTextLabels: false },
    editorContent: demoCurrentNote.content,
    editorDirty: false,
  },
  beforeEach: async () => {
    localStorage.setItem("knot:view-mode:/tmp/canonical-vault", "graph");
    localStorage.setItem(
      "knot:shell:/tmp/canonical-vault",
      JSON.stringify({
        toolMode: "graph",
        isContextPanelCollapsed: true,
        isInspectorRailOpen: true,
        contextPanelWidth: 460,
        densityMode: "adaptive",
        showTextLabels: true,
      })
    );
  },
  play: async ({ canvas, canvasElement }) => {
    await waitFor(() => {
      expect(canvasElement.querySelector(".app--adaptive")).not.toBeNull();
    });
    await expect(canvas.getByRole("button", { name: "Edit note" })).toBeInTheDocument();
    await expect(
      canvas.queryByRole("complementary", { name: "Context panel" })
    ).not.toBeInTheDocument();
    await expect(canvas.getByRole("complementary", { name: "Inspector rail" })).toBeInTheDocument();
  },
};
