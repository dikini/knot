# Knotd Session Status Verification (2026-02-23)

Spec: `docs/specs/component/knotd-session-status-003.md`
Plan: `docs/plans/knotd-session-status-003-plan.md`
Trace: `DESIGN-knotd-session-status`

## Commands
- `cargo test --manifest-path src-tauri/Cargo.toml --bin knotd -- --nocapture`
- `cargo check --manifest-path src-tauri/Cargo.toml --bin knotd`

## Results
- knotd bin tests: PASS (7/7)
- knotd bin compile check: PASS

## Requirement Coverage
| Requirement | Evidence | Status |
| --- | --- | --- |
| FR-1 `--status` mode | parser + run mode branch in `src-tauri/src/bin/knotd.rs` | ✅ |
| FR-2 status JSON output | `status_payload` + `serde_json::to_string_pretty` in `main` | ✅ |
| FR-3 required status fields | `KnotdStatusPayload` fields | ✅ |
| FR-4 lock classification | `RuntimeHost::classify_open_error` used by `status_payload` | ✅ |
| FR-5 status exit code semantics | branch exits 0 on success, 3 on failure | ✅ |
| FR-6 parser test coverage | `knotd` bin tests | ✅ |
