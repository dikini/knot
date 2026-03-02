# UI Automation Runtime for MCP-Controlled App Inspection

## Metadata
- ID: `COMP-UI-AUTOMATION-RUNTIME-013`
- Scope: `component`
- Status: `implemented`
- Parent: `COMP-UI-AUTOMATION-DX-001`, `COMP-KNOTD-UI-010`
- Concerns: `[REL, CONF, COMP, CAP]`
- Trace: `DESIGN-ui-automation-runtime-013`
- Created: `2026-03-02`
- Updated: `2026-03-02`

## Purpose
Provide a discoverable, registry-backed UI automation runtime so MCP clients can navigate the real Knot app semantically, inspect runtime state, and capture screenshots without relying on raw pointer or keyboard simulation.

## Functional Requirements
- FR-1: The runtime MUST expose a discoverable registry of UI automation actions and views with stable IDs and origin metadata.
- FR-2: The registry MUST support both first-party entries and future plugin-defined entries through one normalized contract.
- FR-3: MCP MUST expose a UI automation tool surface that lists actions/views, invokes semantic UI actions, reads compact UI state, and captures screenshots.
- FR-4: Screenshot capture MUST support at least full-window capture and registry-addressable view capture when the target advertises screenshot capability.
- FR-5: Screenshot responses MUST include artifact metadata sufficient for downstream review workflows.
- FR-6: Semantic navigation for core first-party surfaces MUST be available through the registry-backed automation path.
- FR-7: Tool and runtime responses MUST return typed errors for unknown targets, unavailable targets, unsupported capture targets, and handler execution failures.
- FR-8: The first version MUST explicitly exclude raw click and keyboard simulation from the public MCP contract.
- FR-9: Registry entries MUST advertise availability and capability metadata so MCP clients can filter unsupported actions without trial-and-error.
- FR-10: The design MUST preserve a migration path from existing ad hoc `UiCommand` routing to registry-backed dispatch without forcing an all-at-once rewrite.

## Contract

### Registry Entry Shape
Each action or view registration must provide:

- `id`: stable string identifier
- `kind`: `action` or `view`
- `origin`: `core` or plugin identifier
- `label`: short human-readable title
- `description`: concise behavior summary
- `capabilities`: structured flags such as `navigable`, `screenshotable`, `stateful`
- `availability`: current runtime availability snapshot or resolver
- `input_schema`: optional JSON-schema-like arguments contract for actions

### MCP Tool Surface
- `list_ui_actions`
- `list_ui_views`
- `invoke_ui_action`
- `capture_ui_screenshot`
- `get_ui_state`

Optional convenience tools may be added later, but they must delegate through the same registry-backed dispatcher.

### Error Codes
- `UI_TARGET_NOT_FOUND`
- `UI_TARGET_UNAVAILABLE`
- `UI_CAPTURE_UNSUPPORTED`
- `UI_ACTION_INVALID_ARGUMENTS`
- `UI_ACTION_EXECUTION_FAILED`

## Behavior
**Given** an MCP client needs to automate a visible app flow
**When** it lists available UI actions and views
**Then** it receives discoverable metadata including stable IDs, origin, capabilities, and availability.

**Given** an MCP client invokes a semantic action for a core UI flow
**When** the action is available and arguments are valid
**Then** the runtime executes the corresponding UI transition through the registry-backed dispatcher.

**Given** an MCP client requests a screenshot for a view or window target
**When** the target exists and supports capture
**Then** the runtime stores a screenshot artifact and returns metadata describing the capture.

**Given** a client requests a deferred interaction mode such as raw click or keyboard input
**When** the request is evaluated against this component
**Then** the runtime reports the capability as unsupported in this version.

## Design Decisions
| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Use a registry-backed runtime contract | Creates a stable, discoverable seam for first-party UI and plugins | Adds abstraction versus direct command enums |
| Keep a small ergonomic MCP tool surface | Makes routine automation practical for agents | Requires maintaining wrapper semantics |
| Treat screenshots as semantic target-based operations | Aligns capture with stable views instead of fragile coordinates | Requires explicit view registration discipline |
| Defer raw click and keyboard simulation | Avoids a brittle low-level automation surface in v1 | Some unregistered UI cannot yet be exercised |
| Allow incremental reuse of existing `UiCommand` handlers | Reduces migration risk and enables staged rollout | Temporary duplication while old and new paths coexist |

## Concern Mapping
| Concern | Requirement | Implementation Strategy |
| --- | --- | --- |
| REL | FR-3, FR-7, FR-10 | Typed errors, deterministic registry lookup, staged migration behind existing runtime seams |
| CONF | FR-4, FR-6, FR-8, FR-9 | Semantic actions only, explicit availability metadata, predictable screenshot targeting |
| COMP | FR-2, FR-10 | Single normalized contract for core and plugins, compatibility with current `UiCommand` paths |
| CAP | FR-3, FR-4, FR-9 | Compact state responses, filtered listings, bounded screenshot metadata payloads |

## Acceptance Criteria
- [ ] A registry-backed runtime type exists for UI automation actions and views with stable IDs and origin metadata.
- [ ] MCP `tools/list` includes the new UI automation tools with defined schemas.
- [ ] At least one core semantic navigation flow can be discovered and invoked through the registry-backed path.
- [ ] Screenshot capture returns artifact metadata for at least one supported target.
- [ ] Unknown or unavailable UI targets return typed errors rather than generic failures.
- [ ] Public docs/spec text explicitly mark click and keyboard simulation as deferred.

## Verification Strategy
- Rust unit tests for registry registration, lookup, filtering, and error mapping.
- MCP tests covering `tools/list` and `tools/call` for the new UI automation tools.
- Runtime-backed tests for at least one core action registration and screenshot flow.
- Targeted frontend/runtime smoke validation if UI labels or surfaced state change.

## Related
- Depends on: `COMP-UI-AUTOMATION-DX-001`, `COMP-KNOTD-UI-010`
- Used by: MCP-assisted debugging, future plugin exercise flows, UI review workflows
