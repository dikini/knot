# Managed Shortcuts Expansion

## Metadata
- ID: `COMP-MANAGED-SHORTCUTS-007`
- Scope: `component`
- Status: `implemented`
- Parent: `COMP-APP-KEYMAP-006`, `COMP-EDITOR-HISTORY-005`, `COMP-TOOL-RAIL-CONTEXT-001`
- Concerns: `[CONF, REL]`
- Created: `2026-03-01`
- Updated: `2026-03-01`

## Purpose
Extend the existing TOML-backed managed shortcut system to cover a small additional set of safe shared-command actions without widening validation or reset scope.

## Contract

### Functional Requirements
**MS-001**: The app MUST extend the existing app-level managed keymap model to include General shortcuts for switching to `Notes`, `Search`, and `Graph`, reusing the current TOML-backed persistence path and duplicate validation behavior.

**MS-002**: The settings UI MUST expose the new managed General shortcuts and an Editor shortcut for clearing paragraph formatting while preserving the existing apply/reset flows and error presentation.

**MS-003**: Runtime shortcut handling MUST route the new managed actions only through existing shared command paths:
- General: Notes, Search, Graph use the shared shell tool selection path
- Editor: clear paragraph formatting uses the shared editor command path

### Behavior
**Given** managed app keymap settings contain custom chords for tool switching and clear paragraph  
**When** the app and editor are active  
**Then** the persisted chords drive runtime behavior instead of hard-coded bindings.

**Given** a managed shortcut conflicts with another managed action or is malformed  
**When** the user applies settings  
**Then** validation fails and the last valid persisted settings remain active.

## Design Decisions
| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Reuse the existing app-level TOML config model instead of a second shortcut store | Keeps managed shortcut behavior centralized and typed across frontend and Tauri | Requires coordinated frontend + Rust model updates |
| Limit expansion to Notes/Search/Graph and clear paragraph only | Matches actions that already have safe shared command paths | Leaves other shortcuts unmanaged for now |
| Route shell shortcuts through the same tool-mode selection handler used by the rail | Preserves panel policy and future shell behavior in one place | Shortcut behavior now follows active-tool toggle semantics |

## Concern Mapping
| Concern | Requirement | Implementation Strategy |
| --- | --- | --- |
| CONF | MS-001, MS-002, MS-003 | One managed schema, one settings surface, shared command routing |
| REL | MS-001, MS-003 | Duplicate validation, reset-to-default behavior, and targeted runtime regression coverage |

## Acceptance Criteria
- [x] App keymap settings persist and validate `switch_notes`, `switch_search`, `switch_graph`, and `clear_paragraph` through the existing TOML-backed path.
- [x] Settings UI renders the new General and Editor managed shortcut fields without changing reset/apply behavior.
- [x] Notes/Search/Graph shortcuts route through the shared shell tool selection path.
- [x] Clear paragraph uses the shared editor command path and remains edit-mode scoped.

## Verification Strategy
- Focused Vitest coverage for keymap settings, settings UI, app shell shortcuts, and editor shortcut handling.
- Focused Rust config tests for managed shortcut persistence and duplicate validation.
- TypeScript verification with `npm run typecheck`.

## Related
- Depends on: `COMP-APP-KEYMAP-006`, `COMP-EDITOR-HISTORY-005`, `COMP-TOOL-RAIL-CONTEXT-001`
- Used by: app shell shortcut handling, settings pane, editor managed shortcut handling
