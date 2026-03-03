# Verification Report: Knotd MCP Ops 008

## Metadata
- Date: `2026-03-03`
- Spec: `docs/specs/component/knotd-mcp-ops-008.md`
- Related spec: `docs/specs/component/linux-appimage-packaging-018.md`
- Trace: `DESIGN-knotd-mcp-ops`

## Scope
Verify the native Rust `knot mcp bridge` path no longer stalls after the JSON-RPC `initialized` notification and that the active Codex MCP command points at the fixed bridge implementation.

## Evidence
- `cargo test --manifest-path src-tauri/Cargo.toml launcher_tdd -- --nocapture`
  - Result: passed
  - Includes `launcher_tdd_bridge_does_not_wait_for_initialized_notification_response`
- `cargo check --manifest-path src-tauri/Cargo.toml`
  - Result: passed
- Debug launcher handshake against live daemon socket
  - Command path: `/home/dikini/Projects/knot/src-tauri/target/debug/knot`
  - Result: `initialize` -> `initialized` -> `tools/list` completed successfully
- Installed AppImage handshake before command switch
  - Command path: `/home/dikini/Applications/knot_0.1.0_amd64.AppImage`
  - Result: still reproduced the pre-fix timeout on `tools/list`
  - Interpretation: installed AppImage bundle is stale relative to workspace source
- Active Codex MCP command
  - File: `~/.codex/config.toml`
  - Result: updated to `/home/dikini/Projects/knot/src-tauri/target/debug/knot`

## Compliance Summary
- FR-10 (`COMP-KNOTD-OPS-008`): satisfied in source and verified through targeted handshake
- AC-7 (`COMP-KNOTD-OPS-008`): satisfied via debug launcher handshake against live daemon
- FR-8b (`COMP-LINUX-PACKAGING-018`): satisfied in source; installed AppImage still requires rebuild/reinstall to inherit the fix

## Residual Gap
- The installed AppImage binary has not been rebuilt from the patched source, so direct AppImage execution still uses the old bridge logic until a new bundle is produced and installed.
