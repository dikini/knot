/**
 * Knot API Client
 *
 * Type-safe wrapper around Tauri commands.
 * All functions return Promises and use the refactored Rust core.
 * SPEC: COMP-FRONTEND-001 FR-4
 */

import { invoke } from "@tauri-apps/api/core";
import type {
  VaultInfo,
  NoteSummary,
  NoteData,
  SearchResult,
  GraphLayout,
  ExplorerTree,
} from "../types/vault";

/**
 * Recent vault entry for quick access.
 */
export interface RecentVault {
  path: string;
  name: string;
  opened_at: number;
}

// Helper to handle errors consistently
function handleError(error: unknown): never {
  if (typeof error === "string") {
    throw new Error(error);
  }
  if (error instanceof Error) {
    throw error;
  }
  throw new Error(String(error));
}

//region Vault Operations

/**
 * Create a new vault at the specified path.
 */
export async function createVault(path: string): Promise<VaultInfo> {
  try {
    return await invoke<VaultInfo>("create_vault", { path });
  } catch (error) {
    handleError(error);
  }
}

/**
 * Open an existing vault at the specified path.
 */
export async function openVault(path: string): Promise<VaultInfo> {
  try {
    return await invoke<VaultInfo>("open_vault", { path });
  } catch (error) {
    handleError(error);
  }
}

/**
 * Close the currently open vault.
 */
export async function closeVault(): Promise<void> {
  try {
    return await invoke("close_vault");
  } catch (error) {
    handleError(error);
  }
}

/**
 * Get information about the currently open vault.
 */
export async function getVaultInfo(): Promise<VaultInfo | null> {
  try {
    return await invoke<VaultInfo>("get_vault_info");
  } catch (error) {
    if (typeof error === "string" && error.includes("No vault is open")) {
      return null;
    }
    handleError(error);
  }
}

/**
 * Check if a vault is currently open.
 */
export async function isVaultOpen(): Promise<boolean> {
  try {
    return await invoke<boolean>("is_vault_open");
  } catch (error) {
    handleError(error);
  }
}

/**
 * Get recently modified notes.
 */
export async function getRecentNotes(limit: number = 20): Promise<NoteSummary[]> {
  try {
    return await invoke<NoteSummary[]>("get_recent_notes", { limit });
  } catch (error) {
    handleError(error);
  }
}

/**
 * Open a vault using the system file dialog.
 * SPEC: COMP-VAULT-UI-001 FR-1
 */
export async function openVaultDialog(): Promise<VaultInfo> {
  try {
    return await invoke<VaultInfo>("open_vault_dialog");
  } catch (error) {
    handleError(error);
  }
}

/**
 * Create a new vault using the system file dialog.
 * SPEC: COMP-VAULT-UI-001 FR-2
 */
export async function createVaultDialog(): Promise<VaultInfo> {
  try {
    return await invoke<VaultInfo>("create_vault_dialog");
  } catch (error) {
    handleError(error);
  }
}

/**
 * Get the list of recently opened vaults.
 */
export async function getRecentVaults(): Promise<RecentVault[]> {
  try {
    return await invoke<RecentVault[]>("get_recent_vaults");
  } catch (error) {
    handleError(error);
  }
}

/**
 * Add a vault to the recent vaults list.
 */
export async function addRecentVault(path: string): Promise<void> {
  try {
    return await invoke("add_recent_vault", { path });
  } catch (error) {
    handleError(error);
  }
}

/**
 * Sync external file changes into the vault.
 *
 * Polls the file watcher for changes made outside the application.
 */
export async function syncExternalChanges(): Promise<void> {
  try {
    return await invoke("sync_external_changes");
  } catch (error) {
    handleError(error);
  }
}

//endregion

//region Note Operations

/**
 * List all notes in the vault.
 */
export async function listNotes(): Promise<NoteSummary[]> {
  try {
    return await invoke<NoteSummary[]>("list_notes");
  } catch (error) {
    handleError(error);
  }
}

/**
 * Get a note by its path.
 */
export async function getNote(path: string): Promise<NoteData> {
  try {
    return await invoke<NoteData>("get_note", { path });
  } catch (error) {
    handleError(error);
  }
}

/**
 * Save a note.
 */
export async function saveNote(path: string, content: string): Promise<void> {
  try {
    return await invoke("save_note", { path, content });
  } catch (error) {
    handleError(error);
  }
}

/**
 * Delete a note.
 */
export async function deleteNote(path: string): Promise<void> {
  try {
    return await invoke("delete_note", { path });
  } catch (error) {
    handleError(error);
  }
}

/**
 * Rename/move a note.
 */
export async function renameNote(oldPath: string, newPath: string): Promise<void> {
  try {
    return await invoke("rename_note", { oldPath, newPath });
  } catch (error) {
    handleError(error);
  }
}

/**
 * Create a new note.
 */
export async function createNote(path: string, content?: string): Promise<NoteData> {
  try {
    return await invoke<NoteData>("create_note", { path, content });
  } catch (error) {
    handleError(error);
  }
}

/**
 * Get explorer tree (folders + notes).
 */
export async function getExplorerTree(): Promise<ExplorerTree> {
  try {
    return await invoke<ExplorerTree>("get_explorer_tree");
  } catch (error) {
    handleError(error);
  }
}

/**
 * Persist folder expanded/collapsed state.
 */
export async function setFolderExpanded(path: string, expanded: boolean): Promise<void> {
  try {
    return await invoke("set_folder_expanded", { path, expanded });
  } catch (error) {
    handleError(error);
  }
}

//endregion

//region Search Operations

/**
 * Search notes in the vault.
 */
export async function searchNotes(query: string, limit?: number): Promise<SearchResult[]> {
  try {
    return await invoke<SearchResult[]>("search_notes", { query, limit });
  } catch (error) {
    handleError(error);
  }
}

/**
 * Get search suggestions as user types.
 */
export async function searchSuggestions(query: string, limit?: number): Promise<string[]> {
  try {
    return await invoke<string[]>("search_suggestions", { query, limit });
  } catch (error) {
    handleError(error);
  }
}

//endregion

//region Graph Operations

/**
 * Get the link graph layout for visualization.
 */
export async function getGraphLayout(width: number, height: number): Promise<GraphLayout> {
  try {
    return await invoke<GraphLayout>("get_graph_layout", { width, height });
  } catch (error) {
    handleError(error);
  }
}

//endregion

//region Test Command

/**
 * Test command - greet from Rust.
 */
export async function greet(name: string): Promise<string> {
  try {
    return await invoke<string>("greet", { name });
  } catch (error) {
    handleError(error);
  }
}

//endregion

// Re-export types
export type {
  VaultInfo,
  NoteSummary,
  NoteData,
  SearchResult,
  GraphLayout,
  GraphNode,
  GraphEdge,
  VaultError,
} from "../types/vault";
