# Frontend Lint Cleanup

## Metadata
- ID: `COMP-LINT-001`
- Scope: `component`
- Status: `implemented`
- Parent: `COMP-TOOLCHAIN-001`, `COMP-FRONTEND-001`
- Concerns: [COMP, REL]
- Created: `2026-02-20`
- Updated: `2026-02-20`

## Purpose
Eliminate current frontend lint errors and warnings to restore code-quality gate compliance for the TypeScript workspace.

## Contract

### Functional Requirements

**FR-1**: Markdown serializer/parsing module lint-safe switch blocks
- `switch` cases must not contain direct lexical declarations without block scopes.

**FR-2**: Editor plugins avoid unused variables and explicit `any`
- Remove unused variables in plugin transaction handlers.
- Replace explicit `any` types with concrete ProseMirror types.

**FR-3**: React hook dependency warnings resolved
- Hook dependency arrays must include referenced callbacks/values or code structure must avoid unstable dependency patterns.

**FR-4**: Global lint gate passes
- `npm run lint` completes without errors or warnings.

## Acceptance Criteria
- [x] `src/editor/markdown.ts` has no `no-case-declarations` violations.
- [x] `src/editor/plugins/syntax-hide.ts` has no `no-unused-vars` violations.
- [x] `src/editor/plugins/wikilinks.ts` has no `no-explicit-any` or `no-unused-vars` violations.
- [x] `src/components/Editor/index.tsx` has no `react-hooks/exhaustive-deps` warning.
- [x] `src/components/GraphView/index.tsx` has no `react-hooks/exhaustive-deps` warning for unstable object construction.
- [x] `npm run lint` passes cleanly.

## Verification Strategy
- Run `npm run lint` after implementation.
- Re-run `npm run -s typecheck` and selected tests for touched components.

## Related
- Depends on: `COMP-TOOLCHAIN-001`
- Used by: CI quality gates
