# Authoring Flows

## Metadata
- ID: `COMP-AUTHORING-FLOWS-001`
- Scope: `component`
- Status: `implemented`
- Parent: `COMP-EXPLORER-TREE-001`, `COMP-EDITOR-MODES-001`, `COMP-EDITOR-WYSIWYM-002`, `COMP-MARKDOWN-ENGINE-001`
- Concerns: `[CONF, REL, COMP]`
- Created: `2026-03-01`
- Updated: `2026-03-01`

## Purpose
Close the remaining note-management and editor-authoring gaps from the canonical issue list so explorer actions and core markdown editing flows behave predictably for day-to-day writing.

## Contract

### Functional Requirements
**FR-1**: Creating a note from a selected explorer folder MUST create the note inside that folder and select the new note after creation.

**FR-2**: Note rename flows MUST support changing only the file basename while preserving the current parent directory.

**FR-3**: Note move flows MUST support changing the parent directory while preserving the basename unless explicitly edited.

**FR-3.1**: Explorer note move flows MUST support dragging a note onto a folder row to move the note into that folder while preserving the basename.

**FR-3.2**: Explorer note move flows MUST support dragging a note onto a note row, resolving the destination to the target note's parent folder.

**FR-3.3**: Dragging a note into its current parent folder MUST be treated as a silent no-op.

**FR-3.4**: Hovering a dragged note over a collapsed folder row MUST auto-expand that folder after a short delay.

**FR-4**: When the active note is renamed or moved, the UI MUST update the current note path and continue editing the resulting note without stale selection state.

**FR-5**: Edit-mode list continuation MUST preserve bullet and ordered list structure when the user presses Enter inside a list item.

**FR-6**: GitHub-flavored markdown task list items MUST round-trip through the editor markdown parser and serializer with checked state preserved.

**FR-7**: Authoring controls MUST provide a way to clear paragraph-level formatting back to a plain paragraph without corrupting surrounding content.

**FR-8**: Undo and redo MUST restore authoring actions introduced by these flows, including list edits and formatting toggles.

### Behavior
**Given** a folder is selected in the explorer  
**When** the user creates a new note  
**Then** the note path is rooted in that folder and the editor loads the created note.

**Given** the user renames or moves the active note  
**When** the operation succeeds  
**Then** the explorer, note list, and editor all reference the new note path.

**Given** the user drags a note onto a folder row  
**When** the drop succeeds  
**Then** the note path is updated to that folder plus the existing basename.

**Given** the user drags a note onto another note row  
**When** the drop succeeds  
**Then** the note moves into the target note's parent folder.

**Given** the user drags a note into its current parent folder  
**When** the drop completes  
**Then** no rename operation is issued and the UI remains unchanged.

**Given** the user hovers a dragged note over a collapsed folder row  
**When** the hover delay elapses without leaving the row  
**Then** the folder expands through the existing explorer expansion path.

**Given** the cursor is inside a bullet, numbered, or task list item  
**When** the user presses Enter  
**Then** the editor creates the next list item of the same list type.

**Given** the user applies heading or list formatting to a paragraph  
**When** the user clears formatting or triggers undo  
**Then** the document returns to the prior plain-paragraph or prior-history state cleanly.

## Design Decisions
| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Reuse `rename_note(old_path, new_path)` as the single note path mutation primitive | Keeps rename-file, rename-note, and move-note behavior consistent across UI entry points | UI prompts need to derive different defaults from the same primitive |
| Use native HTML drag-and-drop for explorer note moves | Keeps implementation local to sidebar tree rendering and avoids dependency cost | Requires explicit hover/drop-state handling for clear feedback |
| Treat task lists as list item state, not a separate top-level block | Aligns with GitHub-flavored markdown and existing ProseMirror list structure | Requires markdown parser/serializer extensions |
| Use ProseMirror commands/history for list continuation and formatting reset | Preserves editor semantics and undo integration | Requires targeted command wiring rather than simple text transforms |

## Concern Mapping
| Concern | Requirement | Implementation Strategy |
| --- | --- | --- |
| CONF | FR-1, FR-4, FR-5, FR-7 | Keep explorer selection, note selection, and editor behavior deterministic after mutations |
| REL | FR-2, FR-3, FR-3.1, FR-3.2, FR-3.3, FR-3.4, FR-4, FR-8 | Centralize note path mutations, refresh state after writes, and verify undo coverage with tests |
| COMP | FR-6 | Extend markdown parsing/serialization without regressing existing list markdown round-trips |

## Acceptance Criteria
- [ ] Creating a note from a folder creates the note in that folder and opens it.
- [ ] Renaming only the note basename preserves its directory.
- [ ] Moving a note updates explorer selection and the active editor note path.
- [ ] Dragging a note onto a folder row moves it into that folder.
- [ ] Dragging a note onto a note row moves it into the target note's parent folder.
- [ ] Dragging a note into its current parent folder is a no-op.
- [ ] Hovering a dragged note over a collapsed folder auto-expands it after a short delay.
- [ ] Enter inside bullet and ordered lists creates another list item of the same type.
- [ ] Task list markdown parses and serializes with checked state intact.
- [ ] Clear formatting resets block formatting to a plain paragraph.
- [ ] Undo and redo cover the new authoring commands and list edits.

## Verification Strategy
- Sidebar and store tests for note creation, prompt move, drag-drop move, delayed folder auto-expand, and active note synchronization.
- Editor keymap and markdown round-trip tests for list continuation and task list support.
- Focused editor command tests for clear formatting and undo/redo behavior.

## Related
- Depends on: `COMP-EXPLORER-TREE-001`, `COMP-EDITOR-WYSIWYM-002`, `COMP-MARKDOWN-ENGINE-001`
- Used by: `knot/issues.md`
