# Knotd Check/Once Verification (2026-02-23)

Spec: `docs/specs/component/knotd-check-once-004.md`
Plan: `docs/plans/knotd-check-once-004-plan.md`
Trace: `DESIGN-knotd-check-once`

## Commands
- `cargo test --manifest-path src-tauri/Cargo.toml --bin knotd -- --nocapture`
- `cargo check --manifest-path src-tauri/Cargo.toml --bin knotd`

## Results
- knotd bin tests: PASS (10/10)
- knotd bin compile check: PASS

## Requirement Coverage
| Requirement | Evidence | Status |
| --- | --- | --- |
| FR-1 check/once flags | parser handles `--check` and `--once` -> `RunMode::Probe` | ✅ |
| FR-2 one-line output | `probe_output_line` in `src-tauri/src/bin/knotd.rs` | ✅ |
| FR-3 exit code semantics | probe branch exits `0` on ok, `3` on failure | ✅ |
| FR-4 lock classification in probe | `classify_lock_status_text` used in probe output | ✅ |
| FR-5 parser coverage | knotd tests for check/once flags | ✅ |
