import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import { history, undo } from "prosemirror-history";
import { EditorState } from "prosemirror-state";
import { Editor } from "./index";
import { useVaultStore, useEditorStore } from "@lib/store";
import * as api from "@lib/api";
import { schema } from "@editor/schema";

const mockInitProseMirrorEditor = vi.fn();
const mockShellOpen = vi.fn();

vi.mock("@lib/api");
vi.mock("@editor/index", () => ({
  initProseMirrorEditor: (...args: unknown[]) => mockInitProseMirrorEditor(...args),
}));
vi.mock("@tauri-apps/plugin-shell", () => ({
  open: (...args: unknown[]) => mockShellOpen(...args),
}));

function installTaskRoundtripStore(markdown: string, path = "test.md") {
  useVaultStore.setState({
    ...useVaultStore.getState(),
    currentNote: {
      id: "1",
      path,
      title: "Test Note",
      content: markdown,
      created_at: Date.now() / 1000,
      modified_at: Date.now() / 1000,
      word_count: 2,
      headings: [],
      backlinks: [],
    },
    hasNote: () => true,
  });

  useEditorStore.setState({
    ...useEditorStore.getState(),
    content: markdown,
    isDirty: false,
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
}

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
      expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Redo" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Meta" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Source" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Edit" })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByRole("tab", { name: "View" })).toBeInTheDocument();
    });

    it("disables source and edit modes for image notes", () => {
      const imageNote = {
        id: "img-1",
        path: "photo.png",
        title: "photo",
        content: "",
        created_at: Date.now() / 1000,
        modified_at: Date.now() / 1000,
        word_count: 0,
        headings: [],
        backlinks: [],
        note_type: "image",
        media: {
          mime_type: "image/png",
          file_path: "/tmp/photo.png",
        },
        available_modes: {
          meta: true,
          source: false,
          edit: false,
          view: true,
        },
      };

      useVaultStore.setState({
        ...useVaultStore.getState(),
        currentNote: imageNote as never,
      });

      render(<Editor />);

      expect(screen.getByRole("tab", { name: "Source" })).toBeDisabled();
      expect(screen.getByRole("tab", { name: "Edit" })).toBeDisabled();
      expect(screen.getByRole("tab", { name: "View" })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByRole("img", { name: "photo" })).toBeInTheDocument();
    });

    it("forces image notes into view mode even if a stored mode exists", () => {
      localStorage.setItem("knot:editor-mode:photo.png", "meta");

      const imageNote = {
        id: "img-2",
        path: "photo.png",
        title: "photo",
        content: "",
        created_at: Date.now() / 1000,
        modified_at: Date.now() / 1000,
        word_count: 0,
        headings: [],
        backlinks: [],
        note_type: "image",
        media: {
          mime_type: "image/png",
          file_path: "/tmp/photo.png",
        },
        available_modes: {
          meta: true,
          source: false,
          edit: false,
          view: true,
        },
      };

      useVaultStore.setState({
        ...useVaultStore.getState(),
        currentNote: imageNote as never,
      });

      render(<Editor />);

      expect(screen.getByRole("tab", { name: "View" })).toHaveAttribute("aria-selected", "true");
      expect(screen.queryByLabelText("Description")).not.toBeInTheDocument();
      expect(screen.getByRole("img", { name: "photo" })).toBeInTheDocument();
    });

    it("renders a thumbnail header in edit mode for YouTube notes", () => {
      const youtubeNote = {
        id: "yt-1",
        path: "clips/sample-video.youtube.md",
        title: "Sample Video",
        content: "---\nyoutube_url: https://www.youtube.com/watch?v=abc123xyz00\nyoutube_embed_url: https://www.youtube.com/embed/abc123xyz00\nyoutube_thumbnail_url: https://i.ytimg.com/vi/abc123xyz00/hqdefault.jpg\n---\n# Sample Video\n\nTranscript body",
        created_at: Date.now() / 1000,
        modified_at: Date.now() / 1000,
        word_count: 3,
        headings: [],
        backlinks: [],
        note_type: "youtube",
        available_modes: {
          meta: true,
          source: true,
          edit: true,
          view: true,
        },
        metadata: {
          extra: {
            youtube_url: "https://www.youtube.com/watch?v=abc123xyz00",
            youtube_embed_url: "https://www.youtube.com/embed/abc123xyz00",
            youtube_thumbnail_url: "https://i.ytimg.com/vi/abc123xyz00/hqdefault.jpg",
            youtube_title: "Sample Video",
          },
        },
      };

      useVaultStore.setState({
        ...useVaultStore.getState(),
        currentNote: youtubeNote as never,
      });
      useEditorStore.setState({
        ...useEditorStore.getState(),
        content: youtubeNote.content,
        isDirty: false,
      });

      render(<Editor />);

      expect(screen.getByRole("tab", { name: "Edit" })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByAltText("Sample Video thumbnail")).toBeInTheDocument();
      expect(screen.queryByTitle("Sample Video player")).not.toBeInTheDocument();
    });

    it("renders a clickable thumbnail in view mode for YouTube notes", () => {
      const youtubeNote = {
        id: "yt-2",
        path: "clips/sample-video.youtube.md",
        title: "Sample Video",
        content: "---\nyoutube_url: https://www.youtube.com/watch?v=abc123xyz00\nyoutube_embed_url: https://www.youtube.com/embed/abc123xyz00\nyoutube_thumbnail_url: https://i.ytimg.com/vi/abc123xyz00/hqdefault.jpg\n---\n# Sample Video\n\nTranscript body",
        created_at: Date.now() / 1000,
        modified_at: Date.now() / 1000,
        word_count: 3,
        headings: [],
        backlinks: [],
        note_type: "youtube",
        available_modes: {
          meta: true,
          source: true,
          edit: true,
          view: true,
        },
        metadata: {
          extra: {
            youtube_url: "https://www.youtube.com/watch?v=abc123xyz00",
            youtube_embed_url: "https://www.youtube.com/embed/abc123xyz00",
            youtube_thumbnail_url: "https://i.ytimg.com/vi/abc123xyz00/hqdefault.jpg",
            youtube_title: "Sample Video",
          },
        },
      };

      useVaultStore.setState({
        ...useVaultStore.getState(),
        currentNote: youtubeNote as never,
      });
      useEditorStore.setState({
        ...useEditorStore.getState(),
        content: youtubeNote.content,
        isDirty: false,
      });

      render(<Editor />);
      fireEvent.click(screen.getByRole("tab", { name: "View" }));

      expect(screen.getByAltText("Sample Video thumbnail")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Open Sample Video on YouTube" })).toBeInTheDocument();
    });

    it("opens YouTube when the thumbnail is clicked in view mode", async () => {
      const youtubeNote = {
        id: "yt-3",
        path: "clips/sample-video.youtube.md",
        title: "Sample Video",
        content: "---\nyoutube_url: https://www.youtube.com/watch?v=abc123xyz00\nyoutube_embed_url: https://www.youtube.com/embed/abc123xyz00\nyoutube_thumbnail_url: https://i.ytimg.com/vi/abc123xyz00/hqdefault.jpg\n---\n# Sample Video\n\nTranscript body",
        created_at: Date.now() / 1000,
        modified_at: Date.now() / 1000,
        word_count: 3,
        headings: [],
        backlinks: [],
        note_type: "youtube",
        available_modes: {
          meta: true,
          source: true,
          edit: true,
          view: true,
        },
        metadata: {
          extra: {
            youtube_url: "https://www.youtube.com/watch?v=abc123xyz00",
            youtube_embed_url: "https://www.youtube.com/embed/abc123xyz00",
            youtube_thumbnail_url: "https://i.ytimg.com/vi/abc123xyz00/hqdefault.jpg",
            youtube_title: "Sample Video",
          },
        },
      };

      useVaultStore.setState({
        ...useVaultStore.getState(),
        currentNote: youtubeNote as never,
      });
      useEditorStore.setState({
        ...useEditorStore.getState(),
        content: youtubeNote.content,
        isDirty: false,
      });

      render(<Editor />);
      fireEvent.click(screen.getByRole("tab", { name: "View" }));

      const button = screen.getByRole("button", { name: "Open Sample Video on YouTube" });
      fireEvent.click(button);
      expect(mockShellOpen).toHaveBeenCalledWith("https://www.youtube.com/watch?v=abc123xyz00");
    });

    it("disables toolbar history buttons when edit history is unavailable", () => {
      render(<Editor />);

      expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled();
    });

    it("runs toolbar undo against the live editor view", () => {
      const focus = vi.fn();
      let state = EditorState.create({
        schema,
        plugins: [history()],
        doc: schema.node("doc", null, [schema.node("paragraph", null, [schema.text("Alpha")])]),
      });

      state = state.apply(state.tr.insertText(" beta", 6));

      const view = {
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
        state,
        dispatch: vi.fn((tr) => {
          state = state.apply(tr);
          view.state = state;
        }),
        focus,
        coordsAtPos: vi.fn(() => ({ left: 200, right: 260, top: 220, bottom: 240 })),
      };

      mockInitProseMirrorEditor.mockImplementationOnce(() => ({
        destroy: vi.fn(),
        getMarkdown: vi.fn(() => "# Initial\n\nContent"),
        setMarkdown: vi.fn(),
        view,
      }));

      render(<Editor />);

      fireEvent.click(screen.getByRole("button", { name: "Undo" }));

      expect(view.dispatch).toHaveBeenCalledTimes(1);
      expect(state.doc.textContent).toBe("Alpha");
      expect(focus).toHaveBeenCalledTimes(1);
    });

    it("runs toolbar redo against the live editor view", () => {
      const focus = vi.fn();
      let state = EditorState.create({
        schema,
        plugins: [history()],
        doc: schema.node("doc", null, [schema.node("paragraph", null, [schema.text("Alpha")])]),
      });

      state = state.apply(state.tr.insertText(" beta", 6));
      undo(state, (tr) => {
        state = state.apply(tr);
      });

      const view = {
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
        state,
        dispatch: vi.fn((tr) => {
          state = state.apply(tr);
          view.state = state;
        }),
        focus,
        coordsAtPos: vi.fn(() => ({ left: 200, right: 260, top: 220, bottom: 240 })),
      };

      mockInitProseMirrorEditor.mockImplementationOnce(() => ({
        destroy: vi.fn(),
        getMarkdown: vi.fn(() => "# Initial\n\nContent"),
        setMarkdown: vi.fn(),
        view,
      }));

      render(<Editor />);

      fireEvent.click(screen.getByRole("button", { name: "Redo" }));

      expect(view.dispatch).toHaveBeenCalledTimes(1);
      expect(state.doc.textContent).toBe("Alpha beta");
      expect(focus).toHaveBeenCalledTimes(1);
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

    it("shows raw front matter in source mode but hides it in view mode", () => {
      const raw = [
        "---",
        "description: Hidden metadata",
        "author: Ada",
        "---",
        "# Visible",
        "",
        "Body text",
      ].join("\n");

      useVaultStore.setState({
        ...useVaultStore.getState(),
        currentNote: {
          id: "1",
          path: "test.md",
          title: "Test Note",
          content: raw,
          created_at: Date.now() / 1000,
          modified_at: Date.now() / 1000,
          word_count: 2,
          headings: [],
          backlinks: [],
        },
      });
      useEditorStore.setState({
        ...useEditorStore.getState(),
        content: raw,
        isDirty: false,
      });

      render(<Editor />);

      fireEvent.click(screen.getByRole("tab", { name: "Source" }));
      expect(screen.getByLabelText("Source markdown editor")).toHaveValue(raw);

      fireEvent.click(screen.getByRole("tab", { name: "View" }));
      expect(screen.getByRole("heading", { name: "Visible" })).toBeInTheDocument();
      expect(screen.queryByText("Hidden metadata")).not.toBeInTheDocument();
      expect(screen.queryByText("author: Ada")).not.toBeInTheDocument();
    });

    it("initializes edit mode with body markdown when front matter exists", () => {
      const raw = [
        "---",
        "description: Hidden metadata",
        "author: Ada",
        "---",
        "# Visible",
        "",
        "Body text",
      ].join("\n");

      useVaultStore.setState({
        ...useVaultStore.getState(),
        currentNote: {
          id: "1",
          path: "test.md",
          title: "Test Note",
          content: raw,
          created_at: Date.now() / 1000,
          modified_at: Date.now() / 1000,
          word_count: 2,
          headings: [],
          backlinks: [],
        },
      });

      render(<Editor />);

      const initCall = mockInitProseMirrorEditor.mock.calls[0];
      const options = initCall?.[1] as { initialContent?: string };
      expect(options.initialContent).toBe("# Visible\n\nBody text");
    });

    it("shows a meta form and saves merged front matter", async () => {
      const raw = [
        "---",
        "description: Existing summary",
        "custom_field: preserved",
        "---",
        "# Visible",
        "",
        "Body text",
      ].join("\n");

      useVaultStore.setState({
        ...useVaultStore.getState(),
        currentNote: {
          id: "1",
          path: "test.md",
          title: "Test Note",
          content: raw,
          created_at: Date.now() / 1000,
          modified_at: Date.now() / 1000,
          word_count: 2,
          headings: [],
          backlinks: [],
        },
      });
      useEditorStore.setState({
        ...useEditorStore.getState(),
        content: raw,
        isDirty: false,
      });
      vi.mocked(api.saveNote).mockResolvedValue(undefined);
      vi.mocked(api.getNote).mockResolvedValue({
        id: "1",
        path: "test.md",
        title: "Test Note",
        content: raw,
        created_at: Date.now() / 1000,
        modified_at: Date.now() / 1000,
        word_count: 2,
        headings: [],
        backlinks: [],
      });
      vi.mocked(useVaultStore.getState().loadNotes).mockResolvedValue();

      render(<Editor />);
      fireEvent.click(screen.getByRole("tab", { name: "Meta" }));

      fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Updated summary" } });
      fireEvent.change(screen.getByLabelText("Author"), { target: { value: "Ada Lovelace" } });
      fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
      fireEvent.change(screen.getByLabelText("Version"), { target: { value: "0.2.0" } });
      fireEvent.change(screen.getByLabelText("Tags"), { target: { value: "docs, metadata" } });

      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(api.saveNote).toHaveBeenCalled();
      });

      const savedContent = vi.mocked(api.saveNote).mock.calls.at(-1)?.[1];
      expect(savedContent).toContain("description: Updated summary");
      expect(savedContent).toContain("author: Ada Lovelace");
      expect(savedContent).toContain("email: ada@example.com");
      expect(savedContent).toContain("version: 0.2.0");
      expect(savedContent).toContain("custom_field: preserved");
      expect(savedContent).toContain("- docs");
      expect(savedContent).toContain("- metadata");
      expect(savedContent?.trimEnd().endsWith("Body text")).toBe(true);
    });

    // TRACE: DESIGN-note-metadata-frontmatter-011
    it("renders large metadata textareas at full width in meta mode", () => {
      render(<Editor />);
      fireEvent.click(screen.getByRole("tab", { name: "Meta" }));

      expect(screen.getByLabelText("Description").closest("label")).toHaveClass(
        "editor-meta-form__field--wide"
      );
      expect(screen.getByLabelText("Extra YAML").closest("label")).toHaveClass(
        "editor-meta-form__field--wide"
      );
    });

    it("blocks save when extra metadata yaml is invalid", async () => {
      const raw = "# Visible\n\nBody text";

      useVaultStore.setState({
        ...useVaultStore.getState(),
        currentNote: {
          id: "1",
          path: "test.md",
          title: "Test Note",
          content: raw,
          created_at: Date.now() / 1000,
          modified_at: Date.now() / 1000,
          word_count: 2,
          headings: [],
          backlinks: [],
        },
      });
      useEditorStore.setState({
        ...useEditorStore.getState(),
        content: raw,
        isDirty: false,
      });

      render(<Editor />);
      fireEvent.click(screen.getByRole("tab", { name: "Meta" }));

      fireEvent.change(screen.getByLabelText("Extra YAML"), { target: { value: "invalid: [" } });

      expect(screen.getByText(/valid yaml mapping/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      expect(api.saveNote).not.toHaveBeenCalled();
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
      expect(checkboxes[1]).not.toBeChecked();
    });

    it("toggles task list checkboxes in view mode and persists markdown", async () => {
      useVaultStore.setState({
        ...useVaultStore.getState(),
        currentNote: {
          id: "1",
          path: "test.md",
          title: "Test Note",
          content: "- [x] Done\n- [ ] Todo",
          created_at: Date.now() / 1000,
          modified_at: Date.now() / 1000,
          word_count: 2,
          headings: [],
          backlinks: [],
        },
      });
      useEditorStore.setState({
        ...useEditorStore.getState(),
        content: "- [x] Done\n- [ ] Todo",
        setContent: (next) =>
          useEditorStore.setState((prev) => ({
            ...prev,
            content: next,
            isDirty: true,
          })),
        markDirty: (next) =>
          useEditorStore.setState((prev) => ({
            ...prev,
            isDirty: next,
          })),
      });

      render(<Editor />);
      fireEvent.click(screen.getByRole("tab", { name: "View" }));

      const checkboxes = screen.getAllByRole("checkbox");
      fireEvent.click(checkboxes[1]);

      await waitFor(() => {
        expect(screen.getAllByRole("checkbox")[1]).toBeChecked();
      });

      fireEvent.click(screen.getByRole("tab", { name: "Source" }));
      expect(screen.getByLabelText("Source markdown editor")).toHaveValue("- [x] Done\n\n- [x] Todo");
      expect(useEditorStore.getState().isDirty).toBe(true);
    });

    it("reflects a view-mode task toggle after switching to edit mode", async () => {
      installTaskRoundtripStore("- [x] Done\n- [ ] Todo");

      render(<Editor />);
      fireEvent.click(screen.getByRole("tab", { name: "View" }));
      fireEvent.click(screen.getAllByRole("checkbox")[1]);

      await waitFor(() => {
        expect(useEditorStore.getState().content).toContain("- [x] Todo");
      });

      fireEvent.click(screen.getByRole("tab", { name: "Edit" }));

      const initCall = mockInitProseMirrorEditor.mock.calls.at(-1);
      const options = initCall?.[1] as { initialContent?: string };
      expect(options.initialContent).toBe("- [x] Done\n\n- [x] Todo");
    });

    it("reflects a view-mode task toggle after switching to source mode", async () => {
      installTaskRoundtripStore("- [x] Done\n- [ ] Todo");

      render(<Editor />);
      fireEvent.click(screen.getByRole("tab", { name: "View" }));
      fireEvent.click(screen.getAllByRole("checkbox")[1]);

      await waitFor(() => {
        expect(useEditorStore.getState().content).toContain("- [x] Todo");
      });

      fireEvent.click(screen.getByRole("tab", { name: "Source" }));
      expect(screen.getByLabelText("Source markdown editor")).toHaveValue("- [x] Done\n\n- [x] Todo");
    });

    it("reflects an edit-mode task toggle after switching to view mode", async () => {
      installTaskRoundtripStore("- [x] Done\n- [ ] Todo");

      let latestOnChange:
        | ((payload: { markdown: string; selection?: { from: number; to: number; empty: boolean } }) => void)
        | undefined;
      mockInitProseMirrorEditor.mockImplementationOnce((_container, options) => {
        latestOnChange = (options as { onChange?: typeof latestOnChange }).onChange;
        return {
          destroy: vi.fn(),
          getMarkdown: vi.fn(() => useEditorStore.getState().content),
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
        };
      });

      render(<Editor />);

      act(() => {
        latestOnChange?.({
          markdown: "- [x] Done\n- [x] Todo",
          selection: { from: 1, to: 1, empty: true },
        });
      });

      fireEvent.click(screen.getByRole("tab", { name: "View" }));

      await waitFor(() => {
        expect(screen.getAllByRole("checkbox")[1]).toBeChecked();
      });
    });

    it("reflects an edit-mode task toggle after switching to source mode", async () => {
      installTaskRoundtripStore("- [x] Done\n- [ ] Todo");

      let latestOnChange:
        | ((payload: { markdown: string; selection?: { from: number; to: number; empty: boolean } }) => void)
        | undefined;
      mockInitProseMirrorEditor.mockImplementationOnce((_container, options) => {
        latestOnChange = (options as { onChange?: typeof latestOnChange }).onChange;
        return {
          destroy: vi.fn(),
          getMarkdown: vi.fn(() => useEditorStore.getState().content),
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
        };
      });

      render(<Editor />);

      act(() => {
        latestOnChange?.({
          markdown: "- [x] Done\n- [x] Todo",
          selection: { from: 1, to: 1, empty: true },
        });
      });

      fireEvent.click(screen.getByRole("tab", { name: "Source" }));
      expect(screen.getByLabelText("Source markdown editor")).toHaveValue("- [x] Done\n- [x] Todo");
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
      expect(screen.getByRole("button", { name: "Inline math" })).toBeInTheDocument();
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
      expect(within(menu).getByRole("menuitem", { name: "Math block" })).toBeInTheDocument();
      expect(within(menu).getByRole("menuitem", { name: "Mermaid diagram" })).toBeInTheDocument();
      expect(within(menu).getByRole("menuitem", { name: "Code block" })).toBeInTheDocument();
      expect(within(menu).getByRole("menuitem", { name: "Blockquote" })).toBeInTheDocument();
      expect(within(menu).getByTestId("block-menu-icon-h1")).toBeInTheDocument();
      expect(within(menu).getByTestId("block-menu-icon-h2")).toBeInTheDocument();
      expect(within(menu).getByTestId("block-menu-icon-h3")).toBeInTheDocument();
      expect(within(menu).getByTestId("block-menu-icon-bullet")).toBeInTheDocument();
      expect(within(menu).getByTestId("block-menu-icon-ordered")).toBeInTheDocument();
      expect(within(menu).getByTestId("block-menu-icon-hr")).toBeInTheDocument();
      expect(within(menu).getByTestId("block-menu-icon-math")).toBeInTheDocument();
      expect(within(menu).getByTestId("block-menu-icon-mermaid")).toBeInTheDocument();
      expect(within(menu).getByTestId("block-menu-icon-code")).toBeInTheDocument();
      expect(within(menu).getByTestId("block-menu-icon-quote")).toBeInTheDocument();
    });

    it("inserts display math from the block menu", async () => {
      const tr = {
        doc: schema.node("doc", null, [schema.node("paragraph", null, [schema.text("Start")])]),
        insert: vi.fn().mockReturnThis(),
        scrollIntoView: vi.fn().mockReturnThis(),
        setSelection: vi.fn().mockReturnThis(),
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
              $from: {
                depth: 1,
                parent: { isTextblock: true },
                after: vi.fn(() => 10),
              },
            },
            tr,
            doc: tr.doc,
          },
          dispatch: vi.fn(),
          focus: vi.fn(),
          coordsAtPos: vi.fn(() => ({ left: 200, right: 260, top: 220, bottom: 240 })),
        },
      }));

      render(<Editor />);
      fireEvent.click(screen.getByRole("tab", { name: "Edit" }));
      fireEvent.click(await screen.findByRole("button", { name: "Open block menu" }));
      fireEvent.click(await screen.findByRole("menuitem", { name: "Math block" }));

      expect(tr.insert).toHaveBeenCalledTimes(1);
      const insertedNode = tr.insert.mock.calls[0]?.[1];
      expect(insertedNode?.type?.name).toBe("math_display");
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

    it("should save on a persisted custom save shortcut", async () => {
      render(
        <Editor
          appKeymapSettings={{
            keymaps: {
              general: {
                save_note: "Alt-s",
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
          }}
        />
      );

      fireEvent.keyDown(window, { key: "s", altKey: true });

      await waitFor(() => {
        expect(api.saveNote).toHaveBeenCalledWith("test.md", "# Test\n\nUpdated");
      });
    });

    it("clears paragraph formatting on a persisted managed shortcut in edit mode", async () => {
      const dispatch = vi.fn();
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
          state: EditorState.create({
            schema,
            doc: schema.node("doc", null, [
              schema.node("heading", { level: 2 }, [schema.text("Section title")]),
            ]),
          }),
          dispatch,
          focus: vi.fn(),
          coordsAtPos: vi.fn(() => ({ left: 200, right: 260, top: 220, bottom: 240 })),
        },
      }));

      render(
        <Editor
          appKeymapSettings={{
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
                clear_paragraph: "Alt-0",
              },
            },
            graph: {
              readability_floor_percent: 70,
            },
          }}
        />
      );

      fireEvent.keyDown(window, { key: "0", altKey: true });

      await waitFor(() => {
        expect(dispatch).toHaveBeenCalledTimes(1);
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

    it("toggles a task through the UI automation behavior event and reports success", async () => {
      installTaskRoundtripStore("- [x] Done\n- [ ] Todo", "knot/issues.md");

      render(<Editor />);

      const resultPromise = new Promise<CustomEvent<{ success: boolean; payload?: { editor_mode?: string } }>>(
        (resolve) => {
          const handler = (event: Event) => {
            window.removeEventListener("ui-automation-editor-result", handler);
            resolve(event as CustomEvent<{ success: boolean; payload?: { editor_mode?: string } }>);
          };
          window.addEventListener("ui-automation-editor-result", handler);
        }
      );

      await act(async () => {
        window.dispatchEvent(
          new CustomEvent("ui-automation-editor-request", {
            detail: {
              requestId: "req-1",
              behaviorId: "core.task.toggle",
              path: "knot/issues.md",
              taskIndex: 1,
              mode: "view",
            },
          })
        );

        await resultPromise;
      });

      const resultEvent = await resultPromise;

      expect(resultEvent.detail.success).toBe(true);
      expect(resultEvent.detail.payload?.editor_mode).toBe("view");
      expect(useEditorStore.getState().content).toBe("- [x] Done\n\n- [x] Todo");
      await waitFor(() => {
        expect(screen.getByRole("tab", { name: "View" })).toHaveAttribute("aria-selected", "true");
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
