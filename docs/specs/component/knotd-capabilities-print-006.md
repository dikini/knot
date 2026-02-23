# Knotd Capabilities Print Mode

## Metadata
- ID: `COMP-KNOTD-CAPABILITIES-006`
- Scope: `component`
- Status: `draft`
- Parent: `COMP-KNOTD-PROBE-JSON-005`
- Concerns: `[REL, CONF]`
- Trace: `DESIGN-knotd-capabilities-print`
- Created: `2026-02-23`
- Updated: `2026-02-23`

## Purpose
Expose a machine-readable capabilities inventory via `--print-capabilities` so orchestration tools can discover supported modes and flags before invoking `knotd`.

## Functional Requirements
- FR-1: `knotd` MUST accept `--print-capabilities` and exit immediately without vault open or MCP serve.
- FR-2: Capabilities output MUST be valid JSON.
- FR-3: Output MUST include supported run modes and CLI flags.
- FR-4: Exit code MUST be 0 on success, non-zero on serialization failure.
- FR-5: Parser tests MUST cover `--print-capabilities` mode selection.

## Acceptance Criteria
- AC-1: `--print-capabilities` does not require `--vault`.
- AC-2: Unit tests cover parser behavior and payload shape.
- AC-3: `cargo test --bin knotd` and `cargo check --bin knotd` pass.

## Verification Strategy
- `cargo test --manifest-path src-tauri/Cargo.toml --bin knotd -- --nocapture`
- `cargo check --manifest-path src-tauri/Cargo.toml --bin knotd`
