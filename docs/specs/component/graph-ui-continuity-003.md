# Graph UI Continuity and Toggle Semantics

## Metadata
- ID: `COMP-GRAPH-UI-CONTINUITY-003`
- Scope: `component`
- Status: `implemented`
- Parent: `COMP-GRAPH-MODES-002`, `COMP-ICON-CHROME-001`
- Concerns: `[CONF, REL, CAP]`
- Created: `2026-02-21`
- Updated: `2026-02-21`

## Purpose
Unify graph and note-pane interaction semantics so controls consistently show the next mode/action, and graph relationship lists behave like note selection surfaces without introducing folder/explorer complexity.

## Contract

### Functional Requirements
**FR-1**: The content mode toggle icon in note pane must show the icon of the next mode:
- editor mode: show graph icon
- graph mode: show edit-note icon

**FR-2**: Graph controls must expose vault/node scope as a single toggle tool:
- one visual tool
- shows the icon/label of the next scope mode
- placed adjacent to Reset and Editor controls

**FR-3**: Graph context panel neighbor and backlink rows must be selectable and load/select notes using the same interaction pattern as search/note selection surfaces.

**FR-4**: Neighbor/backlink rows should preserve visual continuity with note list rows (button-like row styling) while excluding directory/folder affordances.

**FR-5**: Selecting neighbor/backlink rows must keep the user in graph mode (no forced editor switch).

### Behavior
**Given** user is in editor mode
**When** they view the mode toggle
**Then** the toggle presents graph as the next action.

**Given** user is in graph mode
**When** they view the mode toggle
**Then** the toggle presents editor as the next action.

**Given** graph scope is `vault`
**When** user views graph controls
**Then** the scope toggle presents `node` scope as the next action.

**Given** graph scope is `node`
**When** user views graph controls
**Then** the scope toggle presents `vault` scope as the next action.

**Given** a graph selection exists with neighbors/backlinks
**When** user clicks an item
**Then** the selected note loads and graph view remains active.

## Design Decisions
| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Use next-action icons for toggles | Faster affordance scanning; consistent with requested UX | Slightly less explicit than static mode icon |
| Keep relationship lists flat (no tree/folder UI) | Matches current scope and avoids feature creep | Less structural context than hierarchical view |
| Reuse note-row styling cues | Visual continuity with existing note/search interactions | Requires CSS coordination across surfaces |

## Acceptance Criteria
- [x] Mode toggle icon reflects next mode in editor/graph.
- [x] Graph scope uses one toggle tool showing next mode.
- [x] Scope toggle appears beside Reset and Editor controls.
- [x] Neighbor and backlink rows are clickable/selectable controls.
- [x] Relationship rows visually align with note-list interaction style, without folder UI.
- [x] Clicking relationship rows keeps graph mode active.

## Verification Strategy
- App tests for mode-toggle icon and graph-stay behavior.
- Graph context panel tests for single scope toggle semantics and selectable relationship rows.
- Frontend typecheck and targeted test pass.
