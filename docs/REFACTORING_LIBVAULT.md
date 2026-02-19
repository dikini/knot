# Refactoring libvault for Tauri 2.0

**Source:** Copied from `botpane/libvault` (2026-02-19)  
**Status:** Needs significant refactoring for Tauri architecture

## Architecture Changes

### Current (libvault FFI)
```rust
// Global singleton accessed via FFI
static VAULT: Mutex<Option<VaultManager>> = Mutex::new(None);

#[no_mangle]
pub extern "C" fn vault_open(path: *const c_char) -> bool {
    // Direct FFI, manual error handling
}
```

### Target (Tauri Commands)
```rust
// State managed by Tauri
pub struct VaultState {
    vault: Arc<Mutex<VaultManager>>,
}

#[tauri::command]
async fn vault_open(
    path: String,
    state: State<'_, VaultState>
) -> Result<VaultInfo, VaultError> {
    // Async, typed, serialized automatically
}
```

## Refactoring Checklist

### 1. Error Types
- [ ] Remove FFI-specific error handling
- [ ] Implement `serde::Serialize` for errors (Tauri requires serializable errors)
- [ ] Use `thiserror` consistently

```rust
// Current
#[derive(Debug)]
pub struct VaultError { ... }

// Target
#[derive(thiserror::Error, Debug, serde::Serialize)]
#[serde(tag = "type", content = "message")]
pub enum VaultError {
    #[error("note not found: {0}")]
    NoteNotFound(String),
    #[error("io error: {0}")]
    Io(String),
}
```

### 2. Remove FFI Layer
- [ ] `ffi.rs` - 43KB of FFI bindings - **DELETE**
- [ ] `cbindgen.toml` - **DELETE**
- [ ] Extract pure logic from FFI functions into reusable methods

### 3. Add Tauri Commands
- [ ] Create `src/commands/` module
- [ ] Wrap vault operations as `#[tauri::command]` functions
- [ ] Add state management (`VaultState`)

```rust
// src/commands/vault.rs
use tauri::State;
use crate::VaultState;

#[tauri::command]
pub async fn open_vault(
    path: String,
    state: State<'_, VaultState>
) -> Result<VaultInfo, String> {
    let mut vault = state.vault.lock().await;
    vault.open(&path)
        .map_err(|e| e.to_string())
}
```

### 4. Async Refactoring
- [ ] Identify blocking I/O operations
- [ ] Add `async` to database operations where appropriate
- [ ] Use `tokio::sync::Mutex` for state (not `std::sync::Mutex`)

### 5. Type Safety at Boundaries
- [ ] Define request/response types for all commands
- [ ] Use `ts-rs` or manual TypeScript definitions
- [ ] No implicit serialization

```rust
// src/types.rs
#[derive(serde::Serialize, ts_rs::TS)]
#[ts(export)]
pub struct NoteSummary {
    pub path: String,
    pub title: String,
    pub modified_at: i64,
}
```

### 6. Database Connection
- [ ] Current: Direct rusqlite connections
- [ ] Target: Connection pooling or per-vault connection
- [ ] Consider `sqlx` for async database

### 7. Event System
- [ ] Current: Manual event log for sync
- [ ] Target: Tauri events for UI notifications

```rust
// Emit events to frontend
app.emit("note-saved", NoteEvent { path, content_hash });
```

## Module Reorganization

### Proposed Structure
```
src-tauri/src/
├── main.rs              # Tauri app builder, command registration
├── lib.rs               # Re-exports for testing
├── state.rs             # VaultState, AppState
├── commands/            # All Tauri commands
│   ├── mod.rs
│   ├── vault.rs         # open, close, info
│   ├── notes.rs         # CRUD operations
│   ├── search.rs        # search, index
│   └── sync.rs          # P2P sync
├── core/                # Pure business logic (from libvault)
│   ├── mod.rs
│   ├── vault.rs         # VaultManager (refactored)
│   ├── note.rs          # Note model
│   ├── graph.rs         # Link graph
│   ├── search.rs        # Search index logic
│   └── markdown.rs      # Markdown parsing
├── db/                  # Database layer
│   ├── mod.rs
│   ├── connection.rs    # Connection management
│   ├── schema.rs        # Migrations
│   └── queries.rs       # SQL queries
├── events.rs            # Event system
├── error.rs             # Error types
└── config.rs            # Settings
```

## Critical Files to Review

| File | Size | Action | Notes |
|------|------|--------|-------|
| `ffi.rs` | 43KB | **DELETE** | Replace with commands |
| `vault.rs` | 47KB | Refactor | Split into core + commands |
| `search.rs` | 30KB | Adapt | Keep logic, add async |
| `graph.rs` | 25KB | Keep | Minimal changes needed |
| `ipc.rs` | 16KB | Evaluate | May be replaced by Tauri IPC |
| `markdown.rs` | 14KB | Keep | Good as-is |

## Testing Strategy

Current tests use FFI. Need to:
- [ ] Rewrite tests to use core library directly
- [ ] Add integration tests for Tauri commands
- [ ] Use `tauri::test` for command testing

```rust
#[test]
async fn test_open_vault() {
    let state = VaultState::default();
    let result = commands::vault::open_vault(
        "/tmp/test-vault".to_string(),
        State::new(state)
    ).await;
    assert!(result.is_ok());
}
```

## Dependencies to Update

### Add
```toml
[dependencies]
tauri = { version = "2", features = [] }
tokio = { version = "1", features = ["full"] }
ts-rs = "7"  # TypeScript generation
```

### Remove
```toml
# Remove FFI dependencies
libc = "0.2"
# Remove if not needed
cbindgen = "..."
```

## Migration Phases

### Phase 1: Extract Core (Week 1)
1. Create `core/` module
2. Move pure logic from `vault.rs`, `search.rs`
3. Remove FFI dependencies from core
4. Ensure tests pass on core

### Phase 2: Add Tauri Layer (Week 2)
1. Add Tauri dependencies
2. Create `commands/` module
3. Implement basic commands (open, read, save)
4. Wire up in `main.rs`

### Phase 3: Frontend Integration (Week 3)
1. Set up TypeScript types
2. Create API client in frontend
3. Test end-to-end
4. Polish error handling

## Notes

- **Keep tests passing** throughout refactoring
- **Commit frequently** - each phase should be a commit
- **Don't optimize prematurely** - get it working first
- **Document breaking changes** for future maintainers

## References

- [Tauri 2.0 Commands](https://v2.tauri.app/guide/features/commands/)
- [Tauri State Management](https://v2.tauri.app/guide/features/state-management/)
- [Error Handling in Tauri](https://v2.tauri.app/guide/features/error-handling/)
