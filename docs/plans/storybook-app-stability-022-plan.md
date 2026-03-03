# Implementation Plan: Storybook App Stability 022

## Metadata

- Trace: `DESIGN-storybook-app-stability-022`
- Spec: `docs/specs/component/storybook-app-stability-022.md`
- Change-Type: `design-update`
- Generated: `2026-03-03`
- Approach: `sequential`

## Summary

- Goal: stabilize the Storybook/App verification lane by removing Tauri runtime leakage and syncing the coverage inventory
- Total tasks: 4
- Critical path: `red-state capture -> App regression test -> runtime/mock fixes -> inventory sync -> verification`

## Tasks

| ID          | Task                                                                                     | Size | Depends     | Spec Ref         |
| ----------- | ---------------------------------------------------------------------------------------- | ---- | ----------- | ---------------- |
| SAS-022-001 | Capture failing Storybook/App baseline and add the listener-registration regression test | S    | -           | FR-1, FR-5       |
| SAS-022-002 | Harden `App` listener setup and provide Storybook-safe runtime defaults for App stories  | M    | SAS-022-001 | FR-1, FR-2, FR-3 |
| SAS-022-003 | Refresh the Storybook coverage inventory to match current exports                        | S    | SAS-022-002 | FR-4             |
| SAS-022-004 | Run verification commands and publish audit evidence                                     | S    | SAS-022-003 | FR-5             |

## Verification Commands

- `npm run test -- --run src/App.test.tsx`
- `npm run -s storybook:test:vitest`
- `npm run -s qa:storybook-matrix`
- `npm run typecheck`
