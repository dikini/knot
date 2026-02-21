# Implementation Plan: Graph Modes and Local Depth Controls

Change-Type: hybrid
Trace: DESIGN-graph-modes-local-depth
Spec: `docs/specs/component/graph-modes-002.md`
Generated: `2026-02-21`

## Summary
- Total tasks: 6
- Approach: sequential
- Size: 4 small, 2 medium
- Goal: add vault/node graph scopes with bounded node-depth control and preserve existing graph reliability behavior.

## Tasks

| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| GM-001 | Add failing `GraphView` tests for node-scope filtering by depth (`1..3`) and no-center empty-state | M | - | FR-3, FR-4, FR-5 |
| GM-002 | Add failing app-shell tests for mode/scope cycling behavior via content mode toggle | S | GM-001 | FR-1, FR-2 |
| GM-003 | Extend `GraphView` props and visible-graph computation to support `vault` vs `node` scopes with bounded depth | M | GM-002 | FR-3, FR-4, FR-6 |
| GM-004 | Wire app state for graph scope/depth and update content mode toggle behavior | S | GM-003 | FR-1, FR-2, FR-4 |
| GM-005 | Add lightweight graph-scope/depth controls in graph context panel | S | GM-004 | FR-2, FR-4 |
| GM-006 | Verify tests, typecheck, lint, and publish audit report | S | GM-005 | FR-1..FR-6 |

## Dependency DAG
```text
GM-001 -> GM-002 -> GM-003 -> GM-004 -> GM-005 -> GM-006
```

## Concern Coverage
| Concern | Tasks | Verification |
| --- | --- | --- |
| CONF | GM-002, GM-004, GM-005 | App + component behavior tests |
| REL | GM-001, GM-003, GM-006 | Graph filtering correctness and regression coverage |
| CAP | GM-003, GM-005, GM-006 | Depth cap and bounded local graph render |

## Verification Commands
```bash
npm test -- --run src/components/GraphView/index.test.tsx src/App.test.tsx
npm run -s typecheck
npx eslint src/App.tsx src/App.test.tsx src/components/GraphView/index.tsx src/components/GraphView/index.test.tsx src/components/GraphView/GraphContextPanel.tsx
```
