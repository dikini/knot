# Implementation Plan: Editor Modes M2 (Block Inserter + Context Refinement)

Change-Type: design-update
Trace: DESIGN-editor-medium-like-interactions
Spec: `docs/specs/component/editor-modes-wysiwym-001.md`
Generated: `2026-02-20`

## Tasks

| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| EM2-001 | Separate selection toolbar actions to character-level controls only | S | - | FR-5 |
| EM2-002 | Add contextual block `+` tool on collapsed cursor line in edit mode | S | EM2-001 | FR-6 |
| EM2-003 | Add initial block menu actions (`Code block`, `Blockquote`) inserting block below current line | S | EM2-002 | FR-7 |
| EM2-004 | Add/update editor tests and run verification | S | EM2-003 | AC-4, AC-6 |

## Verification Commands
```bash
npm test -- --run src/components/Editor/index.test.tsx
npm run -s typecheck
```
