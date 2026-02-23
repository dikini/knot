# Knotd Runtime Abstraction Implementation Plan
Change-Type: design-update
Trace: DESIGN-knotd-runtime-abstraction-scratch

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Introduce a shared runtime abstraction for vault ownership and session state so both the existing Tauri app and the future knotd daemon/embedded runtimes can re-use the same APIs safely.

**Architecture:** Build a new `runtime` module that hosts `VaultSession`, `RuntimeHandle`, and `RuntimeBridge` traits; wrap `AppState` around the handle and make MCP/commands consume the same asynchronous entry points.

**Tech Stack:** Rust (tokio async primitives, serde), existing `VaultManager`, Tauri command interface, MCP server.

---

I'm using the writing-plans skill to create the implementation plan.

### Task 1: Build the runtime session/handle primitives

**Files:**
- Create: `src-tauri/src/runtime/session.rs`
- Create: `src-tauri/src/runtime/handle.rs`
- Modify: `src-tauri/src/runtime/mod.rs` (new module re-export)
- Test: `src-tauri/src/runtime/tests.rs`

**Step 1: Write the failing test for runtime handle
```
#[tokio::test]
async fn runtime_handle_requires_open_session() {
  let handle = RuntimeHandle::default();
  assert!(matches!(handle.with_manager(|_| Ok(())), Err(KnotError::VaultNotOpen(_))));
}
```

**Step 2: Run test to verify it fails**
Run: `cargo test --lib runtime_handle_requires_open_session` (or equivalent in crate)
Expected: FAIL because `with_manager` returns `VaultNotOpen`.

**Step 3: Implement the minimal runtime session and handle**
```
pub struct VaultSession { manager: VaultManager }
pub struct RuntimeHandle(Arc<Mutex<Option<VaultSession>>>);
impl RuntimeHandle { async fn with_manager<F, T>(&self, f: F) -> Result<T> }
```
Ensure `open`, `close`, `set_unsaved_changes`, and `has_unsaved_changes` exist.

**Step 4: Run test to verify it passes**
Run: `cargo test --lib runtime_handle_requires_open_session` (or suite containing new tests)
Expected: PASS

**Step 5: Commit**
```
git add src-tauri/src/runtime/*.rs
git commit -m "feat: add runtime session handle"
```

### Task 2: Wrap AppState around RuntimeHandle

**Files:**
- Modify: `src-tauri/src/state.rs:1-150`
- Modify: `src-tauri/src/state.rs:response module` (if type re-exports change)
- Test: `src-tauri/src/state/tests.rs` (extend or add new tests around unsaved flag)

**Step 1: Write failing tests that demonstrate AppState delegating to RuntimeHandle
```
#[tokio::test]
async fn app_state_delegates_to_runtime_handle_for_path() {
  let state = AppState::default();
  assert!(state.current_vault_path().await.is_none());
}
```

**Step 2: Run test to ensure it fails (since runtime handle not wired yet)**
Run: `cargo test --lib app_state_delegation` Expected: FAIL because `RuntimeHandle` not wired.

**Step 3: Modify `AppState` to embed `RuntimeHandle`, re-export helpers, and remove direct vault mutex usage.
```
pub struct AppState { runtime: RuntimeHandle }
impl AppState {
  pub fn runtime(&self) -> &RuntimeHandle { &self.runtime }
}
```

**Step 4: Run tests to ensure they pass
Run: `cargo test src-tauri/src/state.rs::tests::bug_vault_unsaved_001` Expected: PASS

**Step 5: Commit**
```
git add src-tauri/src/state.rs
git commit -m "refactor: make AppState wrap runtime handle"
```

### Task 3: Update commands and MCP to call runtime APIs

**Files:**
- Modify: `src-tauri/src/commands/vault.rs:1-400`
- Modify: `src-tauri/src/mcp.rs:1-300`
- Test: `src-tauri/src/commands/tests.rs` (new mock for runtime handle or integration test verifying manager reuse)

**Step 1: Write failing tests that verify `commands::create_vault` fails when runtime reports open session
```
#[tokio::test]
async fn create_vault_rejects_when_runtime_busy() {
  // stub RuntimeHandle mock returning Err
}
```

**Step 2: Run test to ensure failure (commands still referencing old AppState)
Run: `cargo test commands::create_vault_rejects_when_runtime_busy` Expected: FAIL.

**Step 3: Update commands to call `state.runtime().open(path).await` etc and update MCP server constructor to accept `RuntimeHandle` and run `with_manager`

**Step 4: Run relevant tests/binary to ensure they pass
Run: `cargo test --lib commands` and `cargo test --lib mcp` Expected: PASS

**Step 5: Commit**
```
git add src-tauri/src/commands/vault.rs src-tauri/src/mcp.rs
git commit -m "chore: route commands through runtime handle"
```
