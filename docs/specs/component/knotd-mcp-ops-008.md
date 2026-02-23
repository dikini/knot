# Knotd MCP Operations and Launcher

## Metadata
- ID: `COMP-KNOTD-OPS-008`
- Scope: `component`
- Status: `draft`
- Parent: `COMP-KNOTD-DAEMON-002`, `COMP-KNOTD-CAPABILITIES-006`
- Concerns: `[REL, CONF]`
- Trace: `DESIGN-knotd-mcp-ops`
- Created: `2026-02-23`
- Updated: `2026-02-23`

## Purpose
Operationalize knotd-backed MCP startup with deterministic preflight checks and operator tooling.

## Functional Requirements
- FR-1: Codex MCP launcher for `knot_vault` MUST use `knotd`, not `knot-mcp`.
- FR-2: Launcher MUST run `--probe-json` preflight before starting serve mode.
- FR-3: Repository MUST provide setup script to register `knot_vault` MCP in `~/.codex/config.toml`.
- FR-4: Repository MUST provide ops smoke script covering capabilities, probe text/json, and status modes.
- FR-5: `knotd` MUST support `--help` and `--version` outputs suitable for scripting checks.
- FR-6: Docs MUST describe success, lock contention, and recovery operator workflows.

## Acceptance Criteria
- AC-1: `~/.codex/config.toml` managed block for `knot_vault` points to launcher script.
- AC-2: `npm run knotd:mcp:smoke` succeeds locally.
- AC-3: `knotd --help` and `knotd --version` checks pass in smoke script.

## Verification Strategy
- `npm run -s knotd:mcp:smoke`
- `cargo test --manifest-path src-tauri/Cargo.toml --bin knotd -- --nocapture`
- `cargo check --manifest-path src-tauri/Cargo.toml --bin knotd`
