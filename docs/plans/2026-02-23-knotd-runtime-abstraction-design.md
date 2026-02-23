# Knotd Runtime Abstraction Design
Change-Type: design-update
Trace: DESIGN-knotd-runtime-abstraction-scratch

## Goal
Design the minimal runtime glue that keeps `VaultManager` ownership, session state, and lifecycle concerns centralized while letting both the existing Tauri-based commands and the upcoming knotd daemon/embedded runtimes share the same APIs safely.

## Current architecture
1. **VaultManager (src-tauri/src/core/vault.rs)** owns the vault directory, database, search index, graph, and watcher. Tauri commands grab it through `AppState::vault` (Arc+Mutex<Option<_>>). MCP server currently takes ownership separately (`Arc<Mutex<VaultManager>>`).
2. **AppState (src-tauri/src/state.rs)** exposes helper methods for vault presence and the unsaved-change flag but otherwise just guards the `VaultManager` instance.
3. **Commands (src-tauri/src/commands/vault.rs)** repeatedly lock AppState, perform open/close/create, and rely on `VaultManager` to keep watcher/db lifecycle.
4. **MCP server (src-tauri/src/mcp.rs)** is a standalone thread over a private `VaultManager`, which duplicates initialization/graph/watcher logic and cannot observe the UI unsaved flag or share the AppState mutex.

## Approach options
1. **Keep `AppState` as the single access point** and wrap it with platform-specific adapters. Pros: minimal refactors. Cons: `knotd` daemon still needs to live inside Tauri process; sharing across separate services becomes awkward because AppState is Tauri-centric.
2. **Introduce a `knotd::runtime` module that owns vault sessions** and provide a lightweight `RuntimeHandle` that both Tauri commands and MCP server can borrow. Pros: centralizes lifecycle, allows daemon/Android embed to reuse same entry points, reduces duplicate initialization. Cons: requires refactoring AppState (but mostly surface/lock adjustments). Recommended.
3. **Introduce an RPC-like runtime service** where UI/daemon clients talk over channels to a dedicated runtime actor holding the vault. Pros: clear cross-process boundary. Cons: heavyweight, premature in current scope.

## Recommended design
### Runtime modules and abstractions
- `src-tauri/src/runtime/session.rs` (or `knotd/runtime`): contains `VaultSession` which owns `VaultManager`, watcher handles, and metadata (e.g., root path, last opened note). It exposes async methods `open`, `close`, `reopen`, `with_manager`, and emits lifecycle events.
- `src-tauri/src/runtime/handle.rs`: defines `RuntimeHandle` (Arc over `tokio::sync::RwLock<Option<VaultSession>>>` plus unsaved-change tracking). It mirrors `AppState` but abstracts futures behind trait methods (`is_open`, `current_vault`, `replace_session`).
- `src-tauri/src/runtime/api.rs`: exposes trait `RuntimeBridge` that commands/MCP can use when they simply need to execute `VaultManager` operations (note CRUD, search). This isolates the underlying owner from UI vs daemon contexts.

### APIs to expose
- `RuntimeHandle::open(path: PathBuf) -> Result<VaultInfo>`: wraps `VaultManager::open/create`, rebuilds graph, starts watcher, sets unsaved flag false.
- `RuntimeHandle::close() -> Result<()>`: gracefully closes session, stops watcher, closes search index.
- `RuntimeHandle::with_manager<F, T>(func: F) -> Result<T>`: short-lived borrow for commands/MCP to run business logic without exposing the internal mutex.
- `RuntimeHandle::set_unsaved(has_unsaved: bool)` / `has_unsaved()` (already in AppState).`VaultSession` will emit events when watchers detect file changes; the handle can expose `watcher_events()` stream used by knotd for IPC.
- Provide a `RuntimeSource` enum so knotd runtime can configure differences for desktop daemon (event loop, CLI) vs embedded Android (in-process with Tauri). The runtime module should be dependency-free so it can compile for both.

### Integration points
- **Commands:** They replace direct AppState locks with the runtime handle. Tauri commands call `state.runtime().open(path)`, etc. The `AppState` itself becomes a thin shim over the `RuntimeHandle` (or simply re-export the handle). Unsaved-change flags move into the runtime handle so daemon clients get the same signal.
- **MCP server:** Instead of owning its own `VaultManager`, it takes a `RuntimeHandle` (cloned Arc) and only runs reads within `with_manager`. The MCP server can subscribe to watcher events exposed by the runtime handle to announce new notes.
- **knotd runtime:** for daemon mode, we instantiate the runtime handle in `knotd::main` (outside Tauri). It can host the MCP server, CLI, or HTTP endpoints while reusing the same session APIs.

### Migration-safe steps
1. **Introduce `runtime` module** with `VaultSession`, `RuntimeHandle`, and helper traits. Keep implementation in terms of the existing `VaultManager` methods; avoid new dependencies so the module can sit next to `core`. Add unit tests verifying `open`/`close` semantics and `with_manager` guard.
2. **Adjust `AppState` to wrap the runtime handle** (or simply `pub struct AppState(RuntimeHandle)`). Replace existing helpers with delegation and re-export unsaved-change API. Keep backward-compatible methods (e.g., `current_vault_path`) to minimize command edits.
3. **Update commands and MCP server** to depend only on the new runtime handle/traits. MCP server should accept `RuntimeHandle` during construction and use `with_manager` closures. This removes the duplicated `VaultManager` instance. Keep existing Tauri command signatures for compatibility, but let their bodies forward to runtime.
4. **Add knotd-specific entrypoint** (under `src-tauri/bin/knotd.rs` or new binary crate) that instantiates the runtime handle, optionally wires up MCP/CLI, and exposes the same `RuntimeBridge` trait for provisioning from either daemon or embedded contexts. Keep this binary separate so we do not regress the Tauri app.
5. **Update documentation/tests** to mention the runtime interface and verify that the AppState wrapper continues to compile for both desktop and embedded builds.

### Validation
- Add tests that reason about `RuntimeHandle::with_manager` refusing access when no session is open (mirrors existing error handling in commands).
- Move any watcher restart logic currently duplicated in commands/MCP into `VaultSession` so attendant tests live in `core/vault.rs` or new `tests/runtime.rs`.

Please review each section above; let me know if the approach matches your expectations before I continue to the plan and implementation phase.
