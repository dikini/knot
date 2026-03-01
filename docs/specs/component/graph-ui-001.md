# Graph Visualization UI

## Metadata
- ID: `COMP-GRAPH-UI-001`
- Scope: `component`
- Status: `implemented`
- Status: `implemented`
- Parent: `COMP-FRONTEND-001`, `COMP-GRAPH-001`
- Concerns: [CAP, REL]
- Created: `2026-02-19`
- Updated: `2026-03-01`

## Purpose
Provide an interactive graph visualization for note links in the frontend, backed by `get_graph_layout` from the Rust graph service.

## Current State
- Backend: `get_graph_layout(width, height)` returns positioned nodes and edges.
- Frontend: `GraphView` exists; parent-view toggle integration and verification were completed in this workstream.

## Contract

### Functional Requirements

**FR-1**: Graph view component
- Render graph with SVG.
- Show nodes as note-title text with a rectangular hit target.
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
- Text-first nodes expose a subtle rectangular background in active/debug states so the hit target remains visible while debugging layout and selection.
- Graph overlays show controls and basic stats.

**FR-6**: Label readability
- Labels MUST remain readable in dense local clusters.
- Labels for nodes near the viewport edge MUST avoid clipping against the graph bounds.
- Full node identity MUST remain available even when crowded labels use compact placement.

**FR-7**: Canonical scale, fit floor, and overflow
- Graph rendering MUST define a canonical `100%` scale based on fixed label text size and pill padding.
- Pill collision handling MUST prioritize non-overlap at canonical scale over forcing all nodes into the visible viewport.
- Initial graph framing MUST auto-fit to the visible viewport only when the required fit zoom is at or above the configured readability floor.
- If a graph cannot fit above the readability floor, the graph surface MAY extend beyond the visible viewport and MUST expose visible overflow cues such as scrollbars.
- Reset MUST recompute framing from the latest persisted readability-floor setting.
- Changing the readability-floor setting MUST NOT mutate the current manual pan/zoom state until the next graph open or reset.

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
| Canonical graph scale with fit floor | Makes readability and collision rules explicit | Some graphs will intentionally overflow the panel |
| Scrollable overflow instead of forced fit | Honest visibility cues when graphs exceed readable fit | Adds scrollbar chrome to graph viewport |

## Acceptance Criteria

- [x] Graph renders with nodes and edges
- [x] Pan and zoom work with bounds and reset
- [x] Click node opens note
- [x] Toggle between Editor/Graph works when vault is open
- [x] View preference persists per vault
- [x] Hover/selection visual states are applied
- [x] Automated tests cover component and parent integration behavior
- [x] Dense label clusters stagger or reposition labels so adjacent node titles remain legible.
- [x] Edge-adjacent node labels avoid clipping beyond the visible graph pane.
- [x] Dense or compact label placement still exposes the full note identity via accessible label text or tooltip metadata.
- [x] Graph nodes render without circular markers and instead use a text-first rectangular hit target.
- [x] Hovered and selected text nodes show a subtle debug-visible background while preserving clickability and label legibility.
- [ ] Graph framing uses a canonical `100%` text/pill scale and a readability floor when choosing initial fit.
- [ ] Pill targets do not overlap in dense layouts at canonical scale, even when that requires graph overflow.
- [ ] Graph viewport exposes overflow cues when content exceeds the visible panel instead of hiding overflow.
- [ ] Updating the readability-floor setting leaves the current manual graph view unchanged and only affects next open/reset framing.

## Related

- Depends on: `COMP-GRAPH-001` (backend layout)
- Used by: `src/App.tsx`
