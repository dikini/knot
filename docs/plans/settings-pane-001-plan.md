# Implementation Plan: Settings Pane and Manual Vault Reindex

Change-Type: design-update
Trace: DESIGN-settings-pane-001
Spec: `docs/specs/component/settings-pane-001.md`
Generated: `2026-02-23`

## Summary
- Total tasks: 8
- Approach: sequential
- Size: 5 small, 3 medium, 0 large
- Goal: add sectioned settings UI in right rail, expose current config, and implement explicit full vault reindex action.

## Tasks

| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| SP-001 | Add failing tests for inspector settings mode and bottom settings affordance behavior | M | - | FR-1, FR-2 |
| SP-002 | Add failing tests for settings section switching and field rendering | M | SP-001 | FR-3, FR-6, FR-7 |
| SP-003 | Add failing tests for reindex API wrapper and UI action feedback paths | M | SP-002 | FR-4, FR-5 |
| SP-004 | Add backend command for full vault reindex and command registration | S | SP-003 | FR-4, FR-5 |
| SP-005 | Add frontend API methods for vault settings get/update and full reindex | S | SP-004 | FR-4, FR-7, FR-8 |
| SP-006 | Implement settings pane sections, editing controls, and bottom-pinned rail settings icon | S | SP-005 | FR-1, FR-2, FR-3, FR-6 |
| SP-007 | Wire frontend persistence and backend patch updates for configurable settings | S | SP-006 | FR-7, FR-8 |
| SP-008 | Verify tests/typecheck/lint/storybook and publish compliance audit | S | SP-007 | FR-1..FR-8 |

## Dependency DAG
```text
SP-001 -> SP-002 -> SP-003 -> SP-004 -> SP-005 -> SP-006 -> SP-007 -> SP-008
```

## Concern Coverage
| Concern | Tasks | Verification |
| --- | --- | --- |
| CONF | SP-001, SP-002, SP-006 | App/component tests for settings access and section behavior |
| REL | SP-003, SP-004, SP-005, SP-007 | API + command tests for safe reindex and config update flow |
| CAP | SP-004, SP-008 | Explicit/manual reindex only; no background heavy loop changes |

## Verification Commands
```bash
npm run -s test -- --run src/lib/api.test.ts src/components/Shell/InspectorRail.test.tsx src/App.test.tsx
npm run -s typecheck
npx eslint src/App.tsx src/lib/api.ts src/lib/api.test.ts src/components/Shell/InspectorRail.tsx src/components/Shell/InspectorRail.css src/components/Shell/InspectorRail.test.tsx
cargo test -p knot commands::vault
```
