# Implementation Plan: Content Loading

## Metadata
- Spec: `docs/specs/component/content-loading-001.md`
- Generated: `2026-02-19`
- Approach: `sequential`

## Summary
- Total tasks: 5
- Size: 2 Small, 3 Medium
- Critical path: CL-001 → CL-002 → CL-003 → CL-004 → CL-005

## Tasks

| ID | Task | Size | Depends | Spec Ref |
|----|------|------|---------|----------|
| CL-001 | Update Database::get_note_by_path signature | S | - | FR-1 |
| CL-002 | Implement content reading in Database | M | CL-001 | FR-1 |
| CL-003 | Update VaultManager::get_note to pass root | S | CL-002 | FR-1 |
| CL-004 | Update any other callers of get_note_by_path | M | CL-001 | FR-1 |
| CL-005 | Add tests for content loading | M | CL-002 | Acceptance |

## Task Details

### CL-001: Update Database::get_note_by_path signature
Location: `src-tauri/src/db.rs`

Change:
```rust
// From:
pub fn get_note_by_path(&self, path: &str) -> Result<Option<Note>>;

// To:
pub fn get_note_by_path(&self, path: &str, vault_root: &Path) -> Result<Option<Note>>;
```

### CL-002: Implement content reading
Location: `src-tauri/src/db.rs`

Replace TODO section with:
```rust
// Read content from filesystem
let file_path = vault_root.join(path);
let content = match std::fs::read_to_string(&file_path) {
    Ok(content) => content,
    Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
        return Err(KnotError::NoteNotFound(path.to_string()));
    }
    Err(e) => return Err(KnotError::Io(e.to_string())),
};

Ok(Some(crate::note::Note { meta, content }))
```

### CL-003: Update VaultManager
Location: `src-tauri/src/core/vault.rs`

Update `get_note` method:
```rust
pub fn get_note(&self, path: &str) -> Result<Note> {
    // First try to get from database
    let note = self.db.get_note_by_path(path, &self.root)?;
    // ... rest of method
}
```

### CL-004: Update other callers
Find all uses of `get_note_by_path`:
```bash
grep -r "get_note_by_path" src-tauri/src/
```

Likely callers:
- `graph.rs` (for backlink context)
- Any tests

### CL-005: Add tests
Location: `src-tauri/src/db.rs` or `src-tauri/src/core/vault.rs`

Add test:
```rust
#[test]
fn get_note_reads_content_from_filesystem() {
    // Create temp vault
    // Save note with content
    // Load note via get_note_by_path
    // Assert content matches
}
```

## Verification

```bash
cargo check
cargo test --lib
```

## Acceptance Criteria

| Criteria | Task | Verification |
|----------|------|--------------|
| Content loads from filesystem | CL-002 | Manual test |
| Missing file returns error | CL-002 | Unit test |
| All callers updated | CL-004 | cargo check |
| Tests pass | CL-005 | cargo test |
