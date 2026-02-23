# Knotd Check/Once Probe Plan
Change-Type: design-update

## Metadata
- Plan ID: `PLAN-KNOTD-CHECK-004`
- Spec: `docs/specs/component/knotd-check-once-004.md`
- Trace: `DESIGN-knotd-check-once`
- Created: `2026-02-23`
- Updated: `2026-02-23`

## Tasks
| ID | Task | Size | Depends | Refs |
| --- | --- | --- | --- | --- |
| KCO-001 | Add failing parser tests for `--check` and `--once` | S | - | FR-1, FR-5 |
| KCO-002 | Implement probe mode and one-line output formatter | S | KCO-001 | FR-2, FR-3 |
| KCO-003 | Include lock classification in probe output | S | KCO-002 | FR-4 |
| KCO-004 | Verify and document results | S | KCO-001,KCO-002,KCO-003 | FR-1, FR-2, FR-3, FR-4, FR-5 |

## Verification Commands
- `cargo test --manifest-path src-tauri/Cargo.toml --bin knotd -- --nocapture`
- `cargo check --manifest-path src-tauri/Cargo.toml --bin knotd`
