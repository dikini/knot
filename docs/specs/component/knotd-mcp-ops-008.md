# Knotd MCP Operations and Launcher

## Metadata
- ID: `COMP-KNOTD-OPS-008`
- Scope: `component`
- Status: `draft`
- Parent: `COMP-KNOTD-DAEMON-002`, `COMP-KNOTD-CAPABILITIES-006`
- Concerns: `[REL, CONF]`
- Trace: `DESIGN-knotd-mcp-ops`
- Created: `2026-02-23`
- Updated: `2026-02-27`

## Purpose
Operationalize knotd-backed MCP startup with deterministic preflight checks and operator tooling.

## Functional Requirements
- FR-1: Codex MCP launcher for `knot_vault` MUST use `knotd`, not `knot-mcp`.
- FR-2: Launcher MUST run `--probe-json` preflight before starting serve mode.
- FR-3: Repository MUST provide setup script to register `knot_vault` MCP in `~/.codex/config.toml`.
- FR-4: Repository MUST provide ops smoke script covering capabilities, probe text/json, and status modes.
- FR-5: `knotd` MUST support `--help` and `--version` outputs suitable for scripting checks.
- FR-6: Docs MUST describe success, lock contention, and recovery operator workflows.
- FR-7: Repository-local MCP bridge overrides MUST support a checked-in developer workflow where `npm run dev:daemon:up` and Codex MCP can target the same Unix socket without editing `~/.codex/config.toml`.
- FR-8: Repository MUST ignore `.mcp/knotd-mcp.json` so local socket-path overrides remain untracked.
- FR-9: Repository MUST ignore `.run/` so dev-daemon pid, log, and socket artifacts remain untracked.
- FR-10: The native `knot mcp bridge` launcher path used by Codex MUST preserve JSON-RPC notification semantics so `initialized` does not stall subsequent request forwarding.

## Acceptance Criteria
- AC-1: `~/.codex/config.toml` managed block for `knot_vault` points to launcher script.
- AC-2: `npm run knotd:mcp:smoke` succeeds locally.
- AC-3: `knotd --help` and `knotd --version` checks pass in smoke script.
- AC-4: A local `.mcp/knotd-mcp.json` can point `knot_vault` at `.run/knotd-dev/knotd.sock`, matching the default `npm run dev:daemon:up` runtime socket.
- AC-5: `.gitignore` ignores `.mcp/knotd-mcp.json`.
- AC-6: `.gitignore` ignores `.run/`.
- AC-7: A live daemon-backed bridge handshake completes `initialize` -> `initialized` -> `tools/list` through the native `knot mcp bridge` path.

## Verification Strategy
- `npm run -s knotd:mcp:smoke`
- `cargo test --manifest-path src-tauri/Cargo.toml --bin knotd -- --nocapture`
- `cargo check --manifest-path src-tauri/Cargo.toml --bin knotd`
- `npm test -- --run src/tooling/knotdMcpConfig.test.ts`
- `git check-ignore -v .mcp/knotd-mcp.json`
- `git check-ignore -v .run/knotd-dev/knotd.log`
- AppImage bridge handshake smoke against a reachable daemon socket

## Revision History
- `2026-02-27`: Added repo-local MCP socket override and git-ignore requirements for the dev daemon workflow.
- `2026-02-27`: Added `.run/` ignore requirement for dev-daemon runtime artifacts.
- `2026-03-03`: Added native bridge notification-handling requirement and handshake verification for the Rust launcher path.
