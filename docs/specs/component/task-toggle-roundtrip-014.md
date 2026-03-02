# Task Toggle Roundtrip and UI Automation Behaviors

## Metadata
- ID: `COMP-TASK-TOGGLE-ROUNDTRIP-014`
- Scope: `component`
- Status: `draft`
- Parent: `COMP-TASK-LIST-UI-003`, `COMP-UI-AUTOMATION-RUNTIME-013`
- Concerns: `[REL, CONF, COMP]`
- Created: `2026-03-02`
- Updated: `2026-03-02`

## Purpose
Close the task-list checkbox regression where intended checked state is not immediately reflected after edit-mode toggles across mode transitions, and add a minimal semantic UI automation behavior for task toggling by note path and task index.

## Contract

### Functional Requirements
**TR-001**: When a task is toggled in `view` mode, the resulting checked state MUST be reflected after switching to `edit` mode.

**TR-002**: When a task is toggled in `view` mode, the resulting checked state MUST be reflected after switching to `source` mode.

**TR-003**: When a task is toggled in `edit` mode, the resulting checked state MUST be reflected after switching to `view` mode.

**TR-004**: When a task is toggled in `edit` mode, the resulting checked state MUST be reflected after switching to `source` mode.

**TR-005**: The UI automation runtime MUST expose at least one semantic behavior, `core.task.toggle`, addressed by `path` and `taskIndex`.

**TR-006**: The UI automation runtime MUST expose behavior discovery and invocation through MCP-compatible tools.

**TR-007**: Behavior listing and invocation MUST be blocked when `ui_automation.enabled = false` or `ui_automation.groups.behaviors = false`.

### Behavior
**Given** a markdown note with task list items  
**When** a task is toggled in one surface and the user moves to another supported surface  
**Then** the destination surface reflects the intended checked state without requiring save/reload.

**Given** UI automation behaviors are enabled  
**When** an agent invokes `core.task.toggle` with `path` and `taskIndex`  
**Then** the runtime loads the note if needed, toggles the indexed task, and returns the resulting checked state and active mode.

**Given** behaviors are disabled by policy  
**When** an agent lists or invokes behaviors  
**Then** the runtime returns a typed policy error or disabled availability state instead of performing the toggle.

## Design Decisions
| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Use `note path + task index` for v1 behavior targeting | Fastest route to reproducible visual test automation | Task identity is order-dependent |
| Keep markdown body as the source of truth across modes | Avoids divergent task state stores | Requires careful dirty-state hydration |
| Add a minimal behavior layer rather than raw clicks | Stable and product-meaningful automation surface | Does not cover arbitrary UI yet |

## Acceptance Criteria
- [ ] `view -> toggle -> edit` reflects the intended checked state.
- [ ] `view -> toggle -> source` reflects the intended checked state.
- [ ] `edit -> toggle -> view` reflects the intended checked state.
- [ ] `edit -> toggle -> source` reflects the intended checked state.
- [ ] `list_ui_behaviors` exposes `core.task.toggle` when behaviors are enabled.
- [ ] `invoke_ui_behavior(core.task.toggle)` toggles the target task by note path and index.
- [ ] Behavior listing/invocation is gated by the existing UI automation policy settings.

## Verification Strategy
- Vitest coverage in `Editor` roundtrip tests.
- Focused MCP/runtime tests for behavior discovery, invocation, and policy gating.
- Live smoke against `knot/issues.md` with behavior invocation followed by visual capture.
