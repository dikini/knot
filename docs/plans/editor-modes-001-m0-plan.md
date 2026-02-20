# Implementation Plan: Editor Modes M0 (Source/Edit/View Framework)

Change-Type: design-update
Trace: DESIGN-editor-medium-like-interactions
Spec: `docs/specs/component/editor-modes-wysiwym-001.md`
Generated: `2026-02-20`

## Tasks

| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| EM0-001 | Add editor mode state and toolbar mode switches with persistence | S | - | FR-1, FR-2 |
| EM0-002 | Implement source mode (raw markdown textarea) with live updates | S | EM0-001 | FR-3, FR-9 |
| EM0-003 | Implement view mode (frontend rendered markdown, read-only) | S | EM0-001 | FR-4 |
| EM0-004 | Update editor tests and verify typecheck | S | EM0-002, EM0-003 | AC-1, AC-2, AC-3 |

## Verification Commands
```bash
npm test -- --run src/components/Editor/index.test.tsx
npm run -s typecheck
```
