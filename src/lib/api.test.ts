import { describe, it, expect, vi, beforeEach } from "vitest";
import * as api from "./api";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core");

describe("API Client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Vault Operations", () => {
    it("should create a vault", async () => {
      const mockVaultInfo = {
        path: "/test/vault",
        name: "Test Vault",
        note_count: 0,
        last_modified: Date.now() / 1000,
      };

      vi.mocked(invoke).mockResolvedValue(mockVaultInfo);

      const result = await api.createVault("/test/vault");

      expect(invoke).toHaveBeenCalledWith("create_vault", { path: "/test/vault" });
      expect(result).toEqual(mockVaultInfo);
    });

    it("should open a vault", async () => {
      const mockVaultInfo = {
        path: "/test/vault",
        name: "Test Vault",
        note_count: 5,
        last_modified: Date.now() / 1000,
      };

      vi.mocked(invoke).mockResolvedValue(mockVaultInfo);

      const result = await api.openVault("/test/vault");

      expect(invoke).toHaveBeenCalledWith("open_vault", { path: "/test/vault" });
      expect(result).toEqual(mockVaultInfo);
    });

    it("should close a vault", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await api.closeVault();

      expect(invoke).toHaveBeenCalledWith("close_vault");
    });

    it("should get vault info", async () => {
      const mockVaultInfo = {
        path: "/test/vault",
        name: "Test Vault",
        note_count: 5,
        last_modified: Date.now() / 1000,
      };

      vi.mocked(invoke).mockResolvedValue(mockVaultInfo);

      const result = await api.getVaultInfo();

      expect(invoke).toHaveBeenCalledWith("get_vault_info");
      expect(result).toEqual(mockVaultInfo);
    });

    it("should return null when no vault is open", async () => {
      vi.mocked(invoke).mockRejectedValue("No vault is open");

      const result = await api.getVaultInfo();

      expect(result).toBeNull();
    });

    it("should check if vault is open", async () => {
      vi.mocked(invoke).mockResolvedValue(true);

      const result = await api.isVaultOpen();

      expect(invoke).toHaveBeenCalledWith("is_vault_open");
      expect(result).toBe(true);
    });

    it("should get recent notes", async () => {
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

      vi.mocked(invoke).mockResolvedValue(mockNotes);

      const result = await api.getRecentNotes(10);

      expect(invoke).toHaveBeenCalledWith("get_recent_notes", { limit: 10 });
      expect(result).toEqual(mockNotes);
    });

    it("should open vault dialog", async () => {
      const mockVaultInfo = {
        path: "/selected/vault",
        name: "Selected Vault",
        note_count: 3,
        last_modified: Date.now() / 1000,
      };

      vi.mocked(invoke).mockResolvedValue(mockVaultInfo);

      const result = await api.openVaultDialog();

      expect(invoke).toHaveBeenCalledWith("open_vault_dialog");
      expect(result).toEqual(mockVaultInfo);
    });

    it("should create vault dialog", async () => {
      const mockVaultInfo = {
        path: "/created/vault",
        name: "Created Vault",
        note_count: 0,
        last_modified: Date.now() / 1000,
      };

      vi.mocked(invoke).mockResolvedValue(mockVaultInfo);

      const result = await api.createVaultDialog();

      expect(invoke).toHaveBeenCalledWith("create_vault_dialog");
      expect(result).toEqual(mockVaultInfo);
    });

    it("should get recent vaults", async () => {
      const mockRecentVaults = [
        {
          path: "/vault1",
          name: "Vault 1",
          opened_at: Date.now(),
        },
      ];

      vi.mocked(invoke).mockResolvedValue(mockRecentVaults);

      const result = await api.getRecentVaults();

      expect(invoke).toHaveBeenCalledWith("get_recent_vaults");
      expect(result).toEqual(mockRecentVaults);
    });

    it("should add recent vault", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await api.addRecentVault("/test/vault");

      expect(invoke).toHaveBeenCalledWith("add_recent_vault", { path: "/test/vault" });
    });

    it("should sync external changes", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await api.syncExternalChanges();

      expect(invoke).toHaveBeenCalledWith("sync_external_changes");
    });

    it("should sync unsaved changes state", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await api.setUnsavedChanges(true);

      expect(invoke).toHaveBeenCalledWith("set_unsaved_changes", { dirty: true });
    });
  });

  describe("Note Operations", () => {
    it("should list notes", async () => {
      const mockNotes = [
        {
          id: "1",
          path: "note1.md",
          title: "Note 1",
          created_at: Date.now() / 1000,
          modified_at: Date.now() / 1000,
          word_count: 100,
        },
        {
          id: "2",
          path: "note2.md",
          title: "Note 2",
          created_at: Date.now() / 1000,
          modified_at: Date.now() / 1000,
          word_count: 200,
        },
      ];

      vi.mocked(invoke).mockResolvedValue(mockNotes);

      const result = await api.listNotes();

      expect(invoke).toHaveBeenCalledWith("list_notes");
      expect(result).toEqual(mockNotes);
    });

    it("should get a note", async () => {
      const mockNote = {
        id: "1",
        path: "note1.md",
        title: "Note 1",
        content: "# Test Note\n\nContent",
        created_at: Date.now() / 1000,
        modified_at: Date.now() / 1000,
        word_count: 100,
        headings: [],
        backlinks: [],
      };

      vi.mocked(invoke).mockResolvedValue(mockNote);

      const result = await api.getNote("note1.md");

      expect(invoke).toHaveBeenCalledWith("get_note", { path: "note1.md" });
      expect(result).toEqual(mockNote);
    });

    it("should save a note", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await api.saveNote("note1.md", "# Test\n\nContent");

      expect(invoke).toHaveBeenCalledWith("save_note", {
        path: "note1.md",
        content: "# Test\n\nContent",
      });
    });

    it("should delete a note", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await api.deleteNote("note1.md");

      expect(invoke).toHaveBeenCalledWith("delete_note", { path: "note1.md" });
    });

    it("should rename a note", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await api.renameNote("old.md", "new.md");

      expect(invoke).toHaveBeenCalledWith("rename_note", {
        oldPath: "old.md",
        newPath: "new.md",
      });
    });

    it("should create a note", async () => {
      const mockNote = {
        id: "1",
        path: "new.md",
        title: "New",
        content: "# New\n\n",
        created_at: Date.now() / 1000,
        modified_at: Date.now() / 1000,
        word_count: 0,
        headings: [],
        backlinks: [],
      };

      vi.mocked(invoke).mockResolvedValue(mockNote);

      const result = await api.createNote("new.md", "# New\n\n");

      expect(invoke).toHaveBeenCalledWith("create_note", {
        path: "new.md",
        content: "# New\n\n",
      });
      expect(result).toEqual(mockNote);
    });
  });

  describe("Search Operations", () => {
    it("should search notes", async () => {
      const mockResults = [
        {
          path: "note1.md",
          title: "Note 1",
          excerpt: "matching text",
          score: 0.9,
        },
      ];

      vi.mocked(invoke).mockResolvedValue(mockResults);

      const result = await api.searchNotes("query", 10);

      expect(invoke).toHaveBeenCalledWith("search_notes", { query: "query", limit: 10 });
      expect(result).toEqual(mockResults);
    });

    it("should get search suggestions", async () => {
      const mockSuggestions = ["suggestion1", "suggestion2"];

      vi.mocked(invoke).mockResolvedValue(mockSuggestions);

      const result = await api.searchSuggestions("que", 5);

      expect(invoke).toHaveBeenCalledWith("search_suggestions", {
        query: "que",
        limit: 5,
      });
      expect(result).toEqual(mockSuggestions);
    });
  });

  describe("Graph Operations", () => {
    it("should get graph layout", async () => {
      const mockLayout = {
        nodes: [{ id: "1", label: "Note 1", x: 100, y: 200 }],
        edges: [{ source: "1", target: "2" }],
      };

      vi.mocked(invoke).mockResolvedValue(mockLayout);

      const result = await api.getGraphLayout(800, 600);

      expect(invoke).toHaveBeenCalledWith("get_graph_layout", { width: 800, height: 600 });
      expect(result).toEqual(mockLayout);
    });
  });

  describe("Explorer Operations", () => {
    it("should get explorer tree", async () => {
      const mockTree = {
        root: {
          path: "",
          name: "test-vault",
          expanded: true,
          folders: [],
          notes: [],
        },
        hidden_policy: "hide-dotfiles",
      };

      vi.mocked(invoke).mockResolvedValue(mockTree);
      const result = await api.getExplorerTree();
      expect(invoke).toHaveBeenCalledWith("get_explorer_tree");
      expect(result).toEqual(mockTree);
    });

    it("should persist folder expansion", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);
      await api.setFolderExpanded("Programming", true);
      expect(invoke).toHaveBeenCalledWith("set_folder_expanded", {
        path: "Programming",
        expanded: true,
      });
    });

    it("should create directory", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);
      await api.createDirectory("Programming/Algorithms");
      expect(invoke).toHaveBeenCalledWith("create_directory", {
        path: "Programming/Algorithms",
      });
    });

    it("should rename directory", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);
      await api.renameDirectory("Programming", "Engineering");
      expect(invoke).toHaveBeenCalledWith("rename_directory", {
        oldPath: "Programming",
        newPath: "Engineering",
      });
    });

    it("should delete directory", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);
      await api.deleteDirectory("Archive", true);
      expect(invoke).toHaveBeenCalledWith("delete_directory", {
        path: "Archive",
        recursive: true,
      });
    });
  });

  describe("Error Handling", () => {
    it("should throw error when invoke throws Error", async () => {
      vi.mocked(invoke).mockRejectedValue(new Error("API Error"));

      await expect(api.createVault("/test")).rejects.toThrow("API Error");
    });

    it("should throw error when invoke throws string", async () => {
      vi.mocked(invoke).mockRejectedValue("String Error");

      await expect(api.createVault("/test")).rejects.toThrow("String Error");
    });

    it("should throw error when invoke throws unknown", async () => {
      vi.mocked(invoke).mockRejectedValue({ unknown: "error" });

      await expect(api.createVault("/test")).rejects.toThrow("[object Object]");
    });
  });

  describe("Test Command", () => {
    it("should greet", async () => {
      vi.mocked(invoke).mockResolvedValue("Hello, World!");

      const result = await api.greet("World");

      expect(invoke).toHaveBeenCalledWith("greet", { name: "World" });
      expect(result).toBe("Hello, World!");
    });
  });
});
