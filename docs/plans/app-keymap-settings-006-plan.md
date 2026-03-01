# Implementation Plan: App Keymap Settings

Change-Type: design-update
Trace: DESIGN-app-keymap-settings-006
Spec: `docs/specs/component/app-keymap-settings-006.md`
Generated: `2026-03-01`
Status: `completed`

## Summary
- Total tasks: 5
- Approach: sequential
- Size: 2 small, 3 medium
- Goal: add app-level TOML-backed managed keymap settings for save, undo, and redo with shared runtime resolution and reset/validation UX.

## Tasks

| ID | Task | Size | Depends | Spec Ref | Status |
| --- | --- | --- | --- | --- | --- |
| AK-001A | Add failing tests for app config persistence and typed Tauri app-settings command wrappers | M | - | AK-001 | completed |
| AK-002A | Add failing UI tests for General and Editor keymap sections plus reset controls | M | AK-001A | AK-002, AK-005 | completed |
| AK-003A | Add failing resolver and runtime shortcut tests for save, undo, and redo wiring | M | AK-002A | AK-003 | completed |
| AK-004B | Implement app config persistence, validation, typed commands, settings UI, and shared shortcut resolver | M | AK-003A | AK-001, AK-002, AK-003, AK-004, AK-005 | completed |
| AK-005V | Run targeted verification, update audit/docs, and commit the workstream | S | AK-004B | AK-001, AK-002, AK-003, AK-004, AK-005 | completed |

## Dependency DAG
```text
AK-001A -> AK-002A -> AK-003A -> AK-004B -> AK-005V
```

## Concern Coverage
| Concern | Tasks | Verification |
| --- | --- | --- |
| CONF | AK-001A, AK-002A, AK-003A, AK-004B | Rust command tests plus frontend API/UI/resolver coverage confirm stable app-scoped keymap persistence and presentation |
| REL | AK-001A, AK-003A, AK-004B, AK-005V | Validation, duplicate rejection, and runtime shortcut tests prevent invalid persisted state and command drift |

## Verification Commands
```bash
cargo test app_config::
cargo test app_settings
npx vitest run src/lib/api.test.ts src/lib/keymapSettings.test.ts src/components/Settings/SettingsPane.test.tsx src/App.test.tsx src/editor/plugins/keymap.test.ts src/components/Editor/index.test.tsx
npm run typecheck
```
