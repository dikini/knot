# Compliance Fixes for Frontend State and Tests

## Metadata
- ID: `COMP-COMPLIANCE-001`
- Scope: `component`
- Status: `implemented`
- Parent: `COMP-FRONTEND-001`, `COMP-GRAPH-UI-001`, `COMP-SEARCH-UI-001`
- Concerns: [REL, COMP]
- Created: `2026-02-20`
- Updated: `2026-02-20`

## Purpose
Define targeted fixes required to keep frontend behavior stable across vault switches and to enforce strict TypeScript discipline in test code.

## Contract

### Functional Requirements

**FR-1**: Vault-scoped view mode must hydrate before persistence write
- On vault change, stored view mode for the new vault must be loaded before writing any value for that vault key.
- The implementation must not write a stale mode from the previous vault into the new vault key.

**FR-2**: Graph/editor mode remains deterministic after vault switch
- When switching from one open vault to another, active view mode must resolve from the target vault's stored preference.
- Resulting mode must remain consistent with persisted preference.

**FR-3**: SearchBox tests must avoid explicit `any`
- Test asynchronous mocks must use concrete result types.
- No `any` casts in newly changed SearchBox tests.

**FR-4**: SearchBox keyboard handler must remain callback-safe
- Keyboard handler callback dependencies must include selection callback dependency chain so updates to parent callback cannot stale the handler.

## Design Decisions

| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
| Track hydrated vault path before writing view mode | Prevent stale writes during vault transition effect cycle | Adds one small piece of state |
| Validate with regression test on vault switch | Catch write-order regressions explicitly | Slightly more complex App test setup |
| Replace `any` with `SearchResult[]` in tests | Enforce strict TS discipline and clearer intent | Requires additional type import |
| Include `handleSelect` in keyboard callback deps | Keep callback closure fresh when parent callback changes | More frequent callback recreation |

## Concern Mapping

| Concern | Requirement | Implementation Strategy |
|---------|-------------|------------------------|
| REL | FR-1, FR-2 | Deterministic hydration/write ordering + regression test |
| COMP | FR-3, FR-4 | Lint-clean TypeScript and explicit hook dependency correctness |

## Acceptance Criteria
- [x] App test verifies vault switch does not write stale mode to target vault key.
- [x] App test verifies view resolves to target vault preference after switch.
- [x] SearchBox test file contains no explicit `any` in modified sections.
- [x] SearchBox hook dependency warning for keyboard handler is removed.
- [x] `npm run typecheck` passes.
- [x] `npm test -- --run src/App.test.tsx src/components/SearchBox/index.test.tsx` passes.

## Verification Strategy
- Add regression test for vault preference hydration/write ordering.
- Run TypeScript checks and targeted frontend test files.
- Run lint scoped to touched files.

## Related
- Depends on: `COMP-GRAPH-UI-001`, `COMP-SEARCH-UI-001`
- Used by: frontend app shell and search UI tests
