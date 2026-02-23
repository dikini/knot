import { useEffect } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, fn, mocked, userEvent, waitFor } from "storybook/test";
import { Editor } from "./index";
import { useEditorStore, useVaultStore } from "@lib/store";
import * as api from "@lib/api";
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
  preserveLocalStorage?: boolean;
};

function EditorStoryHarness({
  note,
  editorContent = "",
  dirty = false,
  preserveLocalStorage = false,
}: EditorStoryArgs) {
  useEffect(() => {
    if (!preserveLocalStorage) {
      localStorage.clear();
    }
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
  }, [dirty, editorContent, note, preserveLocalStorage]);

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

const internalLinkNote: NoteData = {
  ...defaultNote,
  id: "n10",
  path: "notes/internal-link.md",
  title: "Internal Link",
  content: "# Internal Link\n\nJump to [Roadmap](notes/roadmap-brief.md)",
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
  beforeEach: async () => {
    localStorage.clear();
    mocked(api.setUnsavedChanges).mockResolvedValue(undefined);
    mocked(api.saveNote).mockResolvedValue(undefined);
    mocked(api.getNote).mockResolvedValue(defaultNote);
    mocked(api.createNote).mockResolvedValue(defaultNote);
    mocked(api.listNotes).mockResolvedValue(demoNotes);
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
    await expect(canvas.getByRole("heading", { name: "Editor Flow" })).toBeInTheDocument();
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
    await waitFor(() => {
      expect(source).toHaveValue(defaultNote.content);
    });
    fireEvent.change(source, { target: { value: "# Updated\n\nStorybook source flow" } });
    await expect(source).toHaveValue("# Updated\n\nStorybook source flow");
  },
};

export const EditModeBlockMenu: Story = {
  args: {
    note: defaultNote,
    editorContent: defaultNote.content,
  },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("tab", { name: "Edit" }));
    const toggle = canvas.getByRole("button", { name: "Open block menu" });
    await userEvent.click(toggle);
    await expect(canvas.getByRole("menu", { name: "Insert block" })).toBeInTheDocument();
    await expect(canvas.getByRole("menuitem", { name: "Mermaid diagram" })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Close block menu" }));
    await expect(canvas.queryByRole("menu", { name: "Insert block" })).not.toBeInTheDocument();
  },
};

export const BlockMenuKeyboardNavigation: Story = {
  args: {
    note: defaultNote,
    editorContent: defaultNote.content,
  },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Open block menu" }));
    const menu = canvas.getByRole("menu", { name: "Insert block" });
    await expect(menu).toBeInTheDocument();

    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{End}");
    await userEvent.keyboard("{Home}");
    await userEvent.keyboard("{Escape}");

    await expect(canvas.queryByRole("menu", { name: "Insert block" })).not.toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Open block menu" })).toHaveFocus();
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
    await expect(source).toBeInTheDocument();
    expect((source as HTMLTextAreaElement).value).toContain("**bold**");
    expect((source as HTMLTextAreaElement).value).toContain("```mermaid");
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
    await expect(source).toBeInTheDocument();
    expect((source as HTMLTextAreaElement).value).toContain("*emphasis*");
    expect((source as HTMLTextAreaElement).value).toContain("```mermaid");
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
    await expect(source).toBeInTheDocument();
    expect((source as HTMLTextAreaElement).value).toContain("`code`");
    expect((source as HTMLTextAreaElement).value).toContain("```mermaid");
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
    await expect(source).toBeInTheDocument();
    expect((source as HTMLTextAreaElement).value).toContain("[link](https://example.com)");
    expect((source as HTMLTextAreaElement).value).toContain("```mermaid");
  },
};

export const PersistsNoteScopedModeSelection: Story = {
  args: {
    preserveLocalStorage: true,
  },
  beforeEach: async () => {
    localStorage.setItem("knot:editor-mode:notes/editor-flow.md", "view");
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("tab", { name: "View" })).toHaveAttribute("aria-selected", "true");
  },
};

export const SaveFailureShowsAlert: Story = {
  args: {
    note: defaultNote,
    editorContent: `${defaultNote.content}\n\nUpdated`,
    dirty: true,
  },
  beforeEach: async () => {
    mocked(api.saveNote).mockRejectedValueOnce(new Error("save failed"));
  },
  play: async ({ canvas }) => {
    const originalAlert = window.alert;
    const alertSpy = fn();
    window.alert = alertSpy as unknown as typeof window.alert;

    try {
      await userEvent.click(canvas.getByRole("button", { name: "Save" }));
      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalled();
      });
    } finally {
      window.alert = originalAlert;
    }
  },
};

export const SaveViaKeyboardShortcut: Story = {
  args: {
    note: defaultNote,
    editorContent: `${defaultNote.content}\n\nKeyboard save`,
    dirty: true,
  },
  play: async () => {
    await userEvent.keyboard("{Control>}s{/Control}");
    await waitFor(() => {
      expect(api.saveNote).toHaveBeenCalledWith("notes/editor-flow.md", `${defaultNote.content}\n\nKeyboard save`);
    });
  },
};

export const SaveViaCustomEvent: Story = {
  args: {
    note: defaultNote,
    editorContent: `${defaultNote.content}\n\nEvent save`,
    dirty: true,
  },
  play: async () => {
    window.dispatchEvent(new Event("editor-save"));
    await waitFor(() => {
      expect(api.saveNote).toHaveBeenCalledWith("notes/editor-flow.md", `${defaultNote.content}\n\nEvent save`);
    });
  },
};

export const ViewModeInternalMarkdownLinkLoadsNote: Story = {
  args: {
    note: internalLinkNote,
    editorContent: internalLinkNote.content,
  },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("tab", { name: "View" }));
    await userEvent.click(canvas.getByRole("link", { name: "Roadmap" }));
    await waitFor(() => {
      expect(api.getNote).toHaveBeenCalledWith("notes/roadmap-brief.md");
    });
  },
};

export const WikilinkEventCreatesMissingNote: Story = {
  args: {
    note: defaultNote,
    editorContent: defaultNote.content,
  },
  play: async () => {
    await window.dispatchEvent(
      new CustomEvent("wikilink-click", {
        detail: { target: "Missing Page" },
      })
    );
    await waitFor(() => {
      expect(api.createNote).toHaveBeenCalledWith("Missing Page.md", "# Missing Page\n\n");
    });
  },
};
