# App Keymap Settings

## Metadata
- ID: `COMP-APP-KEYMAP-006`
- Scope: `component`
- Status: `implemented`
- Parent: `COMP-SETTINGS-PANE-001`
- Concerns: `[CONF, REL]`
- Created: `2026-03-01`
- Updated: `2026-03-01`

## Purpose
Persist a small, app-level set of managed keyboard shortcuts in app configuration so save, undo, and redo use the same typed settings across runtime handling and the settings UI.

## Contract

### Functional Requirements
**AK-001**: The app MUST persist managed keymap settings in an app-level TOML config file through typed Tauri commands, separate from vault config and browser localStorage.

**AK-002**: The settings UI MUST expose exactly two keymap sections, `General` and `Editor keymaps`, for the initial managed shortcuts:
- General: save note
- Editor keymaps: undo, redo

**AK-003**: Runtime shortcut handling for save note, undo, and redo MUST resolve through shared shortcut resolver logic so persisted settings drive both settings display and active shortcut behavior.

**AK-004**: Managed shortcut updates MUST validate malformed chords and duplicate assignments across managed actions, reject invalid state, and preserve the last valid persisted settings.

**AK-005**: The settings UI MUST expose reset-to-default controls so users can restore either an individual managed shortcut or the full managed shortcut set.

### Behavior
**Given** app keymap settings have custom persisted chords  
**When** the app starts and the editor becomes active  
**Then** save, undo, and redo use the persisted chords instead of hard-coded defaults.

**Given** a user enters an invalid or duplicate managed shortcut  
**When** they attempt to apply the update  
**Then** the UI shows the validation error and the app keeps the previous valid mapping.

**Given** a user resets a managed shortcut or the full managed set  
**When** the reset action completes  
**Then** the app persists the default chords and runtime handling immediately reflects them.

## Design Decisions
| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Add a dedicated app config model and TOML file under the app config directory | Keeps app-level shortcuts separate from vault-scoped settings and browser storage | Adds one more persisted config surface to maintain |
| Keep the first managed set limited to save, undo, and redo | Minimizes risk while establishing the persistence/validation path | Other shortcuts remain unmanaged for now |
| Use a shared frontend shortcut resolver for matching events and building editor key bindings | Ensures save/undo/redo settings stay behaviorally aligned across runtime entry points | Requires a small abstraction over existing hard-coded bindings |
| Validate duplicates against managed actions only | Prevents unsafe collisions within the supported set without widening scope to all possible shortcuts | Does not yet guard collisions with unmanaged shortcuts |

## Concern Mapping
| Concern | Requirement | Implementation Strategy |
| --- | --- | --- |
| CONF | AK-001, AK-002, AK-003, AK-005 | Separate app config storage, deterministic settings IA, shared resolver, explicit reset actions |
| REL | AK-001, AK-003, AK-004, AK-005 | Typed command contract, validated writes, duplicate protection, tests for runtime/read-after-write behavior |

## Acceptance Criteria
- [x] Typed Tauri commands return app keymap settings from app TOML storage and persist updates without using vault config or localStorage.
- [x] Settings UI renders `General` and `Editor keymaps` sections with fields for save note, undo, and redo.
- [x] Save note, undo, and redo runtime handlers read from shared persisted shortcut settings.
- [x] Invalid or duplicate managed shortcuts are rejected with user-visible validation feedback.
- [x] Individual and full reset actions restore default managed shortcuts and persist them.

## Verification Strategy
- Focused Rust tests for app config persistence and command validation behavior.
- Focused Vitest coverage for shortcut resolver logic, typed API wrappers, settings UI, and runtime shortcut wiring.
- TypeScript verification with `npm run typecheck`.

## Related
- Depends on: `COMP-SETTINGS-PANE-001`, `COMP-EDITOR-HISTORY-005`
- Used by: `feature/app-keymap-settings-006`
