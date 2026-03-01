# Implementation Plan: Managed Shortcuts Expansion

Change-Type: design-update
Trace: DESIGN-managed-shortcuts-007
Spec: `docs/specs/component/managed-shortcuts-007.md`
Generated: `2026-03-01`
Status: `completed`

## Summary
- Total tasks: 4
- Approach: sequential
- Size: 2 small, 2 medium
- Goal: extend the existing managed shortcut model to safe shared-command actions only.

## Tasks

| ID | Task | Size | Depends | Spec Ref | Status |
| --- | --- | --- | --- | --- | --- |
| MS-001 | Extend the TOML-backed managed keymap schema, defaults, and validation for Notes/Search/Graph plus clear paragraph | M | - | MS-001 | completed |
| MS-002 | Add failing and passing UI tests, then expose the new managed shortcut fields in settings | M | MS-001 | MS-002 | completed |
| MS-003 | Route runtime shell and editor shortcut handling through existing shared command paths | S | MS-002 | MS-003 | completed |
| MS-004 | Run targeted verification, update docs, and publish audit artifacts | S | MS-003 | MS-001, MS-002, MS-003 | completed |

## Dependency DAG
```text
MS-001 -> MS-002 -> MS-003 -> MS-004
```

## Concern Coverage
| Concern | Tasks | Verification |
| --- | --- | --- |
| CONF | MS-001, MS-002, MS-003 | Shared managed schema and settings UI tests confirm consistent configuration behavior |
| REL | MS-001, MS-003, MS-004 | Rust config tests plus runtime shortcut tests guard persistence and command drift |

## Verification Commands
```bash
npx vitest run src/lib/keymapSettings.test.ts src/components/Settings/SettingsPane.test.tsx src/App.test.tsx src/components/Editor/index.test.tsx
npm run typecheck
npm run build
cargo test --test app_keymap_config_test
```

## Execution Complete
- Date: `2026-03-01`
- Status: `implemented`
- Verification: `docs/audit/managed-shortcuts-007-verification-2026-03-01.md`
