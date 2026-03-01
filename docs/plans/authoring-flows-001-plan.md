# Implementation Plan: Authoring Flows

Change-Type: design-update
Trace: DESIGN-authoring-flows-001

## Metadata
- Spec: `docs/specs/component/authoring-flows-001.md`
- Generated: `2026-03-01`
- Approach: `sequential`

## Summary
- Total tasks: `5`
- Size: `2 small, 3 medium`
- Critical path: `AF-001 -> AF-002 -> AF-003 -> AF-004 -> AF-005`

## Tasks

### Phase 1: Explorer Note Operations
| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| AF-001 | Add failing tests for folder-scoped note creation and active-note path reconciliation | S | - | FR-1, FR-4 |
| AF-002 | Implement sidebar/store note creation plus unified rename/move note flows | M | AF-001 | FR-1, FR-2, FR-3, FR-4 |

### Phase 2: Editor List and Formatting Commands
| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| AF-003 | Add failing editor tests for list continuation, task list markdown, and undo coverage | M | AF-002 | FR-5, FR-6, FR-8 |
| AF-004 | Implement task list parsing/serialization and list continuation commands with history support | M | AF-003 | FR-5, FR-6, FR-8 |
| AF-005 | Add clear-formatting tests and implement paragraph reset command wiring | S | AF-004 | FR-7, FR-8 |

## Dependency DAG
`AF-001 -> AF-002 -> AF-003 -> AF-004 -> AF-005`

## Concern Coverage
| Concern | Tasks | Verification |
| --- | --- | --- |
| CONF | AF-001, AF-002, AF-005 | Sidebar/editor unit tests for deterministic post-action state |
| REL | AF-001, AF-002, AF-003, AF-004, AF-005 | Regression tests for active note sync and undo/redo |
| COMP | AF-003, AF-004 | Markdown round-trip tests for task list syntax |
