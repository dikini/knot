# Knotd Daemon Bootstrap Plan
Change-Type: design-update

## Metadata
- Plan ID: `PLAN-KNOTD-DAEMON-002`
- Spec: `docs/specs/component/knotd-daemon-bootstrap-002.md`
- Trace: `DESIGN-knotd-daemon-bootstrap`
- Created: `2026-02-23`
- Updated: `2026-02-23`

## Tasks
| ID | Task | Size | Depends | Refs |
| --- | --- | --- | --- | --- |
| KDB-001 | Add tests for CLI parse semantics (`--vault`, env, `--create`, missing path) | S | - | FR-2, FR-3, FR-7 |
| KDB-002 | Implement `knotd` binary with runtime host initialization and MCP stdio serving | M | KDB-001 | FR-1, FR-4, FR-5, FR-6 |
| KDB-003 | Register `knotd` bin target in Cargo and verify compile | S | KDB-002 | FR-1, FR-4 |
| KDB-004 | Run verification commands and write audit note | S | KDB-001,KDB-002,KDB-003 | FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7 |

## Verification Commands
- `cargo test --manifest-path src-tauri/Cargo.toml knotd::tests:: -- --nocapture`
- `cargo check --manifest-path src-tauri/Cargo.toml --bin knotd`
