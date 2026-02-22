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

const emptyDocNote: NoteData = {
  ...defaultNote,
  id: "n3",
  path: "notes/empty-doc.md",
  title: "Empty Doc",
  content: "",
  word_count: 0,
};

const referenceMarkdownNote: NoteData = {
  ...defaultNote,
  id: "n4",
  path: "notes/reference-links.md",
  title: "Reference Links",
  content:
    "# Reference Links\n\nRead the [vault policy][vault-policy].\n\n[vault-policy]: https://example.com/policy",
};

const mermaidVariantsNote: NoteData = {
  ...defaultNote,
  id: "n5",
  path: "notes/mermaid-variants.md",
  title: "Mermaid Variants",
  content:
    "```mermaid\nflowchart LR\n  A[Draft] --> B[Review]\n```\n\n```mermaid\nsequenceDiagram\n  participant U as User\n  participant A as App\n  U->>A: Open note\n  A-->>U: Rendered\n```",
};
// Trace: DESIGN-storybook-coverage-closure-2026-02-22

const inlineMarksNote: NoteData = {
  ...defaultNote,
  id: "n6",
  path: "notes/inline-mermaid.md",
  title: "Inline Mermaid Insert",
  content: "Before **bold** and *emphasis* after.",
};

const inlineEmphasisNote: NoteData = {
  ...defaultNote,
  id: "n7",
  path: "notes/inline-emphasis-mermaid.md",
  title: "Inline Emphasis Mermaid",
  content: "Before *emphasis* and **bold** after.",
};

const inlineCodeNote: NoteData = {
  ...defaultNote,
  id: "n8",
  path: "notes/inline-code-mermaid.md",
  title: "Inline Code Mermaid",
  content: "Before `code` and *emphasis* after.",
};

const inlineLinkNote: NoteData = {
  ...defaultNote,
  id: "n9",
  path: "notes/inline-link-mermaid.md",
  title: "Inline Link Mermaid",
  content: "Before [link](https://example.com) and **bold** after.",
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

export const EditModeBlockMenu: Story = {
  args: {
    note: defaultNote,
    editorContent: defaultNote.content,
  },
  play: async ({ canvas }) => {
    const toggle = canvas.getByRole("button", { name: "Open block menu" });
    await userEvent.click(toggle);
    await expect(canvas.getByRole("menu", { name: "Insert block" })).toBeInTheDocument();
    await expect(canvas.getByRole("menuitem", { name: "Mermaid diagram" })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Close block menu" }));
    await expect(canvas.queryByRole("menu", { name: "Insert block" })).not.toBeInTheDocument();
  },
};

export const SourceModeEmptyDocument: Story = {
  args: {
    note: emptyDocNote,
    editorContent: "",
  },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("tab", { name: "Source" }));
    await expect(canvas.getByLabelText("Source markdown editor")).toHaveValue("");
  },
};

export const ReferenceMarkdownRoundTrip: Story = {
  args: {
    note: referenceMarkdownNote,
    editorContent: referenceMarkdownNote.content,
  },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("tab", { name: "Source" }));
    await expect(canvas.getByLabelText("Source markdown editor")).toHaveValue(
      referenceMarkdownNote.content
    );
    await userEvent.click(canvas.getByRole("tab", { name: "View" }));
    await expect(canvas.getByRole("link", { name: "vault policy" })).toBeInTheDocument();
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

export const ViewModeWithMermaidVariants: Story = {
  args: {
    note: mermaidVariantsNote,
    editorContent: mermaidVariantsNote.content,
  },
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole("tab", { name: "View" }));
    await expect(canvas.getByText("Mermaid Variants")).toBeInTheDocument();
    await expect(
      canvasElement.querySelectorAll("[data-mermaid-diagram='true']").length
    ).toBeGreaterThanOrEqual(2);
  },
};

export const MermaidInsertInsideInlinePreservesMarks: Story = {
  args: {
    note: inlineMarksNote,
    editorContent: inlineMarksNote.content,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Spec: COMP-MERMAID-INLINE-SPLIT-001 FR-1/FR-3. Inserting Mermaid from block menu while caret is inside inline-marked text preserves mark continuity.",
      },
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("tab", { name: "Edit" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(canvas.getByText("bold"));
    await userEvent.click(canvas.getByRole("button", { name: "Open block menu" }));
    await userEvent.click(canvas.getByRole("menuitem", { name: "Mermaid diagram" }));
    await userEvent.click(canvas.getByRole("tab", { name: "Source" }));
    const source = canvas.getByLabelText("Source markdown editor");
    await expect(source).toHaveValue(expect.stringContaining("**bold**"));
    await expect(source).toHaveValue(expect.stringContaining("```mermaid"));
  },
};

export const MermaidInsertInsideEmphasisPreservesMarks: Story = {
  args: {
    note: inlineEmphasisNote,
    editorContent: inlineEmphasisNote.content,
  },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByText("emphasis"));
    await userEvent.click(canvas.getByRole("button", { name: "Open block menu" }));
    await userEvent.click(canvas.getByRole("menuitem", { name: "Mermaid diagram" }));
    await userEvent.click(canvas.getByRole("tab", { name: "Source" }));
    const source = canvas.getByLabelText("Source markdown editor");
    await expect(source).toHaveValue(expect.stringContaining("*emphasis*"));
    await expect(source).toHaveValue(expect.stringContaining("```mermaid"));
  },
};

export const MermaidInsertInsideCodePreservesMarks: Story = {
  args: {
    note: inlineCodeNote,
    editorContent: inlineCodeNote.content,
  },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByText("code"));
    await userEvent.click(canvas.getByRole("button", { name: "Open block menu" }));
    await userEvent.click(canvas.getByRole("menuitem", { name: "Mermaid diagram" }));
    await userEvent.click(canvas.getByRole("tab", { name: "Source" }));
    const source = canvas.getByLabelText("Source markdown editor");
    await expect(source).toHaveValue(expect.stringContaining("`code`"));
    await expect(source).toHaveValue(expect.stringContaining("```mermaid"));
  },
};

export const MermaidInsertInsideLinkPreservesMarks: Story = {
  args: {
    note: inlineLinkNote,
    editorContent: inlineLinkNote.content,
  },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByText("link"));
    await userEvent.click(canvas.getByRole("button", { name: "Open block menu" }));
    await userEvent.click(canvas.getByRole("menuitem", { name: "Mermaid diagram" }));
    await userEvent.click(canvas.getByRole("tab", { name: "Source" }));
    const source = canvas.getByLabelText("Source markdown editor");
    await expect(source).toHaveValue(expect.stringContaining("[link](https://example.com)"));
    await expect(source).toHaveValue(expect.stringContaining("```mermaid"));
  },
};
