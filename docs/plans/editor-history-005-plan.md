# Implementation Plan: Editor History Controls

Change-Type: bug-fix
Trace: BUG-editor-history-005
Spec: `docs/specs/component/editor-history-005.md`
Generated: `2026-03-01`
Status: `completed`

## Summary
- Total tasks: 4
- Approach: sequential
- Size: 3 small, 1 medium
- Goal: restore edit-mode keyboard undo/redo and add shared-toolbar history controls without expanding scope beyond editor history.

## Tasks

| ID | Task | Size | Depends | Spec Ref | Status |
| --- | --- | --- | --- | --- | --- |
| EH-001A | Add failing tests for shared undo/redo helpers in the editor command layer | S | - | EH-001 | completed |
| EH-002A | Add failing keymap and editor component tests for keyboard and toolbar history flows | M | EH-001A | EH-002, EH-003 | completed |
| EH-003B | Implement shared history helpers and wire edit-mode shortcuts plus toolbar buttons through them | S | EH-002A | EH-001, EH-002, EH-003 | completed |
| EH-005V | Run targeted verification, update artifacts, and publish audit | M | EH-003B | EH-001, EH-002, EH-003 | completed |

## Dependency DAG
```text
EH-001A -> EH-002A -> EH-003B -> EH-005V
```

## Concern Coverage
| Concern | Tasks | Verification |
| --- | --- | --- |
| CONF | EH-001A, EH-002A, EH-003B | Command, keymap, and component tests confirm a single history command path and stable toolbar placement |
| REL | EH-002A, EH-003B, EH-005V | Disabled-state checks and end-to-end invocation coverage prevent silent history regressions |

## Verification Commands
```bash
npx vitest run src/editor/commands.test.ts src/editor/plugins/keymap.test.ts src/components/Editor/index.test.tsx
npm run typecheck
```
