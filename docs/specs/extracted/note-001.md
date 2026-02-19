# Note Operations

## Metadata
- ID: `COMP-NOTE-001`
- Source: `extracted`
- Component: `note`
- Depth: `standard`
- Extracted: `2026-02-19`
- Concerns: [REL, CAP]

## Source Reference
- Codebase: `src-tauri/src/`
- Entry Points:
  - `note.rs` (Note/NoteMeta types)
  - `core/vault.rs` (Note operations in VaultManager)
  - `commands/notes.rs` (Tauri commands)
- Lines Analyzed: ~600

## Confidence Assessment
| Requirement | Confidence | Evidence | Needs Review |
|-------------|------------|----------|--------------|
| FR-1: List notes | high | Implementation + tests | no |
| FR-2: Get note | high | Implementation + tests | no |
| FR-3: Save note | high | Implementation + tests | no |
| FR-4: Delete note | high | Implementation | no |
| FR-5: Rename note | high | Implementation | no |
| FR-6: Create note | high | Implementation | no |
| FR-7: Title extraction | high | Implementation + tests | no |
| FR-8: Word count | high | Implementation + tests | no |
| FR-9: Content hash | high | Implementation + tests | no |
| FR-10: Get backlinks | high | Implementation in graph.rs | no |

## Contract

### Functional Requirements

**FR-1**: List all notes in the vault with metadata
- Evidence: `core/vault.rs:166-168`, `commands/notes.rs:11-28`
- Confidence: high
- Returns: Array of `NoteSummary` (id, path, title, created_at, modified_at, word_count)
- Sorting: By modified_at descending (database default)

**FR-2**: Get a note by its path with full content
- Evidence: `core/vault.rs:171-187`, `commands/notes.rs:31-77`
- Confidence: high
- Behavior: First checks database, falls back to filesystem if not in DB
- Returns: `NoteData` with content, metadata, headings, and backlinks
- Errors: `NoteNotFound` if file doesn't exist

**FR-3**: Save a note (create or update)
- Evidence: `core/vault.rs:190-213`, `commands/notes.rs:80-99`
- Confidence: high
- Behavior: 
  - Writes to filesystem
  - Updates database metadata
  - Updates search index
  - Updates link graph
- Side effects: Creates parent directories if needed

**FR-4**: Delete a note
- Evidence: `core/vault.rs:216-235`, `commands/notes.rs:102-120`
- Confidence: high
- Behavior:
  - Deletes from filesystem (if exists)
  - Removes from database
  - Removes from search index
  - Rebuilds link graph

**FR-5**: Rename/move a note
- Evidence: `core/vault.rs:238-268`, `commands/notes.rs:123-142`
- Confidence: high
- Parameters: `old_path`, `new_path`
- Behavior:
  - Moves file on filesystem
  - Updates path in database
  - Rebuilds search index entry
  - Rebuilds link graph

**FR-6**: Create a new note
- Evidence: `commands/notes.rs:145-192`
- Confidence: high
- Parameters: `path`, optional `content`
- Behavior: Checks if note exists, saves with default or provided content
- Errors: Returns error if note already exists

**FR-7**: Extract title from markdown content
- Evidence: `note.rs:92-105`, tests `title_from_heading`, `title_from_filename`
- Confidence: high
- Behavior: Uses first `# Heading` or falls back to filename stem

**FR-8**: Count words in content
- Evidence: `note.rs:108-110`, test `word_count_basic`
- Confidence: high
- Algorithm: `content.split_whitespace().count()`

**FR-9**: Compute content hash for change detection
- Evidence: `note.rs:113-119`, test `content_hash_deterministic`
- Confidence: high
- Algorithm: `DefaultHasher` with `content.hash(&mut hasher)`

**FR-10**: Get backlinks for a note
- Evidence: `commands/notes.rs:44-53` (calls graph.backlinks)
- Confidence: high
- Returns: Array of `Backlink` with source_path, source_title, context

### Interface (Rust)

