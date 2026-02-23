# Knotd Local IPC Verification (2026-02-23)

Spec: `docs/specs/component/knotd-local-ipc-009.md`  
Plan: `docs/plans/knotd-local-ipc-009-plan.md`  
Trace: `DESIGN-knotd-local-ipc`

## Commands
- `cargo test --manifest-path src-tauri/Cargo.toml --bin knotd -- --nocapture`
- `cargo check --manifest-path src-tauri/Cargo.toml --bin knotd`
- `cargo build --manifest-path src-tauri/Cargo.toml --bin knotd`
- Manual Unix socket MCP initialize smoke check using local node script.

## Results
- knotd tests: PASS (20/20)
- knotd compile check: PASS
- knotd build: PASS
- Unix socket initialize response: PASS (`unix_init_ms=23` during smoke)

## Requirement Coverage
| Requirement | Evidence | Status |
| --- | --- | --- |
| FR-1 `--listen-unix` serve mode | `RunMode::ServeUnix` + parser branch + serve branch in `src-tauri/src/bin/knotd.rs` | ✅ |
| FR-2 stdio mode preserved | stdio serve path remains default in `src-tauri/src/bin/knotd.rs` | ✅ |
| FR-3 missing value rejection | `parse_flag_value` + test `parse_fails_when_listen_unix_value_missing` | ✅ |
| FR-4 stale socket cleanup + 0600 | `run_unix_socket_server` (`remove_file`, `set_permissions(0o600)`) | ✅ |
| FR-5 non-Unix fail-fast | `#[cfg(not(unix))]` branch in serve mode | ✅ |
| FR-6 parse tests coverage | knotd unit tests in `src-tauri/src/bin/knotd.rs` | ✅ |
