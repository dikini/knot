# Task Toggle Roundtrip Design

## Context
Task list checkboxes already render and toggle in both edit and view modes, but edit-mode toggles can fall out of sync when the user moves across `view`, `edit`, and `source` surfaces. The next automation step also needs a semantic way to reproduce task toggles visually during development without relying on raw clicks.

## Problem
The current test coverage proves isolated toggles in edit mode and isolated toggles in view mode, but it does not lock the mode-transition matrix that matters for real usage:
- `view -> toggle -> edit`
- `view -> toggle -> source`
- `edit -> toggle -> view`
- `edit -> toggle -> source`

This leaves a gap where the underlying markdown changes but the newly-entered surface does not reflect the intended checked state immediately.

## Recommended Approach
Use the existing markdown body as the single source of truth and add explicit task-toggle roundtrip coverage at the `Editor` component layer. At the same time, extend the UI automation runtime with a minimal semantic behavior surface for task toggling by `note path + task index`.

This approach keeps the first behavior implementation narrow:
- no raw click or keyboard simulation
- no stable task IDs yet
- behavior addresses the regression and supports visual verification directly

## Design

### 1. Editor roundtrip fix
- Ensure edit-mode task checkbox toggles update the shared markdown state used by `source` and `view`.
- Ensure mode changes rehydrate the destination surface from the latest dirty markdown, not stale note content.
- Keep task index ordering consistent with the rendered/task-list markdown traversal already used in view mode.

### 2. UI automation behaviors
Add a minimal behavior registry layer beside the existing action/view registry.

Initial behavior:
- `core.task.toggle`

Arguments:
- `path: string`
- `taskIndex: integer`
- optional `mode: "view" | "edit" | "source"` only as a preparation convenience

Behavior semantics:
- load the note if needed
- switch to the requested editor mode when provided
- toggle the indexed task using the same domain/path logic the UI uses
- return the resulting checked state and active mode so MCP can follow with screenshots

### 3. Security/policy
- The existing `ui_automation.groups.behaviors` setting becomes effective.
- Listing/invoking behaviors must be blocked when the behaviors group is disabled.

### 4. Tool surface
Add:
- `list_ui_behaviors`
- `invoke_ui_behavior`

Keep the payload shape parallel to existing action APIs.

## Verification
- Focused editor tests for all four roundtrip paths.
- Focused automation tests for behavior listing and invocation policy gating.
- Live smoke:
  - navigate to `knot/issues.md`
  - invoke `core.task.toggle`
  - capture `view`/`source`/`edit` states as needed
