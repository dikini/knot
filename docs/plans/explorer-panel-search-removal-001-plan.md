# Implementation Plan: Explorer Panel Search Removal

Change-Type: design-update
Trace: DESIGN-explorer-panel-no-search
Spec: `docs/specs/component/explorer-panel-search-removal-001.md`
Generated: `2026-02-20`

## Tasks

| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| EPS-001 | Remove `SearchBox` render from Sidebar explorer panel | S | - | FR-1 |
| EPS-002 | Remove unused explorer search selection code paths | S | EPS-001 | FR-1 |
| EPS-003 | Verify sidebar tests/typecheck/lint and publish audit | S | EPS-002 | FR-1, FR-2 |

## Verification Commands
```bash
npm test -- --run src/components/Sidebar/index.test.tsx
npm run -s typecheck
npx eslint src/components/Sidebar/index.tsx src/components/Sidebar/index.test.tsx
```
