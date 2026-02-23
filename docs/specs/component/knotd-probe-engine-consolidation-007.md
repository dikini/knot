# Knotd Probe Engine Consolidation

## Metadata
- ID: `COMP-KNOTD-PROBE-ENGINE-007`
- Scope: `component`
- Status: `draft`
- Parent: `COMP-KNOTD-STATUS-003`, `COMP-KNOTD-CHECK-004`, `COMP-KNOTD-PROBE-JSON-005`
- Concerns: `[REL, CONF]`
- Trace: `DESIGN-knotd-probe-engine-consolidation`
- Created: `2026-02-23`
- Updated: `2026-02-23`

## Purpose
Reduce duplication and drift risk by unifying status/probe/probe-json behavior behind one internal probe outcome engine.

## Functional Requirements
- FR-1: `knotd` MUST compute a single internal probe outcome structure from runtime init result.
- FR-2: `--status`, `--check/--once`, and `--probe-json` outputs MUST derive from that shared outcome.
- FR-3: Probe-related exit code mapping MUST be centralized and consistent.
- FR-4: Existing probe and status external behavior MUST remain backward compatible.
- FR-5: Unit tests MUST cover shared outcome conversion and output formatting compatibility.

## Acceptance Criteria
- AC-1: Shared helper(s) exist and are used by all probe/status run modes.
- AC-2: Existing parser/output tests still pass.
- AC-3: New consolidation tests pass.

## Verification Strategy
- `cargo test --manifest-path src-tauri/Cargo.toml --bin knotd -- --nocapture`
- `cargo check --manifest-path src-tauri/Cargo.toml --bin knotd`
