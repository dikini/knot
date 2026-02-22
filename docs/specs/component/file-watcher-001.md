# File System Watcher

## Metadata

- ID: `COMP-FILE-WATCH-001`
- Scope: `component`
- Status: `implemented`
- Parent: `COMP-VAULT-001`
- Concerns: [REL, CONS]
- Created: `2026-02-19`
- Updated: `2026-02-22`
- Verified: `2026-02-19` (100%; see `docs/audit/file-watcher-verification-2026-02-19.md`)

## Purpose

Detect external changes to notes (made outside the app) and sync them to the database and search index. Keeps vault state consistent with filesystem.

## Current State

`src-tauri/src/watcher.rs` implements `FileWatcher` with markdown filtering, `.vault/` exclusion, and debounce batching.

`src-tauri/src/core/vault.rs` integrates watcher startup and event syncing (`Modified`, `Deleted`, `Renamed`) into database, search index, and graph update paths.

`src-tauri/src/vault.rs` and `src-tauri/tests/watcher_integration_test.rs` include traceability and passing watcher integration coverage as verified in `docs/audit/file-watcher-verification-2026-02-19.md`.

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

Use the existing `watcher.rs` implementation and close compliance gaps:

1. Keep watcher lifecycle managed by `VaultManager` in `src-tauri/src/core/vault.rs`
2. Ensure external create/modify/delete/rename flows are covered by integration tests
3. Add missing SPEC markers for public watcher lifecycle and sync methods in `src-tauri/src/vault.rs`
4. Re-run verification and publish updated compliance report

## Acceptance Criteria

- [ ] `watcher_detects_external_file_creation` passes (FR-1, FR-2)
- [ ] `watcher_detects_external_file_modification` passes (FR-3)
- [ ] `watcher_detects_external_file_deletion` passes (FR-4)
- [ ] `watcher_detects_external_file_rename` passes (FR-5)
- [ ] `watcher_debounce_prevents_duplicate_events` or equivalent debounce test passes (FR-6)
- [ ] Watcher errors are logged and do not crash sync loop (FR-7)
- [ ] All watcher lifecycle/sync API entry points have SPEC markers for traceability

## Related

- Existing: `src-tauri/src/watcher.rs`
- Updates: `COMP-VAULT-001`
- Uses: `notify` crate

## Revision History

- 2026-02-19: Updated from "stub-only" framing to "implemented with compliance gaps", aligned acceptance criteria to executable tests.
