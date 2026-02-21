# Implementation Plan: Editor WYSIWYM and Edit-Flow Stability

Change-Type: design-update
Trace: DESIGN-editor-wysiwym-002
Spec: `docs/specs/component/editor-wysiwym-002.md`
Generated: `2026-02-21`

## Summary
- Total tasks: 6
- Approach: sequential
- Size: 3 small, 3 medium
- Goal: remove markdown heading marker leakage in edit mode, make edit tools visually distinguishable, and stabilize Enter/new paragraph persistence.

## Tasks

| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| EWY-001 | Add failing tests for no heading marker injection in edit mode | S | - | FR-1 |
| EWY-002 | Add failing tests for block menu icon+label distinguishability | S | EWY-001 | FR-2, FR-3 |
| EWY-003 | Add failing test for editor lifecycle stability under onChange sync (no reinit churn) | M | EWY-002 | FR-4, FR-5 |
| EWY-004 | Remove heading-prefix node view injection and keep semantic heading presentation | M | EWY-003 | FR-1 |
| EWY-005 | Implement icon-forward block menu actions and toolbar visual hardening | M | EWY-004 | FR-2, FR-3 |
| EWY-006 | Refactor edit-mode init/sync lifecycle, verify Enter paragraph persistence, and publish audit | S | EWY-005 | FR-4, FR-5 |

## Dependency DAG
```text
EWY-001 -> EWY-002 -> EWY-003 -> EWY-004 -> EWY-005 -> EWY-006
```

## Concern Coverage
| Concern | Tasks | Verification |
| --- | --- | --- |
| CONF | EWY-001, EWY-004, EWY-005 | Visual/behavior tests for clean WYSIWYM and distinguishable controls |
| REL | EWY-003, EWY-006 | Lifecycle stability and paragraph persistence under sync |
| CAP | EWY-005, EWY-006 | UI clarity without heavy additional chrome; bounded state transitions |

## Verification Commands
```bash
npm test -- --run src/components/Editor/index.test.tsx src/editor/plugins/syntax-hide.test.ts
npm run -s typecheck
```
