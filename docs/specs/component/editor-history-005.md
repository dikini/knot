# Editor History Controls

## Metadata
- ID: `COMP-EDITOR-HISTORY-005`
- Scope: `component`
- Status: `implemented`
- Parent: `COMP-EDITOR-MODES-001`
- Concerns: `[CONF, REL]`
- Created: `2026-03-01`
- Updated: `2026-03-01`

## Purpose
Restore deterministic undo/redo behavior in edit mode and expose the same history actions in the top editor toolbar so keyboard shortcuts and toolbar buttons stay aligned.

## Contract

### Functional Requirements
**EH-001**: Edit mode MUST expose shared ProseMirror history command helpers for undo and redo so all editor history triggers invoke the same command path.

**EH-002**: Edit mode MUST route standard undo/redo keyboard shortcuts through the shared history helpers and suppress browser-default behavior when the editor handles them.

**EH-003**: The top editor toolbar MUST render `Undo` and `Redo` controls immediately to the left of the `Source | Edit | View` mode switcher, and those controls MUST call the shared history helpers while reflecting when history is unavailable.

### Behavior
**Given** the editor is in edit mode and the current document has an undoable history step  
**When** the user presses `Mod-z`  
**Then** the live ProseMirror editor undoes the last history change through the shared undo helper.

**Given** the editor is in edit mode and the current document has a redoable history step  
**When** the user presses `Mod-y` or `Mod-Shift-z`  
**Then** the live ProseMirror editor redoes the last undone change through the shared redo helper.

**Given** the editor is in edit mode and history is available  
**When** the user clicks the toolbar `Undo` or `Redo` button  
**Then** the editor performs the same history command path used by the keyboard shortcuts and returns focus to the editing surface.

## Design Decisions
| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Add editor-level `undoHistory` and `redoHistory` command helpers in `src/editor/commands.ts` | Keeps history invocation in one place so toolbar and keymap stay behaviorally identical | Adds a small shared abstraction over ProseMirror history |
| Keep keyboard history handling inside the ProseMirror keymap instead of the React window handler | Limits undo/redo interception to live edit mode and preserves source/view behavior | Requires tests at the plugin stack and component layers |
| Disable toolbar buttons when history cannot run | Prevents no-op clicks and makes availability explicit without adding extra chrome | Availability must be derived from ProseMirror state on each render/update |

## Concern Mapping
| Concern | Requirement | Implementation Strategy |
| --- | --- | --- |
| CONF | EH-001, EH-002, EH-003 | Use a single shared command path for all undo/redo entry points and keep button placement fixed in the top toolbar |
| REL | EH-001, EH-002, EH-003 | Lock behavior with command, plugin-stack, and component tests covering undo/redo availability and invocation |

## Acceptance Criteria
- [x] Shared editor history helpers exist for undo and redo.
- [x] `Mod-z`, `Mod-y`, and `Mod-Shift-z` use the shared history helpers in edit mode.
- [x] Toolbar `Undo` and `Redo` buttons render to the left of the mode tabs.
- [x] Toolbar history buttons disable when the command cannot run and focus the editor after successful invocation.

## Verification Strategy
- Focused Vitest coverage for `src/editor/commands.ts`, `src/editor/plugins/keymap.test.ts`, and `src/components/Editor/index.test.tsx`.
- TypeScript verification with `npm run typecheck`.

## Related
- Depends on: `COMP-EDITOR-MODES-001`
- Used by: `feature/editor-history-005`
