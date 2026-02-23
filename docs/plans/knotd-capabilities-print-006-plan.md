# Knotd Capabilities Print Plan
Change-Type: design-update

## Metadata
- Plan ID: `PLAN-KNOTD-CAPABILITIES-006`
- Spec: `docs/specs/component/knotd-capabilities-print-006.md`
- Trace: `DESIGN-knotd-capabilities-print`
- Created: `2026-02-23`
- Updated: `2026-02-23`

## Tasks
| ID | Task | Size | Depends | Refs |
| --- | --- | --- | --- | --- |
| KCP-001 | Add failing parse test for `--print-capabilities` and no-vault behavior | S | - | FR-1, FR-5 |
| KCP-002 | Implement capabilities mode branch and JSON payload helper | S | KCP-001 | FR-1, FR-2, FR-3 |
| KCP-003 | Add serialization failure exit path handling | S | KCP-002 | FR-4 |
| KCP-004 | Verify and write audit report | S | KCP-001,KCP-002,KCP-003 | FR-1, FR-2, FR-3, FR-4, FR-5 |

## Verification Commands
- `cargo test --manifest-path src-tauri/Cargo.toml --bin knotd -- --nocapture`
- `cargo check --manifest-path src-tauri/Cargo.toml --bin knotd`
