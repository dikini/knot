# List Continuation Regression Fix

## Metadata
- ID: `COMP-LIST-CONTINUATION-004`
- Scope: `component`
- Status: `implemented`
- Parent: `COMP-AUTHORING-FLOWS-001`, `COMP-TASK-LIST-UI-003`
- Concerns: `[CONF, REL]`
- Created: `2026-03-01`
- Updated: `2026-03-01`

## Purpose
Restore `Enter`-driven list continuation in the live ProseMirror editor for bullet, ordered, and task lists after the editor plugin stack stopped routing the custom continuation handler first.

## Contract

### Functional Requirements
**LC-001**: The live editor plugin stack MUST continue bullet and ordered lists when the caret is inside a list item and the user presses `Enter`.

**LC-002**: The live editor plugin stack MUST continue task lists on `Enter`, preserving the task-item shape on the new list item while resetting the new item's checked state to unchecked.

### Behavior
**Given** the caret is at the end of a bullet or ordered list item in edit mode  
**When** the user presses `Enter`  
**Then** the editor creates a new sibling list item in the same list type.

**Given** the caret is at the end of a task list item in edit mode  
**When** the user presses `Enter`  
**Then** the editor creates a new task list item with `task: true` and `checked: false`.

## Design Decisions
| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Register `keymap(keyBindings)` before `keymap(baseKeymap)` | Lets the specialized list continuation handler consume `Enter` before the generic base keymap path | Requires care to avoid shadowing unrelated base key bindings |
| Verify behavior through the assembled plugin stack instead of only direct command tests | Captures live editor precedence regressions that direct command invocation misses | Adds integration-style unit tests around `EditorView` and `handleKeyDown` |

## Concern Mapping
| Concern | Requirement | Implementation Strategy |
| --- | --- | --- |
| CONF | LC-001, LC-002 | Preserve deterministic edit-mode `Enter` behavior by ordering plugins so the custom list continuation path executes first |
| REL | LC-001, LC-002 | Lock the regression with plugin-stack tests for bullet, ordered, and task lists |

## Acceptance Criteria
- [x] Bullet lists continue in the live plugin stack on `Enter`.
- [x] Ordered lists continue in the live plugin stack on `Enter`.
- [x] Task lists continue in the live plugin stack on `Enter`.
- [x] Continued task items preserve `task: true` and reset `checked` to `false`.

## Verification Strategy
- Focused Vitest coverage in `src/editor/plugins/keymap.test.ts` that dispatches `Enter` through the assembled ProseMirror plugins.
- TypeScript verification with `npm run typecheck`.

## Related
- Depends on: `COMP-AUTHORING-FLOWS-001`, `COMP-TASK-LIST-UI-003`
- Used by: `feature/list-continuation-004`
