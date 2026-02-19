# Graph Visualization UI

## Metadata
- ID: `COMP-GRAPH-UI-001`
- Scope: `component`
- Status: `draft`
- Parent: `COMP-FRONTEND-001`, `COMP-GRAPH-001`
- Concerns: [CAP]
- Created: `2026-02-19`

## Purpose
Visualize the note link graph in the frontend. Backend provides layout data; this adds the visualization interface.

## Current State
- Backend: `get_graph_layout` command returns node positions
- Frontend: No graph visualization

## Contract

### Functional Requirements

**FR-1**: Graph view component
- Canvas-based (SVG or Canvas API)
- Shows nodes (notes) as circles
- Shows edges (links) as lines
- Nodes labeled with note titles

**FR-2**: Interactive navigation
- Pan: Click and drag to move view
- Zoom: Scroll wheel or buttons
- Click node to open note
- Hover node to highlight connected edges

**FR-3**: Layout from backend
- Call `get_graph_layout(width, height)` on mount
- Render nodes at provided positions
- Scale to fit container

**FR-4**: Toggle between views
- Button to switch between Editor and Graph
- Remember preference per vault?

**FR-5**: Visual styling
- Nodes: circles, colored by type (existence?)
- Edges: lines, arrows for direction
- Selected/hovered state highlighting

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
```

### Behavior

**Given** user clicks "Graph View"
**When** component mounts
**Then** fetches layout, renders graph

**Given** graph rendered
**When** user clicks node
**Then** opens that note in editor

**Given** graph rendered
**When** user drags background
**Then** pans the view

## Design Decisions

| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
| SVG over Canvas | Easier interactivity, styling | Slower for many nodes |
| Static layout from backend | Physics already calculated | No real-time adjustment |
| Click to open note | Natural navigation | Single click vs double click? |

## Acceptance Criteria

- [ ] Graph renders with nodes and edges
- [ ] Pan and zoom work
- [ ] Click node opens note
- [ ] Toggle between Editor/Graph
- [ ] Styled appropriately

## Related

- Depends on: `COMP-GRAPH-001` (backend layout)
- Used by: Frontend main view
