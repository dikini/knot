# Knotd Local IPC Socket Plan
Change-Type: design-update

## Metadata
- Plan ID: `PLAN-KNOTD-IPC-009`
- Spec: `docs/specs/component/knotd-local-ipc-009.md`
- Trace: `DESIGN-knotd-local-ipc`
- Created: `2026-02-23`
- Updated: `2026-02-23`

## Tasks
| ID | Task | Size | Depends | Refs |
| --- | --- | --- | --- | --- |
| KIP-001 | Add failing parser tests for `--listen-unix` mode and missing value error | S | - | FR-1, FR-3, FR-6 |
| KIP-002 | Implement `knotd` run mode parsing and config wiring for Unix socket mode | M | KIP-001 | FR-1, FR-2, FR-3 |
| KIP-003 | Implement Unix socket serve loop with stale socket cleanup and `0600` permissions | M | KIP-002 | FR-4 |
| KIP-004 | Add non-Unix fail-fast branch and help text updates | S | KIP-002 | FR-5 |
| KIP-005 | Verification and audit report | S | KIP-001,KIP-002,KIP-003,KIP-004 | FR-1, FR-2, FR-3, FR-4, FR-5, FR-6 |

## Verification Commands
- `cargo test --manifest-path src-tauri/Cargo.toml --bin knotd -- --nocapture`
- `cargo check --manifest-path src-tauri/Cargo.toml --bin knotd`
