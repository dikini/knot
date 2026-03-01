# Frontend Typecheck Cleanup 002

## Metadata
- ID: `COMP-TYPECHECK-CLEANUP-002`
- Scope: `component`
- Status: `implemented`
- Parent: `COMP-TOOLCHAIN-001`, `COMP-FRONTEND-001`
- Concerns: [COMP, REL]
- Created: `2026-03-01`
- Updated: `2026-03-01`

## Purpose
Eliminate the current TypeScript typecheck failures in the frontend workspace without changing application behavior or expanding scope beyond the identified regression sites.

## Contract

### Functional Requirements

**FR-1**: Test doubles in `src/App.daemon-smoke.test.tsx` must type mock props passed through React children-compatible surfaces as `ReactNode` rather than `unknown`.

**FR-2**: `src/components/SearchBox/SearchBox.stories.tsx` must narrow nullable DOM query results before invoking `userEvent.click`, avoiding unsafe casts from `null` to `Element`.

**FR-3**: The frontend typecheck gate must pass after the targeted cleanup.

## Acceptance Criteria
- [x] `src/App.daemon-smoke.test.tsx` no longer reports `unknown` to `ReactNode` assignment errors.
- [x] `src/components/SearchBox/SearchBox.stories.tsx` no longer reports nullable-to-`Element` cast errors.
- [x] `npm run typecheck` passes in the worktree after the cleanup.

## Verification Strategy
- Run `npm run typecheck`.
- Run `npm run ui:daemon:smoke` to confirm the touched smoke test still passes at runtime.

## Related
- Depends on: `COMP-TOOLCHAIN-001`
- Used by: frontend CI typecheck gate
