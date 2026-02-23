# Knotd Daemon Bootstrap

## Metadata
- ID: `COMP-KNOTD-DAEMON-002`
- Scope: `component`
- Status: `draft`
- Parent: `COMP-KNOTD-RUNTIME-001`, `COMP-MCP-SERVER-001`
- Concerns: `[REL, CONF]`
- Trace: `DESIGN-knotd-daemon-bootstrap`
- Created: `2026-02-23`
- Updated: `2026-02-23`

## Purpose
Provide a dedicated desktop daemon-capable `knotd` binary that uses the shared runtime host and serves MCP over stdio, enabling single-process ownership flows for agent-first usage.

## Functional Requirements
- FR-1: A `knotd` binary MUST exist and start from CLI.
- FR-2: `knotd` MUST accept vault path from `--vault <path>` or `KNOT_VAULT_PATH`.
- FR-3: `knotd` MUST support `--create` for creating a new vault before serving.
- FR-4: `knotd` MUST initialize `RuntimeHost` in desktop daemon-capable mode.
- FR-5: `knotd` MUST construct MCP server from runtime host and run stdio framed loop.
- FR-6: On startup failures, `knotd` MUST exit non-zero with actionable stderr.
- FR-7: CLI argument parsing behavior MUST be covered by unit tests.

## Acceptance Criteria
- AC-1: `cargo check --bin knotd` passes.
- AC-2: Unit tests verify parse precedence (`--vault` over env) and missing-path failure.
- AC-3: Unit tests verify `--create` flag detection.
- AC-4: `knotd` compiles and links against shared runtime + MCP runtime constructor.

## Non-Goals
- Implementing daemon IPC protocol beyond MCP stdio.
- Background service manager integration (systemd/launchd).

## Verification Strategy
- `cargo test --manifest-path src-tauri/Cargo.toml knotd::tests:: -- --nocapture`
- `cargo check --manifest-path src-tauri/Cargo.toml --bin knotd`
