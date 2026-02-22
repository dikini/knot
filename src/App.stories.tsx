import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, mocked, userEvent, waitFor } from "storybook/test";
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

type AppStoryArgs = {
  vault: VaultInfo | null;
  noteList: NoteSummary[];
  currentNote: NoteData | null;
  shell: Partial<ShellState>;
  editorContent: string;
  editorDirty: boolean;
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
  },
  render: (args) => {
    localStorage.clear();
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
    mocked(api.getGraphLayout).mockResolvedValue(demoLayout);
    mocked(api.openVaultDialog).mockRejectedValue(new Error("cancelled"));
    mocked(api.createVaultDialog).mockRejectedValue(new Error("cancelled"));
    mocked(api.openVault).mockRejectedValue(new Error("not used in story"));
    mocked(api.addRecentVault).mockResolvedValue(undefined);
    mocked(api.saveNote).mockResolvedValue(undefined);
    mocked(api.setUnsavedChanges).mockResolvedValue(undefined);
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
    await expect(canvas.getByText("Language Model Evaluation")).toBeInTheDocument();
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
