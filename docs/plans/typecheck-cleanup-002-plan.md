# Implementation Plan: Frontend Typecheck Cleanup 002

Change-Type: bug-fix
Trace: BUG-typecheck-cleanup-002

## Metadata
- Spec: `docs/specs/component/typecheck-cleanup-002.md`
- Generated: `2026-03-01`
- Approach: `sequential`

## Summary
- Total tasks: `3`
- Sizes: `3 small`
- Critical path: `TC-001 -> TC-002 -> TC-003`

## Tasks

### Phase 1: Targeted Typecheck Fixes
| ID | Task | Size | Depends | Spec Ref |
|---|---|---|---|---|
| TC-001 | Type daemon smoke test mock props as `ReactNode`-compatible values | S | - | FR-1 |
| TC-002 | Replace nullable SearchBox story DOM cast with explicit narrowing | S | TC-001 | FR-2 |

### Phase 2: Verification
| ID | Task | Size | Depends | Spec Ref |
|---|---|---|---|---|
| TC-003 | Run focused verification and publish audit report | S | TC-002 | FR-3 |

## TDD Notes
- `TC-001` red state: `npm run typecheck` reports `unknown` to `ReactNode` assignment errors in `src/App.daemon-smoke.test.tsx`.
- `TC-001` green state: the mock prop typings compile and `npm run ui:daemon:smoke` still passes.
- `TC-002` red state: `npm run typecheck` reports the nullable `Element` cast error in `src/components/SearchBox/SearchBox.stories.tsx`.
- `TC-002` green state: the story uses explicit narrowing and `npm run typecheck` passes.

## Verification Commands
```bash
npm run typecheck
npm run ui:daemon:smoke
```
