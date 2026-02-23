# Knotd Check/Once Probe Mode

## Metadata
- ID: `COMP-KNOTD-CHECK-004`
- Scope: `component`
- Status: `draft`
- Parent: `COMP-KNOTD-STATUS-003`
- Concerns: `[REL, CONF]`
- Trace: `DESIGN-knotd-check-once`
- Created: `2026-02-23`
- Updated: `2026-02-23`

## Purpose
Add script-friendly probe modes (`--check` and `--once`) that validate runtime attach/open semantics and exit immediately without starting MCP serve mode.

## Functional Requirements
- FR-1: `knotd` MUST accept `--check` and `--once` as synonyms for probe mode.
- FR-2: Probe mode MUST emit a single-line machine-readable result to stdout.
- FR-3: Probe mode MUST return exit code 0 on success and 3 on runtime open failure.
- FR-4: Probe mode output MUST include lock classification (`available|contended|unknown`).
- FR-5: CLI parsing tests MUST cover both `--check` and `--once`.

## Acceptance Criteria
- AC-1: `--check` and `--once` never enter MCP stdio loop.
- AC-2: Tests validate parser mode selection and output mapping helpers.
- AC-3: `cargo test --bin knotd` and `cargo check --bin knotd` pass.

## Verification Strategy
- `cargo test --manifest-path src-tauri/Cargo.toml --bin knotd -- --nocapture`
- `cargo check --manifest-path src-tauri/Cargo.toml --bin knotd`
