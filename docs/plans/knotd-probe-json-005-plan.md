# Knotd Probe JSON Plan
Change-Type: design-update

## Metadata
- Plan ID: `PLAN-KNOTD-PROBE-JSON-005`
- Spec: `docs/specs/component/knotd-probe-json-005.md`
- Trace: `DESIGN-knotd-probe-json`
- Created: `2026-02-23`
- Updated: `2026-02-23`

## Tasks
| ID | Task | Size | Depends | Refs |
| --- | --- | --- | --- | --- |
| KPJ-001 | Add failing tests for `--probe-json` parse mode and payload helper | S | - | FR-1, FR-2, FR-4 |
| KPJ-002 | Implement probe-json mode branch and JSON emitter | S | KPJ-001 | FR-1, FR-2, FR-3 |
| KPJ-003 | Handle serialization error path with explicit exit | S | KPJ-002 | FR-5 |
| KPJ-004 | Verify and audit | S | KPJ-001,KPJ-002,KPJ-003 | FR-1, FR-2, FR-3, FR-4, FR-5 |

## Verification Commands
- `cargo test --manifest-path src-tauri/Cargo.toml --bin knotd -- --nocapture`
- `cargo check --manifest-path src-tauri/Cargo.toml --bin knotd`
