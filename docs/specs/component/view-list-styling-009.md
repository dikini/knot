# View List Styling

Change-Type: bug-fix
Trace: BUG-view-mode-list-styling-009

## Metadata
- ID: `COMP-VIEW-LIST-STYLING-009`
- Scope: `component`
- Status: `implemented`
- Concerns: `[CONF, REL, COMP]`
- Created: `2026-03-01`
- Updated: `2026-03-01`

## Purpose
Normalize view-mode list presentation so bullet, ordered, and task lists render with stable spacing and indentation instead of inheriting inconsistent browser defaults.

## Contract

### Functional Requirements
**FR-1**: View mode shall apply explicit spacing and indentation rules to unordered and ordered lists.

**FR-2**: View mode shall render task list containers with a task-list-specific class so checkbox layout does not depend on negative margin hacks against browser list defaults.

**FR-3**: View mode shall collapse paragraph margins inside list items so list rhythm matches the editor and does not create oversized gaps between entries.

### Behavior
**Given** a note rendered in view mode with bullet or ordered lists
**When** the note is displayed
**Then** list items use consistent indentation and compact vertical spacing.

**Given** a note rendered in view mode with GitHub-style task lists
**When** the note is displayed
**Then** the checkbox aligns with its content and no extra marker gutter or oversized paragraph gaps appear.

## Design Decisions
| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
| Add a `task-list` class to parent lists during render rewrite | Gives CSS a deterministic hook for view-mode task lists | Slightly more DOM post-processing |
| Fix styling in `Editor.css` instead of changing markdown serialization | Keeps markdown semantics stable and limits scope to presentation | CSS carries more responsibility |
| Leave edit-mode list layout untouched | The regression is specific to view mode | View and edit styles remain separately maintained |

## Concern Mapping
| Concern | Requirement | Implementation Strategy |
|---------|-------------|-------------------------|
| CONF | FR-1, FR-3 | Explicit list spacing rules in view mode |
| REL | FR-2 | Deterministic class-based task list layout instead of browser-default coupling |
| COMP | FR-2 | Preserve existing semantic HTML and markdown round-trip behavior |

## Acceptance Criteria
- [ ] View rendering marks task-list parent containers with a dedicated class.
- [ ] View-mode list CSS defines spacing for `ul`, `ol`, `li`, and nested list-item paragraphs.
- [ ] Existing task-list render tests pass with the new structure.

## Verification Strategy
- Render tests for task-list container markup.
- Targeted frontend tests for view-mode rendering.
- `npm run typecheck`
- `npm run -s qa:docsync -- --against=HEAD`
