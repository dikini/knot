# Tool Rail and Context Panel Interaction Policy

## Metadata
- ID: `COMP-TOOL-RAIL-CONTEXT-001`
- Scope: `component`
- Status: `implemented`
- Concerns: `[CONF, REL, CAP]`
- Created: `2026-02-21`
- Updated: `2026-02-21`

## Purpose
Define deterministic interaction rules for the left tool rail and context panel so current behavior is consistent and future tools can choose panel behavior by policy rather than ad hoc decisions.

## Contract

### Functional Requirements
**FR-1**: Tool rail width must be reduced from current baseline and remain optimized for icon-first scanning.

**FR-2**: Context panel supports exactly two visual states:
- `folded`: fully invisible, no handle, no placeholder width
- `unfolded`: visible and rendering active tool content

**FR-3**: Context panel must not render an in-panel fold/unfold button.

**FR-4**: Clicking the active tool toggles context panel visibility while keeping the same active tool and content selection.

**FR-5**: Clicking an inactive tool must switch active tool and update context panel content selection.

**FR-6**: Tool activation behavior for panel visibility must follow a policy class:
- `panel-required`: force panel visible on activation
- `panel-optional`: restore tool-local last visibility state on activation
- `panel-independent`: keep current panel visibility unchanged on activation

**FR-7**: Current tool mapping must be:
- `notes` -> `panel-required`
- `search` -> `panel-required`
- `graph` -> `panel-optional`

**FR-8**: The tool rail vertical border must visually continue to the bottom of the viewport, independent of context panel content height.

### Behavior
**Given** context panel is folded and user clicks `notes` or `search`  
**When** tool activates  
**Then** active tool changes and context panel unfolds with that tool's content.

**Given** context panel is folded and user clicks `graph`  
**When** tool activates  
**Then** active tool changes and graph panel visibility restores to previous graph visibility state (default `unfolded` on first activation).

**Given** any tool is active  
**When** user clicks that same tool again  
**Then** context panel toggles folded/unfolded while retaining active tool and panel content state.

## Design Decisions
| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Hybrid activation policy (required vs optional vs independent) | Keeps Notes/Search task-ready while allowing graph canvas-first usage | Slightly more complex than one global rule |
| Remove panel collapse button | Single control surface (active tool) avoids redundant chrome | Reduces explicit affordance discoverability |
| Folded means zero trace | Maximum focus and spatial stability in content mode | Re-opening depends on users understanding tool re-click |
| Persist optional-tool visibility per tool | Avoids forcing panel reopen for tools that are not panel-centric | Adds small state bookkeeping |

## Policy for Future Tools
When adding a new tool, assign exactly one policy class and justify it in spec/design notes:

| Class | Use When | Activation Rule | Examples |
| --- | --- | --- | --- |
| `panel-required` | Primary value is in panel interaction/navigation | Activate tool + force panel unfolded | Notes tree, Search filters/results |
| `panel-optional` | Panel helps but main value can be in content canvas | Activate tool + restore tool-local panel visibility | Graph controls/context |
| `panel-independent` | Tool does not rely on context panel | Activate tool + leave panel visibility unchanged | Future command-palette-only mode |

Default rule for unknown/new tools: `panel-required` until explicitly classified.

## Acceptance Criteria
- [x] Active-tool re-click toggles panel and does not change tool mode.
- [x] Inactive click on `notes`/`search` always unfolds panel.
- [x] Inactive click on `graph` restores graph-local panel visibility state.
- [x] Context panel has no fold/unfold control button.
- [x] Folded panel occupies zero horizontal space and has no visible artifact.
- [x] Tool rail border visually spans full viewport height.
- [x] Tool onboarding checklist includes required policy classification.

## Verification Strategy
- Component tests for tool click state transitions.
- App tests for per-tool visibility restoration behavior.
- Visual regression/manual checks for folded zero-trace state and full-height rail border.
