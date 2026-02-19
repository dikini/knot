# Database Layer

## Metadata
- ID: `COMP-DATABASE-001`
- Source: `extracted`
- Component: `database`
- Depth: `standard`
- Extracted: `2026-02-19`
- Concerns: [REL, SEC, CAP]

## Source Reference
- Codebase: `src-tauri/src/`
- Entry Points:
  - `db.rs` (Database struct and operations)
- Lines Analyzed: ~308

## Confidence Assessment
| Requirement | Confidence | Evidence | Needs Review |
|-------------|------------|----------|--------------|
| FR-1: Open database | high | Implementation + tests | no |
| FR-2: Schema migration | high | Implementation + tests | no |
| FR-3: Note CRUD | high | Implementation + tests | no |
| FR-4: WAL mode | high | `setup()` function | no |
| FR-5: Foreign keys | high | `setup()` function | no |
| FR-6: Schema version tracking | high | Implementation + tests | no |

## Contract

### Functional Requirements

**FR-1**: Open or create SQLite database at path
- Evidence: `db.rs:14-20`, test `create_in_memory_db`
- Confidence: high
- Behavior: Opens connection, runs setup, runs migrations
- Memory variant: `open_in_memory()` for testing

**FR-2**: Run schema migrations
- Evidence: `db.rs:43-64`, `migrate_v1()`, test `migration_is_idempotent`
- Confidence: high
- Version tracking: `schema_version` table
- Current version: 1 (SCHEMA_VERSION constant)
- Idempotent: Running migrations multiple times is safe

**FR-3**: CRUD operations for notes
- Evidence: `db.rs:155-267`, tests in `vault.rs`
- Confidence: high
- Operations:
  - `note_count()` - total count
  - `list_notes()` - all notes with metadata
  - `get_note_by_path()` - single note by path
  - `save_note()` - insert or update (UPSERT)
  - `delete_note_by_path()` - delete by path
  - `rename_note_path()` - update path

**FR-4**: Enable WAL (Write-Ahead Logging) mode
- Evidence: `db.rs:34-41`
- Confidence: high
- Benefits: Better concurrency, faster writes

**FR-5**: Enable foreign key constraints
- Evidence: `db.rs:37`
- Confidence: high
- Behavior: Enforces referential integrity

**FR-6**: Track schema version
- Evidence: `db.rs:146-153`, test `migration_is_idempotent`
- Confidence: high
- Table: `schema_version(version INTEGER NOT NULL)`

### Database Schema (v1)

```sql
-- Notes metadata
CREATE TABLE notes (
    id TEXT PRIMARY KEY,
    path TEXT NOT NULL UNIQUE,
    title TEXT,
    created_at INTEGER NOT NULL,
    modified_at INTEGER NOT NULL,
    word_count INTEGER DEFAULT 0,
    content_hash TEXT
);

-- Links between notes
CREATE TABLE links (
    id INTEGER PRIMARY KEY,
    source_note_id TEXT NOT NULL,
    target_note_id TEXT,
    target_path TEXT,
    link_text TEXT,
    link_type TEXT,
    FOREIGN KEY (source_note_id) REFERENCES notes(id) ON DELETE CASCADE,
    FOREIGN KEY (target_note_id) REFERENCES notes(id) ON DELETE SET NULL
);

-- Tags
CREATE TABLE tags (
    id INTEGER PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
);

CREATE TABLE note_tags (
    note_id TEXT NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (note_id, tag_id),
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Headings for TOC
CREATE TABLE headings (
    id INTEGER PRIMARY KEY,
    note_id TEXT NOT NULL,
    level INTEGER NOT NULL,
    text TEXT NOT NULL,
    anchor TEXT,
    position INTEGER,
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
);

-- P2P sync metadata
CREATE TABLE sync_peers (
    peer_id TEXT PRIMARY KEY,
    name TEXT,
    last_seen INTEGER,
    vector_clock TEXT
);

CREATE TABLE sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    note_id TEXT NOT NULL,
    peer_id TEXT,
    operation TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    version_hash TEXT,
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_notes_path ON notes(path);
CREATE INDEX idx_links_source ON links(source_note_id);
CREATE INDEX idx_links_target ON links(target_note_id);
CREATE INDEX idx_headings_note ON headings(note_id);
```

### Interface (Rust)

```rust
pub const SCHEMA_VERSION: u32 = 1;

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn open(path: &Path) -> Result<Self>;
    pub fn open_in_memory() -> Result<Self>;
    pub fn conn(&self) -> &Connection;
    pub fn schema_version(&self) -> Result<u32>;
    
    // Note operations
    pub fn note_count(&self) -> Result<usize>;
    pub fn list_notes(&self) -> Result<Vec<NoteMeta>>;
    pub fn get_note_by_path(&self, path: &str) -> Result<Option<Note>>;
    pub fn save_note(&self, note: &Note) -> Result<()>;
    pub fn delete_note_by_path(&self, path: &str) -> Result<()>;
    pub fn rename_note_path(&self, old_path: &str, new_path: &str) -> Result<()>;
}
```

### Behavior

**Given** no database exists at path
**When** `Database::open(path)` is called
**Then** database is created with all tables and indexes, version=1

**Given** database at version 0
**When** `Database::open(path)` is called
**Then** migrations run, schema_version updated to 1

**Given** database at version 1
**When** `Database::open(path)` is called again
**Then** no changes (idempotent)

**Given** a note exists
**When** `save_note()` called with same ID but different path
**Then** UPSERT updates the path (ON CONFLICT DO UPDATE)

**Given** a note with links exists
**When** note is deleted
**Then** cascading delete removes associated links (ON DELETE CASCADE)

## Design Decisions (Inferred)

| Decision | Evidence | Confidence |
|----------|----------|------------|
| rusqlite for SQLite access | `db.rs:3` | high |
| Path as UNIQUE constraint | `db.rs:71` | high |
| Note ID as UUID string (not integer) | `db.rs:70` | high |
| Separate headings table (not embedded) | `db.rs:106-114` | high |
| Links with nullable target_note_id | `db.rs:80-81` | high |
| Tags as many-to-many via note_tags | `db.rs:92-103` | high |
| Sync tables prepared but unused | `db.rs:116-132` | medium |
| 5 second busy timeout | `db.rs:39` | medium |
| Integer timestamps (Unix epoch) | `db.rs:73-74` | high |

## Uncertainties

- [ ] Sync tables are defined but not used - P2P sync not implemented yet?
- [ ] Tag assignment from note content - how are tags extracted?
- [ ] Should we use `WITHOUT ROWID` for notes table? (path is unique)
- [ ] No full-text search in SQLite (using Tantivy instead) - is this intentional?
- [ ] Content hash stored but not used for optimistic locking

## Acceptance Criteria (Derived from Tests)

- [ ] Database can be created in memory (`create_in_memory_db`)
- [ ] Schema version is correct after creation (`create_in_memory_db`)
- [ ] All expected tables exist (`tables_exist`)
- [ ] Migrations are idempotent (`migration_is_idempotent`)

## Related
- Extracted from: `src-tauri/src/db.rs`
- Depends on: rusqlite crate
- Used by: `COMP-VAULT-001`, `COMP-GRAPH-001`, `COMP-SEARCH-001` (indirectly)
