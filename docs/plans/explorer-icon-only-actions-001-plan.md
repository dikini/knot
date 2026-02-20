# Implementation Plan: Explorer Icon-Only Actions

Change-Type: design-update
Trace: DESIGN-explorer-icon-only-actions
Spec: `docs/specs/component/explorer-icon-only-actions-001.md`
Generated: `2026-02-20`

## Tasks

| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| EIA-001 | Remove textual `+ New Note` button and redundant handler from Sidebar | S | - | FR-1 |
| EIA-002 | Add/update Sidebar tests for icon-only action surface | S | EIA-001 | FR-1, FR-2 |
| EIA-003 | Verify sidebar tests and typecheck; publish audit | S | EIA-002 | FR-1, FR-2 |

## Verification Commands
```bash
npm test -- --run src/components/Sidebar/index.test.tsx
npm run -s typecheck
```
