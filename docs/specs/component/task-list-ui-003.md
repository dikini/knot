# Task List Checkbox UI

## Metadata
- ID: `COMP-TASK-LIST-UI-003`
- Scope: `component`
- Status: `implemented`
- Parent: `COMP-EDITOR-MODES-001`, `COMP-MARKDOWN-ENGINE-001`
- Concerns: `[CONF, REL, COMP]`
- Created: `2026-03-01`
- Updated: `2026-03-01`

## Purpose
Render markdown task lists as checkbox UI in both view and edit modes without breaking ProseMirror history semantics or markdown round-tripping.

## Contract

### Functional Requirements
**TL-001**: View mode must render markdown task list items (`- [ ]`, `- [x]`) as checkbox UI while preserving note navigation behavior and markdown fidelity.

**TL-002**: Edit mode must render task list items as checkbox UI and toggle checked state only through ProseMirror transactions so history, selection, and change notifications remain correct.

**TL-003**: Task-list interactions must preserve undo/redo behavior and markdown persistence so checked state serializes back to the original markdown task marker form.

### Behavior
**Given** a note containing markdown task list items
**When** the note is opened in view mode
**Then** each task item is shown with a checkbox affordance instead of plain bullet text.

**Given** a task list item in edit mode
**When** the user toggles its checkbox
**Then** the editor updates the `checked` attribute via an editor transaction and emits markdown with the corresponding `- [ ]` or `- [x]` marker.

**Given** a task toggle was made in edit mode
**When** the user performs undo or redo
**Then** the checkbox state and serialized markdown move with history correctly.

## Design Decisions
| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Keep `list_item.task/checked` as the single source of truth | Markdown parsing and serialization already support task-list attrs | Requires DOM-layer work instead of schema redesign |
| Use targeted DOM rendering plus a dedicated editor interaction plugin | Safest change surface for ProseMirror behavior | Adds a focused plugin to maintain |
| Toggle with `setNodeMarkup` on the list item node | Preserves history and editor transaction semantics | Requires careful position resolution from DOM events |

## Acceptance Criteria
- [x] View mode renders task list items as checkbox UI.
- [x] Edit mode renders task list items as checkbox UI and toggles through ProseMirror transactions.
- [x] Undo/redo restores checkbox state correctly after toggles.
- [x] Serialized markdown preserves `- [ ]` and `- [x]` task markers after toggles.

## Verification Strategy
- Renderer tests for checkbox HTML output in view mode.
- Editor plugin tests for transaction-based checkbox toggling and history behavior.
- Editor component tests for edit/view mode checkbox UI wiring.
- Targeted Vitest runs plus `npm run typecheck`.
