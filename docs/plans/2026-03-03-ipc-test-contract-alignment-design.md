# IPC Test Contract Alignment Design

- Date: `2026-03-03`
- Status: `approved-for-implementation`
- Related spec: `docs/specs/component/ipc-test-contract-alignment-019.md`

## Goal
Align stale Rust IPC integration tests with the current request/response dispatch contract used by `IpcServer`.

## Chosen Approach
Update the tests only.

The runtime IPC API already routes commands through `IpcDispatchRequest` with a per-request response channel. The tests should mirror that production contract instead of using the older `Sender<AppCommand>` queue shape.

## Scope
- Replace test harness senders from `Sender<AppCommand>` to `Sender<IpcDispatchRequest>`.
- Extract queued commands from `request.envelope.command` for existing assertions.
- Send synthetic `AppCommandResult` values on `request.response_tx` so the client-side request path completes successfully.

## Non-Goals
- No changes to `IpcServer`, `IpcClient`, or UI runtime dispatch behavior.
- No compatibility shim for the deprecated raw-command sender contract.

## Validation
The fix is complete when:
1. `src-tauri/tests/ipc_recovery_test.rs` compiles and passes
2. `src-tauri/tests/ipc_concurrency_test.rs` compiles and passes
3. `cargo test --manifest-path src-tauri/Cargo.toml --test ipc_recovery_test -- --nocapture` passes
4. `cargo test --manifest-path src-tauri/Cargo.toml --test ipc_concurrency_test -- --nocapture` passes
