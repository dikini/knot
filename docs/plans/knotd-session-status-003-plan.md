# Knotd Session Status Plan
Change-Type: design-update

## Metadata
- Plan ID: `PLAN-KNOTD-STATUS-003`
- Spec: `docs/specs/component/knotd-session-status-003.md`
- Trace: `DESIGN-knotd-session-status`
- Created: `2026-02-23`
- Updated: `2026-02-23`

## Tasks
| ID | Task | Size | Depends | Refs |
| --- | --- | --- | --- | --- |
| KDS-001 | Add failing parser tests for `--status` and default serve mode | S | - | FR-1, FR-6 |
| KDS-002 | Implement status mode and JSON payload generation | M | KDS-001 | FR-1, FR-2, FR-3, FR-5 |
| KDS-003 | Integrate runtime lock classification into status payload | S | KDS-002 | FR-4 |
| KDS-004 | Verification and audit report | S | KDS-001,KDS-002,KDS-003 | FR-1, FR-2, FR-3, FR-4, FR-5, FR-6 |

## Verification Commands
- `cargo test --manifest-path src-tauri/Cargo.toml --bin knotd -- --nocapture`
- `cargo check --manifest-path src-tauri/Cargo.toml --bin knotd`
