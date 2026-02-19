import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Editor } from "./index";
import { useVaultStore, useEditorStore } from "@lib/store";
import * as api from "@lib/api";

vi.mock("@lib/api");
vi.mock("@editor/index", () => ({
  initProseMirrorEditor: vi.fn(() => ({
    destroy: vi.fn(),
    getMarkdown: vi.fn(() => "# Initial\n\nContent"),
    setMarkdown: vi.fn(),
  })),
}));

describe("Editor Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      expect(screen.getByText(/Or create a new note using the \+ button/)).toBeInTheDocument();
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
