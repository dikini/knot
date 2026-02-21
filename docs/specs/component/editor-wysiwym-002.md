# Editor WYSIWYM and Edit-Flow Stability

## Metadata
- ID: `COMP-EDITOR-WYSIWYM-002`
- Scope: `component`
- Status: `implemented`
- Parent: `COMP-EDITOR-MODES-001`, `COMP-EDITOR-READING-001`
- Concerns: `[CONF, REL, CAP]`
- Created: `2026-02-21`
- Updated: `2026-02-21`

## Purpose
Ensure edit mode remains strictly WYSIWYM (no markdown markers), make floating edit tools visually distinguishable, and stabilize paragraph creation on Enter by preventing editor re-initialization churn during live markdown sync.

## Contract

### Functional Requirements
**FR-1**: Edit mode must not render markdown heading markers (`#`) for active or inactive headings.

**FR-2**: Selection-level formatting toolbar controls must be visually distinguishable and iconography must remain visible in both editor themes.

**FR-3**: Block-level insertion menu must expose distinguishable icon+label actions for available block insertions.

**FR-4**: Pressing Enter in edit mode must create a new paragraph/block without being reverted by editor lifecycle resets.

**FR-5**: Editor instance lifecycle in edit mode must not reinitialize on every content sync tick; it should only recreate on mode/note boundary changes.

### Behavior
**Given** user edits a heading in edit mode
**When** cursor is on the heading line
**Then** semantic heading styling is shown without a literal markdown `#` prefix.

**Given** user opens selection or block edit tools
**When** controls are rendered
**Then** each action is visually recognizable without guesswork.

**Given** user presses Enter in edit mode
**When** paragraph split occurs
**Then** the new paragraph persists and markdown output remains clean.

## Design Decisions
| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Remove active heading prefix injection from syntax-hide node view | Guarantees strict WYSIWYM in edit mode | Loses markdown-marker editing affordance in-place |
| Use icon+label block menu actions | Immediate distinguishability and lower cognitive load | Slightly wider floating menu |
| Decouple editor init lifecycle from reactive markdown content state | Prevents Enter/typing rollback due reinit loops | Requires stricter sync boundaries |

## Acceptance Criteria
- [x] Heading markers are not visible in edit mode.
- [x] Selection toolbar icons are visibly distinct in active themes.
- [x] Block menu shows icon+label action entries.
- [x] Enter creates persistent new paragraphs.
- [x] ProseMirror init is not repeated due content updates alone.

## Verification Strategy
- Editor component tests for lifecycle stability and block-menu iconography.
- Syntax plugin test asserting no heading-prefix node view injection.
- Targeted editor tests + frontend typecheck.
