# Component Spec: Graph Hover Stability

Spec-ID: COMP-GRAPH-HOVER-001
Change-Type: bug-fix
Status: implemented
Trace: BUG-graph-hover-node-stability
Date: 2026-02-20

## Purpose
Prevent graph nodes from visually jumping/disappearing on hover in graph mode.

## Functional Requirements
- FR-1: Hovering a graph node MUST NOT alter its positioned transform (`translate(x, y)`).
- FR-2: Hover affordance MUST be preserved through non-positional styling (fill/stroke emphasis).
- FR-3: A regression test MUST fail if `.graph-node:hover` directly applies CSS `transform`.

## Acceptance Criteria
- AC-1: No CSS rule applies `transform` in `.graph-node:hover`.
- AC-2: Existing graph hover behavior still highlights connected edges.
- AC-3: Graph tests, typecheck, and lint pass after the fix.
