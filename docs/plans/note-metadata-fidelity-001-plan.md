# Implementation Plan: Note Metadata Fidelity

Change-Type: bug-fix
Trace: BUG-note-metadata-fidelity-001
Spec: `docs/specs/component/note-metadata-fidelity-001.md`
Generated: `2026-02-22`

## Metadata
- Spec: `docs/specs/component/note-metadata-fidelity-001.md`
- Generated: `2026-02-22`
- Approach: `sequential`

## Summary
- Total tasks: `4`
- Size mix: `2 small, 2 medium`
- Critical path: `NMF-001 → NMF-002 → NMF-003 → NMF-004`

## Tasks

### Phase 1: Foundation
| ID | Task | Size | Depends | Spec Ref |
|----|------|------|---------|----------|
| NMF-001 | Add helpers for heading byte-offset extraction and filename-stem fallback | S | - | FR-2, FR-4 |

### Phase 2: Core Command Behavior
| ID | Task | Size | Depends | Spec Ref |
|----|------|------|---------|----------|
| NMF-002 | Update `get_note` backlink title resolution and heading position mapping | M | NMF-001 | FR-1, FR-2, FR-3, FR-4 |
| NMF-003 | Update `create_note` heading position mapping to shared helper | S | NMF-001 | FR-3 |

### Phase 3: Verification
| ID | Task | Size | Depends | Spec Ref |
|----|------|------|---------|----------|
| NMF-004 | Add/execute Rust unit tests for backlink title + heading position behavior | M | NMF-002, NMF-003 | AC-1..AC-5 |

## Dependency DAG
`NMF-001 → NMF-002 → NMF-003 → NMF-004`

## Concern Coverage
| Concern | Tasks | Verification |
|---------|-------|--------------|
| REL | NMF-001, NMF-002, NMF-003, NMF-004 | Targeted unit tests in notes command module |
| CONF | NMF-001, NMF-002, NMF-004 | Assertions on title output/fallback values |

## Execution Notes
- Keep response schemas unchanged.
- Prefer pure helper functions for deterministic tests.
- Avoid filesystem writes in tests beyond existing temp-vault fixtures.

## Execution Complete
- Date: `2026-02-22`
- Status: `implemented`
- Verification: `docs/audit/note-metadata-fidelity-001-verification-2026-02-22.md`