```rust
// Types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteMeta {
    pub id: String,
    pub path: String,
    pub title: String,
    pub created_at: i64,
    pub modified_at: i64,
    pub word_count: usize,
    pub content_hash: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    #[serde(flatten)]
    pub meta: NoteMeta,
    pub content: String,
}

impl Note {
    pub fn new(path: &str, content: &str) -> Self;
    pub fn id(&self) -> &str;
    pub fn path(&self) -> &str;
    pub fn title(&self) -> &str;
    pub fn content(&self) -> &str;
    pub fn created_at(&self) -> i64;
    pub fn modified_at(&self) -> i64;
    pub fn word_count(&self) -> usize;
    pub fn headings(&self) -> Vec<Heading>;
}

impl NoteMeta {
    pub fn title_from_content(content: &str, path: &str) -> String;
    pub fn word_count(content: &str) -> i64;
    pub fn content_hash(content: &str) -> String;
}

// VaultManager methods
impl VaultManager {
    pub fn list_notes(&self) -> Result<Vec<NoteMeta>>;
    pub fn get_note(&self, path: &str) -> Result<Note>;
    pub fn save_note(&mut self, path: &str, content: &str) -> Result<()>;
    pub fn delete_note(&mut self, path: &str) -> Result<()>;
    pub fn rename_note(&mut self, old_path: &str, new_path: &str) -> Result<()>;
}

// Tauri Commands
#[tauri::command]
pub async fn list_notes(state: State<'_, AppState>) -> Result<Vec<NoteSummary>, String>;

#[tauri::command]
pub async fn get_note(path: String, state: State<'_, AppState>) -> Result<NoteData, String>;

#[tauri::command]
pub async fn save_note(path: String, content: String, state: State<'_, AppState>) -> Result<(), String>;

#[tauri::command]
pub async fn delete_note(path: String, state: State<'_, AppState>) -> Result<(), String>;

#[tauri::command]
pub async fn rename_note(old_path: String, new_path: String, state: State<'_, AppState>) -> Result<(), String>;

#[tauri::command]
pub async fn create_note(path: String, content: Option<String>, state: State<'_, AppState>) -> Result<NoteData, String>;
```

### Interface (TypeScript)

```typescript
export interface NoteSummary {
  id: string;
  path: string;
  title: string;
  created_at: number;
  modified_at: number;
  word_count: number;
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

// API functions
export async function listNotes(): Promise<NoteSummary[]>;
export async function getNote(path: string): Promise<NoteData>;
export async function saveNote(path: string, content: string): Promise<void>;
export async function deleteNote(path: string): Promise<void>;
export async function renameNote(oldPath: string, newPath: string): Promise<void>;
export async function createNote(path: string, content?: string): Promise<NoteData>;
```

### Behavior

**Given** a vault is open with no notes
**When** `save_note("test.md", "# Hello")` is called
**Then** the file is created, database is updated, search index is updated, graph is updated

**Given** a note exists at "old.md"
**When** `rename_note("old.md", "new.md")` is called
**Then** file is moved, database path is updated, search index is updated, graph is rebuilt

**Given** a note with H1 heading "# My Title"
**When** `Note::new()` is created
**Then** `note.title()` returns "My Title"

**Given** a note without H1 heading at "notes/idea.md"
**When** `Note::new()` is created
**Then** `note.title()` returns "idea" (filename stem)

## Design Decisions (Inferred)

| Decision | Evidence | Confidence |
|----------|----------|------------|
| UUID v4 for note IDs | `note.rs:27` | high |
| Unix timestamps for dates | `note.rs:32` | high |
| Content stored on filesystem, metadata in SQLite | `core/vault.rs:199`, `db.rs:213-220` | high |
| Immutable note IDs, mutable paths | `db.rs:227-248` - ON CONFLICT update path | medium |
| Word count computed on save | `note.rs:29` | high |
| Content hash for change detection | `note.rs:30` | high |

## Uncertainties

- [ ] Should content hash be used for anything other than display? Currently just stored
- [ ] How to handle concurrent edits? No locking mechanism currently
- [ ] Should rename update links in other notes? Currently only updates graph structure
- [ ] What happens to backlinks when a note is deleted? Currently context shows "Linked from..."

## Acceptance Criteria (Derived from Tests)

- [ ] Title extracted from first H1 heading (`title_from_heading`)
- [ ] Title falls back to filename without extension (`title_from_filename`)
- [ ] Word count counts whitespace-separated tokens (`word_count_basic`)
- [ ] Content hash is deterministic (`content_hash_deterministic`)
- [ ] Note can be saved and retrieved (`test_save_and_get_note` in vault.rs)

## Related
- Extracted from: `src-tauri/src/note.rs`, `src-tauri/src/core/vault.rs`, `src-tauri/src/commands/notes.rs`
- Depends on: `COMP-VAULT-001`, `COMP-DATABASE-001`, `COMP-SEARCH-001`, `COMP-GRAPH-001`, `COMP-MARKDOWN-001`
- Used by: Frontend editor, sidebar, graph view
