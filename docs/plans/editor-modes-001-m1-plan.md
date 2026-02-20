# Implementation Plan: Editor Modes M1 (Selection Floating Toolbar)

Change-Type: design-update
Trace: DESIGN-editor-medium-like-interactions
Spec: `docs/specs/component/editor-modes-wysiwym-001.md`
Generated: `2026-02-20`

## Tasks

| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| EM1-001 | Add ProseMirror selection callback plumbing for UI consumers | S | - | FR-5 |
| EM1-002 | Implement floating selection toolbar in edit mode | S | EM1-001 | FR-5 |
| EM1-003 | Wire initial actions (`Bold`, `Italic`, `Code`, `Link`, `Quote`) | S | EM1-002 | FR-5 |
| EM1-004 | Add editor tests for toolbar visibility and run verification | S | EM1-003 | AC-4 |

## Verification Commands
```bash
npm test -- --run src/components/Editor/index.test.tsx
npm run -s typecheck
```
