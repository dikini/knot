# Graph Modes and Local Depth Controls

## Metadata
- ID: `COMP-GRAPH-MODES-002`
- Scope: `component`
- Status: `implemented`
- Parent: `COMP-GRAPH-UI-001`, `COMP-GRAPH-CONSISTENCY-001`
- Concerns: `[CONF, REL, CAP]`
- Created: `2026-02-21`
- Updated: `2026-02-21`

## Purpose
Introduce clear graph-scope modes (`vault` vs `node`) with bounded local depth controls, balancing discoverability and power without introducing heavy UI or uncontrolled graph expansion complexity.

## Contract

### Functional Requirements
**FR-1**: Graph tool in the tool rail opens `vault graph` scope that renders all vault notes and links.

**FR-2**: Content mode toggle switches between `editor` and `node graph`, and entering graph from this toggle defaults to local (`node`) scope centered on the current note.

**FR-3**: `Node graph` scope renders only nodes reachable from the current note within configured depth `N`, where initial default is `N=1`.

**FR-4**: Node-graph depth control must be bounded (`1..3`) and user-adjustable while staying in graph mode.

**FR-5**: If no current note exists while in `node graph`, the graph surface must show a clear empty-state hint instead of falling back to ambiguous behavior.

**FR-6**: Existing graph reliability guarantees remain intact:
- edge-node consistency
- duplicate-label disambiguation
- selected-node highlighting when visible in the active scope

**FR-7**: Graph node click selects node in-place (no immediate mode switch to editor), updates global note selection (explorer + editor target), and graph context panel must display selected node connection data (neighbors/backlinks) when available.

**FR-8**: Content mode toggle remains authoritative for switching between `graph` and `editor` views even when graph tool/context is active.

### Behavior
**Given** vault is open and user enters graph via graph tool  
**When** graph loads  
**Then** scope is `vault` and all vault graph data is shown.

**Given** user is in editor mode  
**When** content mode toggle is activated  
**Then** app switches to graph mode with scope `node`.

**Given** user is in graph mode  
**When** content mode toggle is activated  
**Then** app switches back to editor mode.

**Given** `node graph` scope with center note `C` and depth `1`  
**When** graph is rendered  
**Then** only `C` and immediate neighbors are shown.

**Given** `node graph` scope and depth is increased  
**When** depth becomes `2` or `3`  
**Then** visible subgraph expands by hop distance while respecting the depth cap.

## Design Decisions
| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Add explicit graph scope model (`vault`/`node`) | Mirrors proven UX in similar tools and reduces ambiguity | Adds one more state dimension |
| Use bounded depth instead of free neighbor expansion first | High UX value with lower implementation/UI complexity | Less exploratory freedom than unbounded click-expand |
| Keep depth cap at `3` | Prevents runaway clutter and render load | Power users may want larger neighborhoods |
| Defer per-node manual expansion | Avoids immediate complexity in graph interaction model | Advanced workflows postponed |

## Acceptance Criteria
- [x] Graph tool enters `vault graph` scope by default.
- [x] Content mode toggle enters `node graph` by default and toggles back to editor.
- [x] Node scope depth `1` hides nodes beyond immediate neighbors.
- [x] Increasing depth reveals farther neighbors up to depth `3`.
- [x] Node scope without current note shows explicit empty-state guidance.
- [x] Existing graph consistency/disambiguation tests continue passing.
- [x] Graph node click remains selection-first; editor mode is not auto-entered.
- [x] Graph node selection updates global selected note so editor opens the same note when switched.
- [x] Graph context panel shows selected node neighbors/backlinks when selection exists.
- [x] Content mode toggle can return to editor while graph tool is active.

## Verification Strategy
- Component tests for scope filtering and depth behavior in `GraphView`.
- App tests for mode/scope toggle behavior.
- Full frontend tests and typecheck.

## Related
- Depends on: `COMP-GRAPH-UI-001`, `COMP-GRAPH-CONSISTENCY-001`
- Used by: `src/App.tsx`, `src/components/GraphView/index.tsx`
