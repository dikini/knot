# Implementation Plan: Editor Modes M3 (Syntax Hardening + Control Placement)

Change-Type: design-update
Trace: DESIGN-editor-medium-like-interactions
Spec: `docs/specs/component/editor-modes-wysiwym-001.md`
Generated: `2026-02-20`

## Tasks

| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| EM3-001 | Harden edit-mode heading input so markdown heading markers are transformed on-space and not left visibly leaked | S | - | FR-8 |
| EM3-002 | Improve contextual control placement and visibility (selection toolbar and block inserter) to keep controls legible and aligned in sepia/dark themes | S | EM3-001 | FR-5, FR-6 |
| EM3-003 | Add/update regression tests for heading transform and mode fidelity (`source -> view -> source`) | S | EM3-002 | AC-7, AC-8 |
| EM3-004 | Verify tests and type-safety | S | EM3-003 | AC-7, AC-8 |

## Verification Commands
```bash
npm test -- --run src/editor/plugins/keymap.test.ts
npm test -- --run src/components/Editor/index.test.tsx
npm run -s typecheck
```
