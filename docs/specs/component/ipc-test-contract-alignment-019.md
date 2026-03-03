# IPC Test Contract Alignment

## Metadata
- ID: `COMP-IPC-TEST-CONTRACT-019`
- Scope: `component`
- Status: `draft`
- Parent: `COMP-KNOTD-UI-010`
- Concerns: `[REL, CONS, COMP]`
- Created: `2026-03-03`
- Updated: `2026-03-03`

## Purpose
Keep Rust IPC integration tests aligned with the production `IpcServer` dispatch contract so regressions are detected by the normal test suite instead of being masked by stale harness code.

## Contract

### Functional Requirements
- FR-1: IPC integration tests MUST construct `IpcServer` with `Sender<IpcDispatchRequest>`, matching the production constructor signature.
- FR-2: Test harnesses MUST assert queued commands via `request.envelope.command` so sequence and ordering checks continue to observe the real server ingress path.
- FR-3: Test harnesses MUST send synthetic `AppCommandResult` responses on `request.response_tx` so client requests complete through the same request/response flow used in production.
- FR-4: Sequence recovery and concurrency tests MUST preserve their existing behavioral assertions after harness migration.

### Design Decisions
| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Update only tests | Production code already reflects intended IPC architecture | Test harness becomes slightly more verbose |
| Reuse synthetic success responses | Keeps tests focused on ordering and sequence behavior rather than UI handler details | Does not exercise richer payload cases |

### Acceptance Criteria
- AC-1: `src-tauri/tests/ipc_recovery_test.rs` compiles against the current IPC API without type mismatches.
- AC-2: `src-tauri/tests/ipc_concurrency_test.rs` compiles against the current IPC API without type mismatches.
- AC-3: Recovery test still verifies monotonic sequence continuation after server restart.
- AC-4: Concurrency test still verifies contiguous sequence assignment and deterministic queued command ordering.

## Verification Strategy
- `cargo test --manifest-path src-tauri/Cargo.toml --test ipc_recovery_test -- --nocapture`
- `cargo test --manifest-path src-tauri/Cargo.toml --test ipc_concurrency_test -- --nocapture`
- `cargo check --manifest-path src-tauri/Cargo.toml --tests`
