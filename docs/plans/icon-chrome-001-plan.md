# Implementation Plan: Icon-First Common Chrome

Change-Type: design-update
Trace: DESIGN-icon-first-common-chrome
Spec: `docs/specs/component/icon-chrome-001.md`
Generated: `2026-02-20`

## Summary
- Total tasks: 5
- Approach: sequential
- Goal: icon-first common chrome with persisted label preference

## Tasks

| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| IC-001 | Add failing tests for icon-first tool rail + label preference behavior | S | - | FR-1, FR-3, FR-4 |
| IC-002 | Add shared `IconButton` and `lucide-react` dependency | S | IC-001 | FR-1, FR-2, FR-5 |
| IC-003 | Convert tool rail, app top controls, editor toolbar, graph controls to icon-first | M | IC-002 | FR-1, FR-2, FR-5 |
| IC-004 | Add shell label preference state, hydrate/persist, and toggle UI | M | IC-003 | FR-3, FR-4 |
| IC-005 | Verify tests/typecheck/lint and publish audit | S | IC-004 | FR-1..FR-5 |

## Verification Commands
```bash
npm test -- --run src/App.test.tsx src/components/Shell/ToolRail.test.tsx src/components/Editor/index.test.tsx src/components/GraphView/index.test.tsx src/components/GraphView/GraphContextPanel.test.tsx src/lib/store.test.ts
npm run -s typecheck
npx eslint src/App.tsx src/App.test.tsx src/components/Shell/ToolRail.tsx src/components/Shell/ToolRail.test.tsx src/components/Editor/index.tsx src/components/GraphView/index.tsx src/components/GraphView/GraphContextPanel.tsx src/lib/store.ts src/lib/store.test.ts
```
