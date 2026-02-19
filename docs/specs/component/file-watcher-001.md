# File System Watcher

## Metadata

- ID: `COMP-FILE-WATCH-001`
- Scope: `component`
- Status: `partial`
- Parent: `COMP-VAULT-001`
- Concerns: [REL, CONS]
- Created: `2026-02-19`
- Verified: `2026-02-19` (25% compliance - stub only)

## Purpose

Detect external changes to notes (made outside the app) and sync them to the database and search index. Keeps vault state consistent with filesystem.

## Current State

**Stub implementation** in `core/vault.rs:369-374`:

```rust
fn start_watcher(&mut self) -> Result<()> {
    // File watcher implementation
    // TODO: Port from watcher.rs
    warn!("file watcher not yet implemented in refactored core");
    Ok(())
}
```

**Existing watcher module** (`src-tauri/src/watcher.rs`):

- Has some implementation using `notify` crate
- Needs to be integrated with VaultManager

## Contract

### Functional Requirements

**FR-1**: Watch vault directory for changes

- Watch all `.md` files in vault root (excluding `.vault/`)
- Recursive (include subdirectories)
- Debounce rapid successive events

**FR-2**: Handle file creation

- New `.md` file created → add to database, index, graph
- Update note list in UI

**FR-3**: Handle file modification

- File modified externally → update database, reindex
- If currently open in editor, prompt user or auto-reload

**FR-4**: Handle file deletion

- File deleted → remove from database, index, graph
- If currently open, show "file deleted" indicator

**FR-5**: Handle file rename/move

- Detected as delete + create
- Update paths in database
- Update graph links

**FR-6**: Debounce and batch events

- Multiple rapid events → single update
- Avoid thrashing database/index

**FR-7**: Error handling

- Log errors, don't crash
- Attempt to recover/restart watcher

### Interface

```rust
pub struct FileWatcher {
    watcher: RecommendedWatcher,
    vault_root: PathBuf,
    debounce: Debouncer,
}

impl FileWatcher {
    pub fn new(vault_root: &Path, handler: EventHandler) -> Result<Self>;
    pub fn start(&mut self) -> Result<()>;
    pub fn stop(&mut self);
}

// In VaultManager:
pub fn start_watching(&mut self) -> Result<()>;
pub fn stop_watching(&mut self);
```

### Behavior

**Given** vault is open with file watcher active
**When** user edits `note.md` in external editor
**Then** change detected, database updated, search index updated, UI refreshed

**Given** file watcher active
**When** rapid successive saves occur (e.g., auto-save)
**Then** debounced to single update

**Given** user has `note.md` open
**When** file modified externally
**Then** UI shows indicator, offers to reload

## Design Decisions

| Decision           | Rationale                               | Trade-off                   |
| ------------------ | --------------------------------------- | --------------------------- |
| Use `notify` crate | Already in dependencies, cross-platform | Extra thread                |
| Debounce 1 second  | Balance responsiveness vs efficiency    | Delay in updates            |
| Sync on all events | Consistency                             | Performance on large vaults |
| Skip `.vault/`     | Avoid watching our own metadata         | Won't detect corruption     |

## Implementation Strategy

Integrate with existing `watcher.rs` or rewrite. The existing code has:

- `FileWatcher` struct
- `Event` enum for changes
- Uses `notify` crate

Update `VaultManager` to:

1. Create watcher on vault open (optional/configurable)
2. Handle events by syncing to DB/index
3. Stop watcher on vault close

## Acceptance Criteria

- [ ] File watcher starts when vault opens
- [ ] External file changes detected
- [ ] Database updated on changes
- [ ] Search index updated on changes
- [ ] Graph updated on changes
- [ ] UI reflects external changes
- [ ] Debouncing prevents thrashing
- [ ] Watcher stops cleanly on vault close

## Related

- Existing: `src-tauri/src/watcher.rs`
- Updates: `COMP-VAULT-001`
- Uses: `notify` crate
