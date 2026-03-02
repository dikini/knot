/**
 * Vault types shared between Rust backend and TypeScript frontend
 * These match the Rust types serialized via Tauri (snake_case)
 */

export interface VaultInfo {
  path: string;
  name: string;
  note_count: number;
  last_modified: number;
}

export interface NoteSummary {
  id: string;
  path: string;
  title: string;
  created_at: number;
  modified_at: number;
  word_count: number;
  note_type?: NoteType;
  type_badge?: string | null;
  is_dimmed?: boolean;
}

export interface NoteData {
  id: string;
  path: string;
  title: string;
  content: string;
  created_at: number;
  modified_at: number;
  word_count: number;
  headings: Heading[];
  backlinks: Backlink[];
  note_type?: NoteType;
  available_modes?: NoteModeAvailability;
  metadata?: NoteMetadataPayload;
  type_badge?: string | null;
  media?: NoteMediaData | null;
  is_dimmed?: boolean;
}

export type NoteType = "markdown" | "image" | "unknown";

export interface NoteModeAvailability {
  meta: boolean;
  source: boolean;
  edit: boolean;
  view: boolean;
}

export interface NoteMetadataPayload {
  extra?: Record<string, unknown>;
}

export interface NoteMediaData {
  mime_type: string;
  file_path: string;
}

export interface Heading {
  level: number;
  text: string;
  position: number;
}

export interface Backlink {
  source_path: string;
  source_title: string;
  context: string;
}

export interface SearchResult {
  path: string;
  title: string;
  excerpt: string;
  score: number;
}

export interface GraphLayout {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface ExplorerNoteNode {
  path: string;
  title: string;
  display_title: string;
  modified_at: number;
  word_count: number;
  type_badge?: string | null;
  is_dimmed?: boolean;
}

export interface ExplorerFolderNode {
  path: string;
  name: string;
  expanded: boolean;
  folders: ExplorerFolderNode[];
  notes: ExplorerNoteNode[];
}

export interface ExplorerTree {
  root: ExplorerFolderNode;
  hidden_policy: string;
}

// Error types from Rust
export type VaultError =
  | { type: "NoteNotFound"; message: string }
  | { type: "VaultNotOpen"; message: string }
  | { type: "Io"; message: string }
  | { type: "Database"; message: string }
  | { type: "InvalidPath"; message: string };

// Re-export NoteData as Note for backwards compatibility
export type Note = NoteData;
