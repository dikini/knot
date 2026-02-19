# Implementation Plan: File System Watcher

## Metadata
- Spec: `docs/specs/component/file-watcher-001.md`
- Generated: `2026-02-19`
- Approach: `sequential`

## Summary
- Total tasks: 6
- Size: 1 Small, 4 Medium, 1 Large

## Tasks

| ID | Task | Size | Depends | Spec Ref |
|----|------|------|---------|----------|
| FW-001 | Review existing watcher.rs | S | - | - |
| FW-002 | Create FileWatcher integration struct | M | FW-001 | FR-1 |
| FW-003 | Implement event handling in VaultManager | L | FW-002 | FR-2,3,4,5 |
| FW-004 | Add debouncing | M | FW-002 | FR-6 |
| FW-005 | Wire to VaultManager lifecycle | M | FW-003 | FR-1,7 |
| FW-006 | Add tests | M | FW-005 | Acceptance |

## Task Details

### FW-001: Review existing watcher.rs
Read and understand: `src-tauri/src/watcher.rs`

### FW-002: Create FileWatcher integration
Location: `src-tauri/src/core/vault.rs` or new `src-tauri/src/file_watcher.rs`

Create wrapper that:
- Uses `notify` crate
- Filters for `.md` files
- Excludes `.vault/` directory
- Sends events to handler

### FW-003: Implement event handling
Location: `src-tauri/src/core/vault.rs`

In VaultManager:
```rust
fn handle_watcher_event(&mut self, event: notify::Event) {
    match event.kind {
        Create(_) => self.sync_new_file(&path),
        Modify(_) => self.sync_modified_file(&path),
        Remove(_) => self.sync_deleted_file(&path),
        _ => {}
    }
}
```

Implement sync methods:
- `sync_new_file` → read file, add to DB, index, graph
- `sync_modified_file` → read file, update DB, reindex, update graph
- `sync_deleted_file` → remove from DB, index, graph

### FW-004: Add debouncing
Use `notify-debouncer-mini` or simple timer-based approach:
```rust
// Collect events in buffer
// After 1 second of no new events, process batch
// Clear buffer
```

### FW-005: Wire to lifecycle
In VaultManager:
```rust
pub fn open(...) -> Result<Self> {
    // ... existing code ...
    if config.watch_files {
        vault.start_watching()?;
    }
    Ok(vault)
}

pub fn close(&mut self) {
    self.stop_watching();
    // ... existing code ...
}
```

### FW-006: Add tests
Test scenarios:
- File created externally → appears in vault
- File modified externally → updates in vault
- File deleted externally → removed from vault
- Rapid changes → debounced correctly

## Verification

```bash
cargo test --lib
cargo test --test file_watcher  # if integration tests added
```

Manual test:
```bash
cd /path/to/vault
echo "# Test" > test.md  # Should appear in app
```
