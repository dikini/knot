# Knotd Session Status Control Surface

## Metadata
- ID: `COMP-KNOTD-STATUS-003`
- Scope: `component`
- Status: `draft`
- Parent: `COMP-KNOTD-DAEMON-002`, `COMP-KNOTD-RUNTIME-001`
- Concerns: `[REL, CONF]`
- Trace: `DESIGN-knotd-session-status`
- Created: `2026-02-23`
- Updated: `2026-02-23`

## Purpose
Provide a non-serving status mode for `knotd` that gives machine-readable session/openability diagnostics before attach/serve flows.

## Functional Requirements
- FR-1: `knotd` MUST accept `--status` to run probe mode and exit without serving MCP.
- FR-2: In status mode, `knotd` MUST emit a JSON payload to stdout.
- FR-3: Status payload MUST include `mode`, `vault_path`, `create`, `ok`, and `lock_status` fields.
- FR-4: Status probe MUST classify lock contention using shared runtime lock classification.
- FR-5: Status mode MUST return exit code 0 when probe succeeds, non-zero on probe failure.
- FR-6: CLI parsing tests MUST cover `--status` behavior.

## Acceptance Criteria
- AC-1: `--status` does not enter MCP stdio loop.
- AC-2: status output is valid JSON with required fields.
- AC-3: parser tests validate status flag and default serve mode.

## Non-Goals
- Full daemon attach protocol or external health endpoint.

## Verification Strategy
- `cargo test --manifest-path src-tauri/Cargo.toml --bin knotd -- --nocapture`
- `cargo check --manifest-path src-tauri/Cargo.toml --bin knotd`
