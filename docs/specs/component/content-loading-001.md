# Content Loading from Filesystem

## Metadata

- ID: `COMP-CONTENT-LOAD-001`
- Scope: `component`
- Status: `implemented`
- Parent: `COMP-DATABASE-001`, `COMP-NOTE-001`
- Concerns: [REL, SEC]
- Created: `2026-02-19`
- Verified: `2026-02-19`

## Purpose

Fix the critical bug where notes load metadata from the database but content is empty. Notes must load their full content from the filesystem.

## Current Bug

In `db.rs:get_note_by_path()` (lines 214-220):

```rust
// Read content from filesystem
// For now, return a note with empty content
// TODO: Actually read from filesystem
Ok(Some(crate::note::Note {
    meta,
    content: String::new(),  // <-- BUG: Always empty!
}))
```

## Contract

### Functional Requirements

**FR-1**: Load note content from filesystem

- When loading a note by path, read content from filesystem
- Path is relative to vault root
- Content read as UTF-8 text
- Errors handled gracefully

**FR-2**: Handle missing files

- If note metadata exists but file doesn't, return NoteNotFound error
- This prevents stale metadata from causing confusion

**FR-3**: Handle read errors

- Permission errors, IO errors mapped to KnotError::Io
- Clear error message indicating which file failed

**FR-4**: Maintain consistency

- Content hash should match when loaded
- Word count should be consistent

### Interface Changes

```rust
// Database method signature remains same
pub fn get_note_by_path(&self, path: &str) -> Result<Option<Note>>;

// But implementation changes:
// - Takes &mut self OR vault_root: &Path parameter
// - Reads file at vault_root.join(path)
// - Returns Note with actual content
```

### Behavior

**Given** vault at `/home/user/notes` with note at `ideas.md`
**When** `get_note_by_path("ideas.md")` is called with vault root
**Then** returns Note with content read from `/home/user/notes/ideas.md`

**Given** note metadata exists but file was deleted externally
**When** loading note
**Then** returns `KnotError::NoteNotFound`

**Given** file exists but permission denied
**When** loading note
**Then** returns `KnotError::Io` with descriptive message

## Design Decisions

| Decision                           | Rationale                  | Trade-off                      |
| ---------------------------------- | -------------------------- | ------------------------------ |
| Pass vault_root to Database method | Clean separation, testable | Signature change               |
| Read on every load                 | Simple, always fresh       | Slightly slower than caching   |
| UTF-8 only                         | Standard for markdown      | Binary files won't work        |
| Error on missing file              | Fail fast, clear UX        | Can't show metadata-only notes |

## Implementation Strategy

Two approaches considered:

### Option A: Pass vault_root to Database

```rust
pub fn get_note_by_path(&self, path: &str, vault_root: &Path) -> Result<Option<Note>>
```

- Clean: Database doesn't store root
- Requires all callers to pass root

### Option B: Store vault_root in Database

```rust
pub struct Database {
    conn: Connection,
    vault_root: PathBuf,  // Added
}
```

- Convenient: root always available
- Less flexible: Database tied to specific vault

**Decision**: Option A - pass root parameter. Keeps Database a pure persistence layer.

## Acceptance Criteria

- [x] Note content loads from filesystem
- [x] Missing file returns NoteNotFound error
- [x] IO errors handled gracefully
- [x] VaultManager updated to pass root path
- [x] Tests updated/added
- [x] No regression in existing tests

## Related

- Fixes bug in: `COMP-DATABASE-001`
- Used by: `COMP-NOTE-001`, Frontend editor
- Blocks: Note Selection UI (P1.2)
