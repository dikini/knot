# Implementation Plan: Graph UI Continuity and Toggle Semantics

Change-Type: design-update
Trace: DESIGN-graph-ui-continuity-003
Spec: `docs/specs/component/graph-ui-continuity-003.md`
Generated: `2026-02-21`

## Summary
- Total tasks: 5
- Approach: sequential
- Size: 3 small, 2 medium
- Goal: implement next-action toggle icon behavior and selectable graph relationship rows with note-list visual continuity.

## Tasks

| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| GUC-001 | Add failing tests for mode toggle next-icon behavior in app shell | M | - | FR-1 |
| GUC-002 | Add failing tests for graph scope single-toggle and selectable neighbor/backlink rows | M | GUC-001 | FR-2, FR-3, FR-5 |
| GUC-003 | Implement app mode toggle next-icon behavior (`Network` vs `SquarePen`) | S | GUC-002 | FR-1 |
| GUC-004 | Refactor graph context controls to single scope toggle and relationship row interactions | S | GUC-003 | FR-2, FR-3, FR-5 |
| GUC-005 | Apply note-list continuity styling for relationship rows (without folder affordances), verify tests/typecheck, and publish audit | S | GUC-004 | FR-4 |

## Dependency DAG
```text
GUC-001 -> GUC-002 -> GUC-003 -> GUC-004 -> GUC-005
```

## Concern Coverage
| Concern | Tasks | Verification |
| --- | --- | --- |
| CONF | GUC-001, GUC-003, GUC-004 | App/graph-control interaction tests |
| REL | GUC-002, GUC-004, GUC-005 | Selection-flow regression tests and stable control semantics |
| CAP | GUC-005 | Minimal UI changes preserving compact panel footprint |

## Verification Commands
```bash
npm test -- --run src/App.test.tsx src/components/GraphView/GraphContextPanel.test.tsx
npm run -s typecheck
```
