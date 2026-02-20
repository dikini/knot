# Graph Visualization UI

## Metadata
- ID: `COMP-GRAPH-UI-001`
- Scope: `component`
- Status: `implemented`
- Parent: `COMP-FRONTEND-001`, `COMP-GRAPH-001`
- Concerns: [CAP, REL]
- Created: `2026-02-19`
- Updated: `2026-02-19`

## Purpose
Provide an interactive graph visualization for note links in the frontend, backed by `get_graph_layout` from the Rust graph service.

## Current State
- Backend: `get_graph_layout(width, height)` returns positioned nodes and edges.
- Frontend: `GraphView` exists; parent-view toggle integration and verification were completed in this workstream.

## Contract

### Functional Requirements

**FR-1**: Graph view component
- Render graph with SVG.
- Show nodes as circles and labels.
- Show edges as lines between linked notes.
- Handle loading, error, and empty states.

**FR-2**: Interactive navigation
- Pan via drag on graph background.
- Zoom via mouse wheel, bounded.
- Click node to open that note.
- Hover node to visually highlight connected edges.

**FR-3**: Layout from backend
- Call `get_graph_layout(width, height)` when graph view mounts and when dimensions change.
- Render with backend-provided coordinates.
- Keep graph viewport bounded via zoom/pan limits and reset control.

**FR-4**: Toggle between views
- Parent UI provides Editor/Graph toggle.
- Toggle is shown only when a vault is open.
- Selected view is persisted per vault in local storage.
- Selecting a graph node loads that note and switches to editor view.

**FR-5**: Visual styling
- Selected node has distinct visual style.
- Hovered node and connected edges have distinct visual style.
- Graph overlays show controls and basic stats.

### Interface (TypeScript)

```typescript
interface GraphViewProps {
  onNodeClick: (path: string) => void;
  width: number;
  height: number;
}

interface GraphNode {
  id: string;      // note path
  label: string;   // note title
  x: number;
  y: number;
}

interface GraphEdge {
  source: string;
  target: string;
}

type MainViewMode = "editor" | "graph";
```

### Behavior

**Given** user clicks "Graph View" while a vault is open
**When** component mounts
**Then** fetches layout, renders graph

**Given** graph rendered
**When** user clicks node
**Then** opens that note in editor

**Given** graph rendered
**When** user drags background or scrolls
**Then** pans/zooms within bounded limits

## Design Decisions

| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
| SVG over Canvas | Easier interactivity, styling | Slower for many nodes |
| Backend-computed layout | Keeps frontend simple and deterministic | Less dynamic client-side layout |
| Parent-level view toggle | Keeps GraphView focused on rendering/interactions | Adds App-level state coordination |
| Per-vault toggle persistence | Better UX across vault switches | Local storage key management |

## Acceptance Criteria

- [x] Graph renders with nodes and edges
- [x] Pan and zoom work with bounds and reset
- [x] Click node opens note
- [x] Toggle between Editor/Graph works when vault is open
- [x] View preference persists per vault
- [x] Hover/selection visual states are applied
- [x] Automated tests cover component and parent integration behavior

## Related

- Depends on: `COMP-GRAPH-001` (backend layout)
- Used by: `src/App.tsx`
