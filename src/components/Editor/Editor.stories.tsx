import { useEffect } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";
import { Editor } from "./index";
import { useEditorStore, useVaultStore } from "@lib/store";
import type { NoteData, NoteSummary, VaultInfo } from "@/types/vault";

// Trace: DESIGN-storybook-editor-coverage-2026-02-22
const demoVault: VaultInfo = {
  path: "/tmp/canonical-vault",
  name: "Canonical Vault",
  note_count: 3,
  last_modified: 1_708_700_000,
};

const demoNotes: NoteSummary[] = [
  {
    id: "n1",
    path: "notes/editor-flow.md",
    title: "Editor Flow",
    created_at: 1_708_700_000,
    modified_at: 1_708_700_000,
    word_count: 12,
  },
  {
    id: "n2",
    path: "notes/mermaid-sample.md",
    title: "Mermaid Sample",
    created_at: 1_708_700_000,
    modified_at: 1_708_700_000,
    word_count: 9,
  },
];

type EditorStoryArgs = {
  note: NoteData | null;
  editorContent?: string;
  dirty?: boolean;
};

function EditorStoryHarness({ note, editorContent = "", dirty = false }: EditorStoryArgs) {
  useEffect(() => {
    localStorage.clear();
    useVaultStore.setState((state) => ({
      ...state,
      vault: note ? demoVault : null,
      currentNote: note,
      noteList: note ? demoNotes : [],
      isLoading: false,
      error: null,
    }));
    useEditorStore.setState({
      content: editorContent,
      isDirty: dirty,
      cursorPosition: 0,
    });
  }, [dirty, editorContent, note]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg-elevated)", padding: "1rem" }}>
      <Editor />
    </div>
  );
}

const defaultNote: NoteData = {
  id: "n1",
  path: "notes/editor-flow.md",
  title: "Editor Flow",
  content: "# Editor Flow\n\nThis note is used for Storybook coverage.",
  created_at: 1_708_700_000,
  modified_at: 1_708_700_000,
  word_count: 10,
  headings: [],
  backlinks: [],
};

const mermaidNote: NoteData = {
  ...defaultNote,
  id: "n2",
  path: "notes/mermaid-sample.md",
  title: "Mermaid Sample",
  content: "```mermaid\nflowchart TD\n  A[Source] --> B[View]\n```",
};

const meta = {
  title: "Editor/Editor",
  component: EditorStoryHarness,
  args: {
    note: defaultNote,
    editorContent: defaultNote.content,
    dirty: false,
  },
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof EditorStoryHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoNoteSelected: Story = {
  args: {
    note: null,
    editorContent: "",
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("No note selected")).toBeInTheDocument();
  },
};

export const EditModeDefault: Story = {
  args: {
    note: defaultNote,
    editorContent: defaultNote.content,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("tab", { name: "Edit" })).toHaveAttribute("aria-selected", "true");
    await expect(canvas.getByText("Editor Flow")).toBeInTheDocument();
  },
};

export const SourceModeRoundTrip: Story = {
  args: {
    note: defaultNote,
    editorContent: defaultNote.content,
  },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("tab", { name: "Source" }));
    const source = canvas.getByLabelText("Source markdown editor");
    await expect(source).toBeInTheDocument();
    await userEvent.clear(source);
    await userEvent.type(source, "# Updated{enter}{enter}Storybook source flow");
    await expect(source).toHaveValue("# Updated\n\nStorybook source flow");
  },
};

export const ViewModeWithMermaid: Story = {
  args: {
    note: mermaidNote,
    editorContent: mermaidNote.content,
  },
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole("tab", { name: "View" }));
    await expect(canvas.getByText("Mermaid Sample")).toBeInTheDocument();
    await expect(canvasElement.querySelector("[data-mermaid-diagram='true']")).not.toBeNull();
  },
};
