# Implementation Plan: Markdown Engine Upgrade and Reference Links

Change-Type: design-update
Trace: DESIGN-markdown-engine-upgrade-001
Spec: `docs/specs/component/markdown-engine-001.md`
Generated: `2026-02-22`

## Summary
- Total tasks: 8
- Approach: sequential with bounded parallel test authoring
- Size: 3 small, 5 medium
- Goal: migrate markdown engine to `prosemirror-markdown` + `markdown-it` with behavior parity and reference-link support.

## Tasks

| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| MDE-001 | Add migration-safe markdown adapter interface with legacy/new implementations | M | - | FR-1, FR-7 |
| MDE-002 | Build golden fixture harness for existing syntax parity (legacy vs new) | M | MDE-001 | FR-2, FR-8 |
| MDE-003 | Implement `prosemirror-markdown` parser/serializer baseline mappings for existing syntax | M | MDE-001, MDE-002 | FR-1, FR-2 |
| MDE-004 | Re-implement wikilink token handling in new pipeline and parity fixtures | M | MDE-003 | FR-3 |
| MDE-005 | Add reference-link parsing + serialization (full/collapsed/shortcut + title) | M | MDE-003 | FR-4, FR-5 |
| MDE-006 | Wire view renderer to resolve reference links through migrated pipeline | S | MDE-005 | FR-6 |
| MDE-007 | Add feature flag/config switch and fallback routing to legacy parser | S | MDE-003, MDE-004, MDE-005 | FR-7 |
| MDE-008 | Expand editor/markdown verification suite and publish migration audit report | S | MDE-006, MDE-007 | FR-8 |

## Dependency DAG
```text
MDE-001 -> MDE-002 -> MDE-003 -> MDE-004 -> MDE-007 -> MDE-008
                          \-> MDE-005 -> MDE-006 -/
```

## Concern Coverage
| Concern | Tasks | Verification |
| --- | --- | --- |
| REL | MDE-001, MDE-007, MDE-008 | Fallback routing, migration audit, regression tests |
| COMP | MDE-002, MDE-003, MDE-004 | Legacy/new parity fixtures for existing syntax |
| CAP | MDE-001, MDE-008 | Adapter boundary and bounded validation scope |
| CONF | MDE-006, MDE-008 | Source/edit/view rendering consistency checks |

## Verification Commands
```bash
npm test -- --run src/editor/markdown.test.ts src/components/Editor/index.test.tsx
npm run -s typecheck
```

## Exit Criteria
- New parser path reaches parity on current syntax fixtures.
- Reference-link fixtures pass end-to-end.
- Feature flag fallback validated.
- Spec can be moved from `draft` to `implemented` after bk-tdd + bk-implement + bk-verify.

## Execution Complete
- Status: Completed on `2026-02-22`
- Tasks: `MDE-001..MDE-008` marked complete in `docs/plans/markdown-engine-001-tasks.yaml`
- Verification: `docs/audit/markdown-engine-001-verification-2026-02-22.md`
- Final state:
    - Spec status set to `implemented`
    - Spec map entry set to `implemented (verified 100%)`
    - Roadmap workstream status set to `implemented`
