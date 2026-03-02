# UI Automation Runtime Design

- Date: `2026-03-02`
- Status: `approved-for-spec`
- Related spec: `docs/specs/component/ui-automation-runtime-013.md`

## Goal
Enable MCP-driven inspection of the real Knot app through semantic UI actions and screenshot capture, without binding the automation surface to the current first-party screens.

## Chosen Approach
Adopt a hybrid model:

- a generic in-app automation registry for actions and views
- a small ergonomic MCP tool surface on top of that registry

This keeps the runtime discoverable and extensible for future plugins while avoiding a purely generic, awkward operator experience for common flows.

## Scope
Included in v1:

- semantic navigation and action invocation
- discoverable UI actions and views
- window or view screenshot capture
- minimal UI/runtime metadata needed by MCP agents
- extension seam for future plugin-defined actions and views

Explicitly deferred:

- raw click simulation
- keyboard simulation
- coordinate-based interaction

## Runtime Model
The app runtime owns a `UiAutomationRegistry`. First-party features and future plugins register:

- stable IDs
- `kind`: `action` or `view`
- `origin`: `core` or plugin ID
- label/description
- argument schema
- capability flags such as `navigable`, `screenshotable`, `stateful`
- execution or state handlers

Existing ad hoc UI commands remain implementation details. MCP should route through registry-backed dispatch rather than growing a new hardcoded command per screen.

## MCP Surface
Primary tools:

- `list_ui_actions`
- `list_ui_views`
- `invoke_ui_action`
- `capture_ui_screenshot`
- `get_ui_state`

Convenience wrappers may exist for common paths like note navigation, but they must resolve through the same registry.

## Screenshot Model
Screenshot capture is a semantic runtime operation:

- `target`: `window` or `view`
- stable target ID when scoped to a view
- returns saved artifact metadata, not just success/failure

Returned metadata should include file path, target ID, timestamp, and capture scope. Dimensions should be included when available.

## Why This Approach
- Better long-term fit than screen-specific MCP tools
- Stable contract for plugin and extension surfaces
- Compatible with the current `UiCommand`/IPC seam as an incremental evolution
- Supports future richer automation without breaking first-version tools

## Risks
- Registry quality depends on stable IDs and disciplined registration
- Screenshot scoping may be inconsistent across transient dialogs unless view lifecycle rules are explicit
- Plugin-origin metadata and availability filtering need careful validation to avoid stale registry entries

## Validation
The first end-to-end success criterion is:

1. discover available UI actions/views via MCP
2. invoke a semantic navigation action
3. capture a screenshot of the resulting window or view
4. inspect returned artifact metadata
