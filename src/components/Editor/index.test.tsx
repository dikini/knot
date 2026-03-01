import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import { Editor } from "./index";
import { useVaultStore, useEditorStore } from "@lib/store";
import * as api from "@lib/api";
import { schema } from "@editor/schema";

const mockInitProseMirrorEditor = vi.fn();

vi.mock("@lib/api");
vi.mock("@editor/index", () => ({
  initProseMirrorEditor: (...args: unknown[]) => mockInitProseMirrorEditor(...args),
}));

describe("Editor Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockInitProseMirrorEditor.mockImplementation(() => ({
      destroy: vi.fn(),
      getMarkdown: vi.fn(() => "# Initial\n\nContent"),
      setMarkdown: vi.fn(),
      view: {
        dom: {
          getBoundingClientRect: vi.fn(() => ({
            left: 120,
            right: 720,
            top: 80,
            bottom: 520,
            width: 600,
            height: 440,
            x: 120,
            y: 80,
            toJSON: () => ({}),
          })),
        },
        state: {
          selection: {
            from: 1,
            to: 1,
            empty: true,
          },
        },
        dispatch: vi.fn(),
        focus: vi.fn(),
        coordsAtPos: vi.fn(() => ({ left: 200, right: 260, top: 220, bottom: 240 })),
      },
    }));
    useVaultStore.setState({
      vault: null,
      currentNote: null,
      noteList: [],
      isLoading: false,
      error: null,
      setVault: vi.fn(),
      setCurrentNote: vi.fn(),
      setNoteList: vi.fn(),
      setLoading: vi.fn(),
      setError: vi.fn(),
      openVault: vi.fn(),
      closeVault: vi.fn(),
      loadNotes: vi.fn(),
      loadNote: vi.fn(),
      saveCurrentNote: vi.fn(),
      hasVault: vi.fn(() => false),
      hasNote: vi.fn(() => false),
    });

    useEditorStore.setState({
      content: "",
      isDirty: false,
      cursorPosition: 0,
      setContent: vi.fn(),
      markDirty: vi.fn(),
      setCursorPosition: vi.fn(),
      reset: vi.fn(),
    });
  });

  describe("Placeholder State", () => {
    it("should show placeholder when no note is selected", () => {
      render(<Editor />);

      expect(screen.getByText("No note selected")).toBeInTheDocument();
      expect(
        screen.getByText("Select a note from the sidebar to start editing")
      ).toBeInTheDocument();
      expect(screen.getByText(/Or create a new note using the New Note action/)).toBeInTheDocument();
    });
  });

  describe("With Current Note", () => {
    beforeEach(() => {
      const mockNote = {
        id: "1",
        path: "test.md",
        title: "Test Note",
        content: "# Test\n\nContent",
        created_at: Date.now() / 1000,
        modified_at: Date.now() / 1000,
        word_count: 2,
        headings: [],
        backlinks: [],
      };

      useVaultStore.setState({
        ...useVaultStore.getState(),
        currentNote: mockNote,
        hasNote: () => true,
      });
    });

    it("should render editor with toolbar", () => {
      render(<Editor />);

      expect(screen.getByText("Test Note")).toBeInTheDocument();
      expect(
        screen.getByText((content) => content.includes("2") && content.includes("words"))
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Saved" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Source" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Edit" })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByRole("tab", { name: "View" })).toBeInTheDocument();
    });

    it("switches to source mode and edits markdown live", () => {
      render(<Editor />);

      fireEvent.click(screen.getByRole("tab", { name: "Source" }));
      const textarea = screen.getByLabelText("Source markdown editor");
      expect(textarea).toBeInTheDocument();

      fireEvent.change(textarea, { target: { value: "# Updated\n\nText" } });
      expect(useEditorStore.getState().setContent).toHaveBeenCalledWith("# Updated\n\nText");
    });

    it("preserves source edits when moving source -> view -> source", () => {
      useEditorStore.setState({
        ...useEditorStore.getState(),
        setContent: (next) =>
          useEditorStore.setState((prev) => ({
            ...prev,
            content: next,
            isDirty: true,
          })),
      });

      render(<Editor />);
      fireEvent.click(screen.getByRole("tab", { name: "Source" }));
      const sourceEditor = screen.getByLabelText("Source markdown editor");
      fireEvent.change(sourceEditor, { target: { value: "# Preserved\n\nRound trip text" } });

      fireEvent.click(screen.getByRole("tab", { name: "View" }));
      expect(screen.getByRole("heading", { name: "Preserved" })).toBeInTheDocument();

      fireEvent.click(screen.getByRole("tab", { name: "Source" }));
      expect(screen.getByLabelText("Source markdown editor")).toHaveValue(
        "# Preserved\n\nRound trip text"
      );
    });

    it("preserves unsaved source edits when moving source -> view -> edit", () => {
      useEditorStore.setState({
        ...useEditorStore.getState(),
        setContent: (next) =>
          useEditorStore.setState((prev) => ({
            ...prev,
            content: next,
            isDirty: true,
          })),
      });

      render(<Editor />);
      fireEvent.click(screen.getByRole("tab", { name: "Source" }));
      const sourceEditor = screen.getByLabelText("Source markdown editor");
      fireEvent.change(sourceEditor, { target: { value: "# Unsaved\n\nStill here" } });

      fireEvent.click(screen.getByRole("tab", { name: "View" }));
      expect(screen.getByRole("heading", { name: "Unsaved" })).toBeInTheDocument();

      fireEvent.click(screen.getByRole("tab", { name: "Edit" }));

      const initCall = mockInitProseMirrorEditor.mock.calls.at(-1);
      const options = initCall?.[1] as { initialContent?: string };
      expect(options.initialContent).toBe("# Unsaved\n\nStill here");
    });

    it("preserves links, blockquote, and code block across source -> view -> source", () => {
      useEditorStore.setState({
        ...useEditorStore.getState(),
        setContent: (next) =>
          useEditorStore.setState((prev) => ({
            ...prev,
            content: next,
            isDirty: true,
          })),
      });

      const markdown = [
        "# Fidelity",
        "",
        "A [linked note](test.md).",
        "",
        "> quoted line",
        "",
        "```ts",
        "const n = 1;",
        "```",
      ].join("\n");

      render(<Editor />);
      fireEvent.click(screen.getByRole("tab", { name: "Source" }));
      const sourceEditor = screen.getByLabelText("Source markdown editor");
      fireEvent.change(sourceEditor, { target: { value: markdown } });

      fireEvent.click(screen.getByRole("tab", { name: "View" }));
      expect(screen.getByRole("heading", { name: "Fidelity" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "linked note" })).toBeInTheDocument();
      expect(screen.getByText("quoted line")).toBeInTheDocument();
      expect(screen.getByText("const n = 1;")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("tab", { name: "Source" }));
      expect(screen.getByLabelText("Source markdown editor")).toHaveValue(markdown);
    });

    it("switches to view mode and renders markdown output", () => {
      useEditorStore.setState({
        ...useEditorStore.getState(),
        content: "# Rendered\n\n**Bold**",
      });

      render(<Editor />);
      fireEvent.click(screen.getByRole("tab", { name: "View" }));

      expect(screen.getByRole("heading", { name: "Rendered" })).toBeInTheDocument();
      expect(screen.getByText("Bold")).toBeInTheDocument();
    });

    it("renders task lists as checkbox UI in view mode", () => {
      useEditorStore.setState({
        ...useEditorStore.getState(),
        content: "- [x] Done\n- [ ] Todo",
      });

      render(<Editor />);
      fireEvent.click(screen.getByRole("tab", { name: "View" }));

      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes).toHaveLength(2);
      expect(checkboxes[0]).toBeChecked();
      expect(checkboxes[0]).toBeDisabled();
      expect(checkboxes[1]).not.toBeChecked();
    });

    it("renders Mermaid fences as diagram containers in view mode", () => {
      useEditorStore.setState({
        ...useEditorStore.getState(),
        content: "```mermaid\ngraph TD\n  A-->B\n```",
      });

      render(<Editor />);
      fireEvent.click(screen.getByRole("tab", { name: "View" }));

      expect(document.querySelector("[data-mermaid-diagram='true']")).toBeInTheDocument();
      expect(document.querySelector("pre[data-language='mermaid']")).not.toBeInTheDocument();
    });

    it("shows selection toolbar when edit selection is non-empty", async () => {
      render(<Editor />);
      fireEvent.click(screen.getByRole("tab", { name: "Edit" }));

      const initCall = mockInitProseMirrorEditor.mock.calls[0];
      const options = initCall?.[1] as {
        onSelectionChange?: (selection: { from: number; to: number; empty: boolean }) => void;
      };
      act(() => {
        options.onSelectionChange?.({ from: 1, to: 4, empty: false });
      });

      await waitFor(() => {
        expect(screen.getByRole("toolbar", { name: "Selection formatting" })).toBeInTheDocument();
      });
      expect(screen.getByRole("button", { name: "Bold" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Italic" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Code" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Link" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Quote" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Strikethrough" })).toBeInTheDocument();
    });

    it("shows block plus tool on collapsed cursor selection", async () => {
      render(<Editor />);
      fireEvent.click(screen.getByRole("tab", { name: "Edit" }));

      const initCall = mockInitProseMirrorEditor.mock.calls[0];
      const options = initCall?.[1] as {
        onSelectionChange?: (selection: { from: number; to: number; empty: boolean }) => void;
      };
      act(() => {
        options.onSelectionChange?.({ from: 2, to: 2, empty: true });
      });

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Open block menu" })).toBeInTheDocument();
      });
    });

    it("supports keyboard navigation and escape in block menu", async () => {
      render(<Editor />);
      fireEvent.click(screen.getByRole("tab", { name: "Edit" }));

      const initCall = mockInitProseMirrorEditor.mock.calls[0];
      const options = initCall?.[1] as {
        onSelectionChange?: (selection: { from: number; to: number; empty: boolean }) => void;
      };
      act(() => {
        options.onSelectionChange?.({ from: 2, to: 2, empty: true });
      });

      const toggle = await screen.findByRole("button", { name: "Open block menu" });
      fireEvent.click(toggle);

      const menu = await screen.findByRole("menu", { name: "Insert block" });
      const items = within(menu).getAllByRole("menuitem");
      expect(items.length).toBeGreaterThan(1);
      const firstItem = items[0];
      const secondItem = items[1];
      expect(document.activeElement).toBe(firstItem);

      fireEvent.keyDown(menu, { key: "ArrowRight" });
      expect(document.activeElement).toBe(secondItem);

      fireEvent.keyDown(menu, { key: "Escape" });
      expect(screen.queryByRole("menu", { name: "Insert block" })).not.toBeInTheDocument();
      expect(document.activeElement).toBe(toggle);
    });

    it("renders icon+label block menu actions", async () => {
      render(<Editor />);
      fireEvent.click(screen.getByRole("tab", { name: "Edit" }));

      const initCall = mockInitProseMirrorEditor.mock.calls[0];
      const options = initCall?.[1] as {
        onSelectionChange?: (selection: { from: number; to: number; empty: boolean }) => void;
      };
      act(() => {
        options.onSelectionChange?.({ from: 2, to: 2, empty: true });
      });

      fireEvent.click(await screen.findByRole("button", { name: "Open block menu" }));
      const menu = await screen.findByRole("menu", { name: "Insert block" });

      expect(within(menu).getByRole("menuitem", { name: "Heading 1" })).toBeInTheDocument();
      expect(within(menu).getByRole("menuitem", { name: "Paragraph" })).toBeInTheDocument();
      expect(within(menu).getByRole("menuitem", { name: "Heading 2" })).toBeInTheDocument();
      expect(within(menu).getByRole("menuitem", { name: "Heading 3" })).toBeInTheDocument();
      expect(within(menu).getByRole("menuitem", { name: "Bullet list" })).toBeInTheDocument();
      expect(within(menu).getByRole("menuitem", { name: "Numbered list" })).toBeInTheDocument();
      expect(within(menu).getByRole("menuitem", { name: "Horizontal rule" })).toBeInTheDocument();
      expect(within(menu).getByRole("menuitem", { name: "Mermaid diagram" })).toBeInTheDocument();
      expect(within(menu).getByRole("menuitem", { name: "Code block" })).toBeInTheDocument();
      expect(within(menu).getByRole("menuitem", { name: "Blockquote" })).toBeInTheDocument();
      expect(within(menu).getByTestId("block-menu-icon-h1")).toBeInTheDocument();
      expect(within(menu).getByTestId("block-menu-icon-h2")).toBeInTheDocument();
      expect(within(menu).getByTestId("block-menu-icon-h3")).toBeInTheDocument();
      expect(within(menu).getByTestId("block-menu-icon-bullet")).toBeInTheDocument();
      expect(within(menu).getByTestId("block-menu-icon-ordered")).toBeInTheDocument();
      expect(within(menu).getByTestId("block-menu-icon-hr")).toBeInTheDocument();
      expect(within(menu).getByTestId("block-menu-icon-mermaid")).toBeInTheDocument();
      expect(within(menu).getByTestId("block-menu-icon-code")).toBeInTheDocument();
      expect(within(menu).getByTestId("block-menu-icon-quote")).toBeInTheDocument();
    });

    it("inserts Mermaid as a code_block node, not raw markdown text", async () => {
      const insertTextMock = vi.fn();
      const tr = {
        doc: {
          content: { size: 32 },
        },
        insert: vi.fn().mockReturnThis(),
        scrollIntoView: vi.fn().mockReturnThis(),
      };

      mockInitProseMirrorEditor.mockImplementationOnce(() => ({
        destroy: vi.fn(),
        getMarkdown: vi.fn(() => "# Initial\n\nContent"),
        setMarkdown: vi.fn(),
        view: {
          dom: {
            getBoundingClientRect: vi.fn(() => ({
              left: 120,
              right: 720,
              top: 80,
              bottom: 520,
              width: 600,
              height: 440,
              x: 120,
              y: 80,
              toJSON: () => ({}),
            })),
          },
          state: {
            selection: {
              from: 2,
              to: 2,
              empty: true,
            },
            tr: {
              ...tr,
              insertText: insertTextMock,
            },
          },
          dispatch: vi.fn(),
          focus: vi.fn(),
          coordsAtPos: vi.fn(() => ({ left: 200, right: 260, top: 220, bottom: 240 })),
        },
      }));

      render(<Editor />);
      fireEvent.click(screen.getByRole("tab", { name: "Edit" }));

      const initCall = mockInitProseMirrorEditor.mock.calls[0];
      const options = initCall?.[1] as {
        onSelectionChange?: (selection: { from: number; to: number; empty: boolean }) => void;
      };
      act(() => {
        options.onSelectionChange?.({ from: 2, to: 2, empty: true });
      });

      fireEvent.click(await screen.findByRole("button", { name: "Open block menu" }));
      fireEvent.click(await screen.findByRole("menuitem", { name: "Mermaid diagram" }));

      expect(insertTextMock).not.toHaveBeenCalled();
      expect(tr.insert).toHaveBeenCalledTimes(1);
      const insertedNode = tr.insert.mock.calls[0]?.[1];
      expect(insertedNode?.type?.name).toBe(schema.nodes.code_block.name);
      expect(insertedNode?.attrs?.language).toBe("mermaid");
      expect(insertedNode?.textContent).toContain("A[Start] --> B[End]");
    });

    it("inserts Mermaid at block boundary when cursor is inside inline-marked text", async () => {
      const tr = {
        doc: {
          content: { size: 32 },
        },
        insert: vi.fn().mockReturnThis(),
        scrollIntoView: vi.fn().mockReturnThis(),
      };

      mockInitProseMirrorEditor.mockImplementationOnce(() => ({
        destroy: vi.fn(),
        getMarkdown: vi.fn(() => "# Demo\n\nBefore **bold** and after."),
        setMarkdown: vi.fn(),
        view: {
          dom: {
            getBoundingClientRect: vi.fn(() => ({
              left: 120,
              right: 720,
              top: 80,
              bottom: 520,
              width: 600,
              height: 440,
              x: 120,
              y: 80,
              toJSON: () => ({}),
            })),
          },
          state: {
            selection: {
              from: 8,
              to: 8,
              empty: true,
              $from: {
                depth: 1,
                parent: { isTextblock: true },
                after: vi.fn(() => 14),
              },
            },
            tr: {
              ...tr,
              insertText: vi.fn(),
            },
          },
          dispatch: vi.fn(),
          focus: vi.fn(),
          coordsAtPos: vi.fn(() => ({ left: 200, right: 260, top: 220, bottom: 240 })),
        },
      }));

      render(<Editor />);
      fireEvent.click(screen.getByRole("tab", { name: "Edit" }));

      fireEvent.click(await screen.findByRole("button", { name: "Open block menu" }));
      fireEvent.click(await screen.findByRole("menuitem", { name: "Mermaid diagram" }));

      expect(tr.insert).toHaveBeenCalledTimes(1);
      expect(tr.insert.mock.calls[0]?.[0]).toBe(14);
    });

    it("does not reinitialize ProseMirror on content sync changes", async () => {
      useEditorStore.setState({
        ...useEditorStore.getState(),
        setContent: (next) =>
          useEditorStore.setState((prev) => ({
            ...prev,
            content: next,
          })),
        markDirty: (next) =>
          useEditorStore.setState((prev) => ({
            ...prev,
            isDirty: next,
          })),
      });

      render(<Editor />);

      const initCall = mockInitProseMirrorEditor.mock.calls[0];
      const options = initCall?.[1] as {
        onChange?: (state: {
          markdown: string;
          cursorPosition: number;
          selection: { from: number; to: number };
        }) => void;
      };

      act(() => {
        options.onChange?.({
          markdown: "# Test\n\nPersist paragraph",
          cursorPosition: 4,
          selection: { from: 4, to: 4 },
        });
      });

      await waitFor(() => {
        expect(useEditorStore.getState().content).toBe("# Test\n\nPersist paragraph");
      });

      expect(mockInitProseMirrorEditor).toHaveBeenCalledTimes(1);
    });

    it("should show dirty indicator when content is dirty", () => {
      useEditorStore.setState({
        ...useEditorStore.getState(),
        isDirty: true,
      });

      render(<Editor />);

      expect(screen.getByText("●")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    });

    it("should save note on button click", async () => {
      vi.mocked(api.saveNote).mockResolvedValue(undefined);
      vi.mocked(api.getNote).mockResolvedValue({
        id: "1",
        path: "test.md",
        title: "Test Note",
        content: "# Test\n\nUpdated",
        created_at: Date.now() / 1000,
        modified_at: Date.now() / 1000,
        word_count: 2,
        headings: [],
        backlinks: [],
      });
      vi.mocked(useVaultStore.getState().loadNotes).mockResolvedValue();

      useEditorStore.setState({
        ...useEditorStore.getState(),
        content: "# Test\n\nUpdated",
        isDirty: true,
      });

      render(<Editor />);

      const saveButton = screen.getByRole("button", { name: "Save" });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(api.saveNote).toHaveBeenCalledWith("test.md", "# Test\n\nUpdated");
      });
    });

    it("should disable save button when not dirty", () => {
      useEditorStore.setState({
        ...useEditorStore.getState(),
        isDirty: false,
      });

      render(<Editor />);

      const saveButton = screen.getByRole("button", { name: "Saved" });
      expect(saveButton).toBeDisabled();
    });
  });

  describe("Keyboard Shortcuts", () => {
    beforeEach(() => {
      const mockNote = {
        id: "1",
        path: "test.md",
        title: "Test Note",
        content: "# Test\n\nContent",
        created_at: Date.now() / 1000,
        modified_at: Date.now() / 1000,
        word_count: 2,
        headings: [],
        backlinks: [],
      };

      useVaultStore.setState({
        ...useVaultStore.getState(),
        currentNote: mockNote,
        hasNote: () => true,
      });

      useEditorStore.setState({
        ...useEditorStore.getState(),
        content: "# Test\n\nUpdated",
        isDirty: true,
      });

      vi.mocked(api.saveNote).mockResolvedValue(undefined);
      vi.mocked(api.getNote).mockResolvedValue({
        id: "1",
        path: "test.md",
        title: "Test Note",
        content: "# Test\n\nUpdated",
        created_at: Date.now() / 1000,
        modified_at: Date.now() / 1000,
        word_count: 2,
        headings: [],
        backlinks: [],
      });
      vi.mocked(useVaultStore.getState().loadNotes).mockResolvedValue();
    });

    it("should save on Ctrl+S", async () => {
      render(<Editor />);

      fireEvent.keyDown(window, { key: "s", ctrlKey: true });

      await waitFor(() => {
        expect(api.saveNote).toHaveBeenCalledWith("test.md", "# Test\n\nUpdated");
      });
    });

    it("should save on Cmd+S", async () => {
      render(<Editor />);

      fireEvent.keyDown(window, { key: "s", metaKey: true });

      await waitFor(() => {
        expect(api.saveNote).toHaveBeenCalledWith("test.md", "# Test\n\nUpdated");
      });
    });
  });

  describe("Custom Events", () => {
    beforeEach(() => {
      const mockNote = {
        id: "1",
        path: "test.md",
        title: "Test Note",
        content: "# Test\n\nContent",
        created_at: Date.now() / 1000,
        modified_at: Date.now() / 1000,
        word_count: 2,
        headings: [],
        backlinks: [],
      };

      useVaultStore.setState({
        ...useVaultStore.getState(),
        currentNote: mockNote,
        hasNote: () => true,
      });

      useEditorStore.setState({
        ...useEditorStore.getState(),
        content: "# Test\n\nUpdated",
        isDirty: true,
      });

      vi.mocked(api.saveNote).mockResolvedValue(undefined);
      vi.mocked(api.getNote).mockResolvedValue({
        id: "1",
        path: "test.md",
        title: "Test Note",
        content: "# Test\n\nUpdated",
        created_at: Date.now() / 1000,
        modified_at: Date.now() / 1000,
        word_count: 2,
        headings: [],
        backlinks: [],
      });
      vi.mocked(useVaultStore.getState().loadNotes).mockResolvedValue();
    });

    it("should save on editor-save event", async () => {
      render(<Editor />);

      window.dispatchEvent(new CustomEvent("editor-save"));

      await waitFor(() => {
        expect(api.saveNote).toHaveBeenCalledWith("test.md", "# Test\n\nUpdated");
      });
    });

    it("follows existing wikilink targets", async () => {
      useVaultStore.setState({
        ...useVaultStore.getState(),
        noteList: [
          {
            id: "2",
            path: "Project Alpha.md",
            title: "Project Alpha",
            created_at: Date.now() / 1000,
            modified_at: Date.now() / 1000,
            word_count: 10,
          },
        ],
      });

      render(<Editor />);

      window.dispatchEvent(
        new CustomEvent("wikilink-click", {
          detail: { target: "Project Alpha", missing: false },
        })
      );

      await waitFor(() => {
        expect(useVaultStore.getState().loadNote).toHaveBeenCalledWith("Project Alpha.md");
      });
    });

    it("follows existing wikilink targets when clicked in view mode", async () => {
      useVaultStore.setState({
        ...useVaultStore.getState(),
        currentNote: {
          id: "1",
          path: "test.md",
          title: "Test Note",
          content: "[[Project Alpha]]",
          created_at: Date.now() / 1000,
          modified_at: Date.now() / 1000,
          word_count: 2,
          headings: [],
          backlinks: [],
        },
        noteList: [
          {
            id: "2",
            path: "Project Alpha.md",
            title: "Project Alpha",
            created_at: Date.now() / 1000,
            modified_at: Date.now() / 1000,
            word_count: 10,
          },
        ],
      });

      useEditorStore.setState({
        ...useEditorStore.getState(),
        content: "[[Project Alpha]]",
        isDirty: false,
      });

      render(<Editor />);

      fireEvent.click(screen.getByRole("tab", { name: "View" }));
      fireEvent.click(screen.getByRole("link", { name: "Project Alpha" }));

      await waitFor(() => {
        expect(useVaultStore.getState().loadNote).toHaveBeenCalledWith("Project Alpha.md");
      });
    });

    it("creates missing wikilink targets", async () => {
      vi.mocked(api.createNote).mockResolvedValue({
        id: "3",
        path: "New Page.md",
        title: "New Page",
        content: "# New Page\n\n",
        created_at: Date.now() / 1000,
        modified_at: Date.now() / 1000,
        word_count: 2,
        headings: [],
        backlinks: [],
      });

      render(<Editor />);

      window.dispatchEvent(
        new CustomEvent("wikilink-click", {
          detail: { target: "New Page", missing: true },
        })
      );

      await waitFor(() => {
        expect(api.createNote).toHaveBeenCalledWith("New Page.md", "# New Page\n\n");
      });
      expect(useVaultStore.getState().setCurrentNote).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    beforeEach(() => {
      const mockNote = {
        id: "1",
        path: "test.md",
        title: "Test Note",
        content: "# Test\n\nContent",
        created_at: Date.now() / 1000,
        modified_at: Date.now() / 1000,
        word_count: 2,
        headings: [],
        backlinks: [],
      };

      useVaultStore.setState({
        ...useVaultStore.getState(),
        currentNote: mockNote,
        hasNote: () => true,
      });

      useEditorStore.setState({
        ...useEditorStore.getState(),
        content: "# Test\n\nUpdated",
        isDirty: true,
      });

      const error = new Error("Save failed");
      vi.mocked(api.saveNote).mockRejectedValue(error);

      window.alert = vi.fn();
    });

    it("should show alert on save error", async () => {
      render(<Editor />);

      const saveButton = screen.getByRole("button", { name: "Save" });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith("Failed to save: Error: Save failed");
      });
    });
  });
});
