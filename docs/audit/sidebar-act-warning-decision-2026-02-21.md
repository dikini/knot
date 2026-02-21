# Decision Record: Sidebar `act(...)` Warning (Deferred)

- Date: `2026-02-21`
- Scope: `src/components/Sidebar/index.test.tsx`
- Test: `supports keyboard navigation and folder toggle via arrows`
- Status: `deferred` (known non-blocking warning)

## Context

During reliability cleanup, we removed React `act(...)` warnings from:
- `src/App.test.tsx`
- `src/components/SearchBox/index.test.tsx`
- `src/components/GraphView/index.test.tsx`

One warning remains in Sidebar keyboard navigation test path.

## Decision

Keep the current Sidebar keyboard test implementation unchanged for now and accept one known warning.

## Rationale

1. The current test is behavior-stable and consistently passing.
2. Multiple attempted warning-suppression variants introduced brittleness:
- event-path mismatches (no `setFolderExpanded` call observed)
- async hangs/timeouts around wrapped interaction blocks
3. The warning is test-environment hygiene noise, not a production functional defect.
4. Full suite remains green (`198/198`) with the current approach.

## Risk Assessment

- Functional risk: low
- Test signal risk: low-to-medium (console noise can hide future warning regressions)
- Delivery risk if forced now: medium (high chance of destabilizing a currently reliable keyboard test)

## Revisit Triggers

Re-open this item if any of the following occur:
1. Sidebar keyboard behavior changes.
2. Testing-library/react version changes affecting event/act semantics.
3. Team adopts strict “no warning output” CI gate.
4. Additional Sidebar tests begin showing related async-focus warnings.

## Candidate Future Fix Directions

1. Refactor keyboard interaction test to an explicit user-driven sequence with deterministic focus ownership.
2. Extract and unit-test keyboard navigation logic separately from React focus/event plumbing.
3. Introduce a local helper that standardizes focus + key events under controlled `act` boundaries for tree tests.

## Verification Snapshot at Decision Time

- `npm test`: pass (`198/198`)
- Residual warning count: `1` (this Sidebar test only)
