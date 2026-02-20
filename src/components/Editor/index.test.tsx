import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Editor } from "./index";
import { useVaultStore, useEditorStore } from "@lib/store";
import * as api from "@lib/api";

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

    it("shows selection toolbar when edit selection is non-empty", async () => {
      render(<Editor />);
      fireEvent.click(screen.getByRole("tab", { name: "Edit" }));

      const initCall = mockInitProseMirrorEditor.mock.calls[0];
      const options = initCall?.[1] as {
        onSelectionChange?: (selection: { from: number; to: number; empty: boolean }) => void;
      };
      options.onSelectionChange?.({ from: 1, to: 4, empty: false });

      await waitFor(() => {
        expect(screen.getByRole("toolbar", { name: "Selection formatting" })).toBeInTheDocument();
      });
      expect(screen.getByRole("button", { name: "Bold" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Italic" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Code" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Link" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Quote" })).not.toBeInTheDocument();
    });

    it("shows block plus tool on collapsed cursor selection", async () => {
      render(<Editor />);
      fireEvent.click(screen.getByRole("tab", { name: "Edit" }));

      const initCall = mockInitProseMirrorEditor.mock.calls[0];
      const options = initCall?.[1] as {
        onSelectionChange?: (selection: { from: number; to: number; empty: boolean }) => void;
      };
      options.onSelectionChange?.({ from: 2, to: 2, empty: true });

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Open block menu" })).toBeInTheDocument();
      });
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
