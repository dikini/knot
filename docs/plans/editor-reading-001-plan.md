# Implementation Plan: Editor Reading Experience Refresh

Change-Type: design-update
Trace: DESIGN-editor-reading-refresh
Spec: `docs/specs/component/editor-reading-001.md`
Generated: `2026-02-20`

## Summary
- Total tasks: 5
- Approach: sequential
- Scope: shell chrome contrast, editor surfaces, measure-banding, regression hardening

## Tasks

| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| ER-001 | Refresh global/shell palettes for dark modern chrome with warm contrast | M | - | FR-1 |
| ER-002 | Add editor surface toggle (`sepia`/`dark`) and persistence | S | ER-001 | FR-2, FR-3 |
| ER-003 | Implement deterministic width-band measure classes in App and editor CSS | M | ER-002 | FR-4, FR-5 |
| ER-004 | Add/maintain regression tests for editor surface state and remount behavior | S | ER-003 | FR-2, FR-4, FR-6 |
| ER-005 | Verify and document automated + manual reading checks | S | ER-004 | FR-1..FR-6 |

## TDD Notes
- `FR-4` extracted to pure function (`getEditorMeasureBand`) and unit-tested.
- Visual contrast/typographic outcomes are validated manually (documented in audit) because CSS rendering is runtime/display dependent.

## Verification Commands
```bash
npm test -- --run src/App.test.tsx
npm test -- --run src/components/Editor/index.test.tsx
npm run -s typecheck
npx eslint src/App.tsx src/App.test.tsx
```
