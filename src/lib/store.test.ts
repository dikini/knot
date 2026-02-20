import { describe, it, expect, vi, beforeEach } from "vitest";
import { useVaultStore, useEditorStore } from "./store";
import * as api from "./api";

vi.mock("./api");

describe("Vault Store", () => {
  beforeEach(() => {
    useVaultStore.setState({
      vault: null,
      currentNote: null,
      noteList: [],
      isLoading: false,
      error: null,
      shell: {
        toolMode: "notes",
        isToolRailCollapsed: false,
        isContextPanelCollapsed: false,
        isInspectorRailOpen: false,
        contextPanelWidth: 320,
        densityMode: "comfortable",
      },
    });
    vi.clearAllMocks();
  });

  describe("State Management", () => {
    it("should have initial state", () => {
      const state = useVaultStore.getState();

      expect(state.vault).toBeNull();
      expect(state.currentNote).toBeNull();
      expect(state.noteList).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.shell.toolMode).toBe("notes");
      expect(state.shell.isToolRailCollapsed).toBe(false);
      expect(state.shell.isContextPanelCollapsed).toBe(false);
      expect(state.shell.isInspectorRailOpen).toBe(false);
      expect(state.shell.contextPanelWidth).toBe(320);
      expect(state.shell.densityMode).toBe("comfortable");
    });

    it("should update shell mode and collapse toggles", () => {
      useVaultStore.getState().setShellToolMode("graph");
      useVaultStore.getState().toggleToolRail();
      useVaultStore.getState().toggleContextPanel();
      useVaultStore.getState().setInspectorRailOpen(true);
      useVaultStore.getState().setContextPanelWidth(512);
      useVaultStore.getState().setDensityMode("adaptive");

      const updated = useVaultStore.getState();
      expect(updated.shell.toolMode).toBe("graph");
      expect(updated.shell.isToolRailCollapsed).toBe(true);
      expect(updated.shell.isContextPanelCollapsed).toBe(true);
      expect(updated.shell.isInspectorRailOpen).toBe(true);
      expect(updated.shell.contextPanelWidth).toBe(512);
      expect(updated.shell.densityMode).toBe("adaptive");
    });

    it("should set vault", () => {
      const mockVault = {
        path: "/test/vault",
        name: "Test Vault",
        note_count: 5,
        last_modified: Date.now() / 1000,
      };

      useVaultStore.getState().setVault(mockVault);

      const state = useVaultStore.getState();
      expect(state.vault).toEqual(mockVault);
      expect(state.error).toBeNull();
    });

    it("should set current note", () => {
      const mockNote = {
        id: "1",
        path: "note1.md",
        title: "Note 1",
        content: "Content",
        created_at: Date.now() / 1000,
        modified_at: Date.now() / 1000,
        word_count: 100,
        headings: [],
        backlinks: [],
      };

      useVaultStore.getState().setCurrentNote(mockNote);

      expect(useVaultStore.getState().currentNote).toEqual(mockNote);
    });

    it("should set note list", () => {
      const mockNotes = [
        {
          id: "1",
          path: "note1.md",
          title: "Note 1",
          created_at: Date.now() / 1000,
          modified_at: Date.now() / 1000,
          word_count: 100,
        },
      ];

      useVaultStore.getState().setNoteList(mockNotes);

      expect(useVaultStore.getState().noteList).toEqual(mockNotes);
    });

    it("should set loading state", () => {
      useVaultStore.getState().setLoading(true);
      expect(useVaultStore.getState().isLoading).toBe(true);

      useVaultStore.getState().setLoading(false);
      expect(useVaultStore.getState().isLoading).toBe(false);
    });

    it("should set error", () => {
      useVaultStore.getState().setError("Test error");
      expect(useVaultStore.getState().error).toBe("Test error");
    });

    it("should check hasVault", () => {
      const state = useVaultStore.getState();
      expect(state.hasVault()).toBe(false);

      state.setVault({
        path: "/test",
        name: "Test",
        note_count: 0,
        last_modified: 0,
      });

      expect(state.hasVault()).toBe(true);
    });

    it("should check hasNote", () => {
      const state = useVaultStore.getState();
      expect(state.hasNote()).toBe(false);

      state.setCurrentNote({
        id: "1",
        path: "note.md",
        title: "Note",
        content: "",
        created_at: 0,
        modified_at: 0,
        word_count: 0,
        headings: [],
        backlinks: [],
      });

      expect(state.hasNote()).toBe(true);
    });
  });

  describe("API Actions", () => {
    it("should open vault successfully", async () => {
      const mockVaultInfo = {
        path: "/test/vault",
        name: "Test Vault",
        note_count: 5,
        last_modified: Date.now() / 1000,
      };

      const mockNotes = [
        {
          id: "1",
          path: "note1.md",
          title: "Note 1",
          created_at: Date.now() / 1000,
          modified_at: Date.now() / 1000,
          word_count: 100,
        },
      ];

      vi.mocked(api.openVault).mockResolvedValue(mockVaultInfo);
      vi.mocked(api.listNotes).mockResolvedValue(mockNotes);

      await useVaultStore.getState().openVault("/test/vault");

      expect(api.openVault).toHaveBeenCalledWith("/test/vault");
      expect(api.listNotes).toHaveBeenCalled();

      const state = useVaultStore.getState();
      expect(state.vault).toEqual(mockVaultInfo);
      expect(state.noteList).toEqual(mockNotes);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it("should handle open vault error", async () => {
      const error = new Error("Failed to open vault");
      vi.mocked(api.openVault).mockRejectedValue(error);

      await useVaultStore.getState().openVault("/test/vault");

      const state = useVaultStore.getState();
      expect(state.error).toBe("Failed to open vault");
      expect(state.isLoading).toBe(false);
    });

    it("should close vault successfully", async () => {
      vi.mocked(api.closeVault).mockResolvedValue(undefined);

      useVaultStore.getState().setVault({
        path: "/test",
        name: "Test",
        note_count: 5,
        last_modified: 0,
      });

      await useVaultStore.getState().closeVault();

      expect(api.closeVault).toHaveBeenCalled();

      const state = useVaultStore.getState();
      expect(state.vault).toBeNull();
      expect(state.currentNote).toBeNull();
      expect(state.noteList).toEqual([]);
      expect(state.isLoading).toBe(false);
    });

    it("should handle close vault error", async () => {
      const error = new Error("Failed to close vault");
      vi.mocked(api.closeVault).mockRejectedValue(error);

      useVaultStore.getState().setVault({
        path: "/test",
        name: "Test",
        note_count: 5,
        last_modified: 0,
      });

      await useVaultStore.getState().closeVault();

      const state = useVaultStore.getState();
      expect(state.error).toBe("Failed to close vault");
      expect(state.isLoading).toBe(false);
    });

    it("should load notes successfully", async () => {
      const mockNotes = [
        {
          id: "1",
          path: "note1.md",
          title: "Note 1",
          created_at: Date.now() / 1000,
          modified_at: Date.now() / 1000,
          word_count: 100,
        },
      ];

      vi.mocked(api.listNotes).mockResolvedValue(mockNotes);

      useVaultStore.getState().setVault({
        path: "/test",
        name: "Test",
        note_count: 5,
        last_modified: 0,
      });

      await useVaultStore.getState().loadNotes();

      expect(api.listNotes).toHaveBeenCalled();

      const state = useVaultStore.getState();
      expect(state.noteList).toEqual(mockNotes);
      expect(state.isLoading).toBe(false);
    });

    it("should not load notes if no vault is open", async () => {
      const state = useVaultStore.getState();
      await state.loadNotes();

      expect(api.listNotes).not.toHaveBeenCalled();
    });

    it("should handle load notes error", async () => {
      const error = new Error("Failed to load notes");
      vi.mocked(api.listNotes).mockRejectedValue(error);

      useVaultStore.getState().setVault({
        path: "/test",
        name: "Test",
        note_count: 5,
        last_modified: 0,
      });

      await useVaultStore.getState().loadNotes();

      const state = useVaultStore.getState();
      expect(state.error).toBe("Failed to load notes");
      expect(state.isLoading).toBe(false);
    });

    it("should load note successfully", async () => {
      const mockNote = {
        id: "1",
        path: "note1.md",
        title: "Note 1",
        content: "# Test\n\nContent",
        created_at: Date.now() / 1000,
        modified_at: Date.now() / 1000,
        word_count: 100,
        headings: [],
        backlinks: [],
      };

      vi.mocked(api.getNote).mockResolvedValue(mockNote);

      useVaultStore.getState().setVault({
        path: "/test",
        name: "Test",
        note_count: 5,
        last_modified: 0,
      });

      await useVaultStore.getState().loadNote("note1.md");

      expect(api.getNote).toHaveBeenCalledWith("note1.md");

      const state = useVaultStore.getState();
      expect(state.currentNote).toEqual(mockNote);
      expect(state.isLoading).toBe(false);
    });

    it("should not load note if no vault is open", async () => {
      const state = useVaultStore.getState();
      await state.loadNote("note1.md");

      expect(api.getNote).not.toHaveBeenCalled();
    });

    it("should handle load note error", async () => {
      const error = new Error("Failed to load note");
      vi.mocked(api.getNote).mockRejectedValue(error);

      useVaultStore.getState().setVault({
        path: "/test",
        name: "Test",
        note_count: 5,
        last_modified: 0,
      });

      await useVaultStore.getState().loadNote("note1.md");

      const state = useVaultStore.getState();
      expect(state.error).toBe("Failed to load note");
      expect(state.isLoading).toBe(false);
    });

    it("should save current note successfully", async () => {
      const mockNote = {
        id: "1",
        path: "note1.md",
        title: "Note 1",
        content: "# Test\n\nContent",
        created_at: Date.now() / 1000,
        modified_at: Date.now() / 1000,
        word_count: 100,
        headings: [],
        backlinks: [],
      };

      vi.mocked(api.saveNote).mockResolvedValue(undefined);
      vi.mocked(api.getNote).mockResolvedValue(mockNote);
      vi.mocked(api.listNotes).mockResolvedValue([]);

      const state = useVaultStore.getState();
      state.setCurrentNote(mockNote);
      state.setVault({
        path: "/test",
        name: "Test",
        note_count: 0,
        last_modified: 0,
      });

      await state.saveCurrentNote("Updated content");

      expect(api.saveNote).toHaveBeenCalledWith("note1.md", "Updated content");

      expect(state.isLoading).toBe(false);
    });

    it("should not save if no current note", async () => {
      const state = useVaultStore.getState();
      await state.saveCurrentNote("Content");

      expect(api.saveNote).not.toHaveBeenCalled();
    });

    it("should handle save note error", async () => {
      const mockNote = {
        id: "1",
        path: "note1.md",
        title: "Note 1",
        content: "# Test\n\nContent",
        created_at: Date.now() / 1000,
        modified_at: Date.now() / 1000,
        word_count: 100,
        headings: [],
        backlinks: [],
      };

      const error = new Error("Failed to save note");
      vi.mocked(api.saveNote).mockRejectedValue(error);

      useVaultStore.getState().setCurrentNote(mockNote);

      await useVaultStore.getState().saveCurrentNote("Updated content");

      const state = useVaultStore.getState();
      expect(state.error).toBe("Failed to save note");
      expect(state.isLoading).toBe(false);
    });
  });
});

describe("Editor Store", () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
    vi.clearAllMocks();
  });

  describe("State Management", () => {
    it("should have initial state", () => {
      const state = useEditorStore.getState();

      expect(state.content).toBe("");
      expect(state.isDirty).toBe(false);
      expect(state.cursorPosition).toBe(0);
    });

    it("should set content and mark dirty", () => {
      useEditorStore.getState().setContent("New content");

      const state = useEditorStore.getState();
      expect(state.content).toBe("New content");
      expect(state.isDirty).toBe(true);
    });

    it("should mark dirty", () => {
      useEditorStore.getState().markDirty(true);
      expect(useEditorStore.getState().isDirty).toBe(true);

      useEditorStore.getState().markDirty(false);
      expect(useEditorStore.getState().isDirty).toBe(false);
    });

    it("should set cursor position", () => {
      useEditorStore.getState().setCursorPosition(10);
      expect(useEditorStore.getState().cursorPosition).toBe(10);
    });

    it("should reset state", () => {
      useEditorStore.getState().setContent("Content");
      useEditorStore.getState().markDirty(true);
      useEditorStore.getState().setCursorPosition(5);

      useEditorStore.getState().reset();

      const state = useEditorStore.getState();
      expect(state.content).toBe("");
      expect(state.isDirty).toBe(false);
      expect(state.cursorPosition).toBe(0);
    });
  });
});
