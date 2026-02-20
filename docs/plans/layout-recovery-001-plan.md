# Implementation Plan: Left Pane Recovery Guard

Change-Type: bug-fix
Trace: BUG-left-pane-collapse-recovery
Spec: `docs/specs/component/layout-recovery-001.md`
Generated: `2026-02-20`

## Summary
- Total tasks: 3
- Approach: sequential
- Goal: guarantee recoverability by making tool rail non-collapsible and self-healing legacy state

## Tasks

| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| LR-001 | Add failing test for legacy-collapsed tool rail normalization | S | - | FR-2, FR-3 |
| LR-002 | Remove tool rail collapse control and auto-restore legacy collapsed state | S | LR-001 | FR-1, FR-2 |
| LR-003 | Verify tests/typecheck/lint and publish audit | S | LR-002 | FR-3 |

## Verification Commands
```bash
npm test -- --run src/App.test.tsx
npm run -s typecheck
npx eslint src/App.tsx src/App.test.tsx
```
