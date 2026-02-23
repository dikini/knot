# Knotd Probe Engine Consolidation Plan
Change-Type: design-update

## Metadata
- Plan ID: `PLAN-KNOTD-PROBE-ENGINE-007`
- Spec: `docs/specs/component/knotd-probe-engine-consolidation-007.md`
- Trace: `DESIGN-knotd-probe-engine-consolidation`
- Created: `2026-02-23`
- Updated: `2026-02-23`

## Tasks
| ID | Task | Size | Depends | Refs |
| --- | --- | --- | --- | --- |
| KPE-001 | Add failing tests for shared probe outcome and centralized exit mapping | S | - | FR-1, FR-3, FR-5 |
| KPE-002 | Implement shared probe outcome helper and wire status/probe/probe-json paths | M | KPE-001 | FR-1, FR-2 |
| KPE-003 | Ensure output/exit compatibility and remove duplicate mapping logic | S | KPE-002 | FR-3, FR-4 |
| KPE-004 | Verify and audit | S | KPE-001,KPE-002,KPE-003 | FR-1, FR-2, FR-3, FR-4, FR-5 |

## Verification Commands
- `cargo test --manifest-path src-tauri/Cargo.toml --bin knotd -- --nocapture`
- `cargo check --manifest-path src-tauri/Cargo.toml --bin knotd`
