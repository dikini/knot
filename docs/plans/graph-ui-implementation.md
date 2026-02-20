# Implementation Plan: Graph Visualization UI

> Superseded by `docs/plans/graph-ui-001-plan.md` and `docs/plans/graph-ui-001-tasks.yaml`.

## Metadata

- Spec: `docs/specs/component/graph-ui-001.md`
- Generated: 2026-02-19
- Approach: sequential
- Worktree: `.worktrees/graph-ui`

## Summary

- Total tasks: 6
- Size: 2 small, 3 medium, 1 large
- Critical path: All tasks (sequential)

## Tasks

### Phase 1: Foundation

| ID     | Task                                | Size | Depends | Spec Ref |
| ------ | ----------------------------------- | ---- | ------- | -------- |
| GU-001 | Define TypeScript interfaces        | S    | -       | FR-1     |
| GU-002 | Create GraphView component scaffold | M    | GU-001  | FR-1     |

### Phase 2: Core Features

| ID     | Task                          | Size | Depends | Spec Ref   | Concerns |
| ------ | ----------------------------- | ---- | ------- | ---------- | -------- |
| GU-003 | Implement SVG rendering logic | M    | GU-002  | FR-1, FR-3 | CAP      |
| GU-004 | Add pan and zoom interaction  | M    | GU-003  | FR-2       | REL      |
| GU-005 | Add click and hover handling  | M    | GU-004  | FR-2       | OBS      |

### Phase 3: Integration

| ID     | Task                          | Size | Depends | Spec Ref   |
| ------ | ----------------------------- | ---- | ------- | ---------- |
| GU-006 | Add view toggle and integrate | L    | GU-005  | FR-4, FR-5 |

## Dependency DAG

```
GU-001 → GU-002 → GU-003 → GU-004 → GU-005 → GU-006
```

## Concern Coverage

| Concern | Tasks  | Verification                            |
| ------- | ------ | --------------------------------------- |
| REL-001 | GU-004 | Test: Pan and zoom bounded to container |
| CAP-001 | GU-003 | Test: Graph scales to fit container     |
| OBS-001 | GU-005 | Test: Hover events logged               |

## Task Details

### GU-001: Define TypeScript interfaces

**Spec Ref:** FR-1
**Acceptance:** Interfaces compile, exported from module
**Implementation:**

```typescript
// src/types/graph.ts
export interface GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface GraphViewProps {
  onNodeClick: (path: string) => void;
  width: number;
  height: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
```

### GU-002: Create GraphView component scaffold

**Spec Ref:** FR-1
**Acceptance:** Component renders without errors
**Implementation:**

- Location: `src/components/GraphView/`
- Files: `index.tsx`, `GraphView.css`
- Component structure with SVG container
- Props interface from GU-001

### GU-003: Implement SVG rendering logic

**Spec Ref:** FR-1, FR-3
**Acceptance:** Nodes and edges render from backend data
**Implementation:**

- Call `get_graph_layout(width, height)` Tauri command on mount
- Render `<svg>` element
- Map nodes to `<circle>` elements with labels
- Map edges to `<line>` elements
- Scale node positions to fit container
- Apply initial transformation

### GU-004: Add pan and zoom interaction

**Spec Ref:** FR-2
**Acceptance:** Pan and zoom work smoothly
**Implementation:**

- State for transform (scale, translateX, translateY)
- Mouse/touch event handlers:
  - `onMouseDown`, `onMouseMove`, `onMouseUp` for pan
  - `onWheel` for zoom
- Apply transform to SVG group element
- Clamp zoom level (e.g., 0.1x to 5x)
- Bound pan to prevent losing graph

### GU-005: Add click and hover handling

**Spec Ref:** FR-2
**Acceptance:** Click opens note, hover highlights connections
**Implementation:**

- State for hovered node
- `onClick` handler on node circles → call `onNodeClick(path)`
- `onMouseEnter`/`onMouseLeave` on nodes → set hovered state
- Highlight connected edges when node hovered
- Style changes for selected/hovered state

### GU-006: Add view toggle and integrate

**Spec Ref:** FR-4, FR-5
**Acceptance:** Toggle switches between Editor and Graph views
**Implementation:**

- Add toggle button to main layout
- State for current view: 'editor' | 'graph'
- Conditionally render Editor or GraphView
- Style nodes with appropriate colors
- Add arrow markers for directed edges
- Persist view preference to localStorage

## Test Coverage Plan

| Functional Requirement    | Test ID | Test Function                                |
| ------------------------- | ------- | -------------------------------------------- |
| FR-1: Graph renders       | GU-003  | `test_graph_renders_nodes_and_edges`         |
| FR-2: Pan and zoom        | GU-004  | `test_pan_and_zoom_work`                     |
| FR-2: Click and hover     | GU-005  | `test_click_opens_note_and_hover_highlights` |
| FR-3: Layout from backend | GU-003  | `test_fetches_and_renders_layout`            |
| FR-4: View toggle         | GU-006  | `test_toggle_between_editor_and_graph`       |
| FR-5: Visual styling      | GU-006  | `test_nodes_and_edges_styled_correctly`      |

## Success Criteria

- [ ] All types defined and exported
- [ ] GraphView component renders
- [ ] Backend layout fetched and rendered
- [ ] Pan and zoom work smoothly
- [ ] Click opens note, hover highlights
- [ ] View toggle switches views
- [ ] Styling applied correctly
- [ ] Tests pass
- [ ] No TypeScript errors

## Verification

```bash
npm run typecheck
npm run tauri dev
```

Test:

1. Click Graph View → graph renders
2. Drag background → pans view
3. Scroll wheel → zooms
4. Click node → opens note
5. Hover node → highlights connections
6. Toggle button → switches views

## Next Steps

- **bk-tdd**: Execute tasks GU-001 through GU-006
- **bk-implement-typescript**: Execute all tasks
- **bk-verify**: Generate compliance report
