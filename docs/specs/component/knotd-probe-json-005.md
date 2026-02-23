# Knotd Probe JSON Mode

## Metadata
- ID: `COMP-KNOTD-PROBE-JSON-005`
- Scope: `component`
- Status: `draft`
- Parent: `COMP-KNOTD-CHECK-004`
- Concerns: `[REL, CONF]`
- Trace: `DESIGN-knotd-probe-json`
- Created: `2026-02-23`
- Updated: `2026-02-23`

## Purpose
Provide a structured JSON probe mode (`--probe-json`) for orchestration scripts that need stable machine-readable output.

## Functional Requirements
- FR-1: `knotd` MUST accept `--probe-json` and run non-serving probe mode.
- FR-2: Probe JSON payload MUST include `mode`, `vault_path`, `create`, `ok`, `lock_status`, and `error`.
- FR-3: `--probe-json` MUST return exit code 0 on success and 3 on probe failure.
- FR-4: Parser tests MUST validate `--probe-json` mode selection.
- FR-5: JSON serialization failures MUST return non-zero exit with stderr.

## Acceptance Criteria
- AC-1: `--probe-json` does not start MCP stdio loop.
- AC-2: Tests cover parser mode and payload shape helper.
- AC-3: `cargo test --bin knotd` and `cargo check --bin knotd` pass.

## Verification Strategy
- `cargo test --manifest-path src-tauri/Cargo.toml --bin knotd -- --nocapture`
- `cargo check --manifest-path src-tauri/Cargo.toml --bin knotd`
