# Implementation Plan: Editor Modes M4 (Keyboard Accessibility + Fidelity Coverage)

Change-Type: design-update
Trace: DESIGN-editor-medium-like-interactions
Spec: `docs/specs/component/editor-modes-wysiwym-001.md`
Generated: `2026-02-20`

## Tasks

| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| EM4-001 | Add keyboard interaction support for floating edit controls (`Arrow`, `Enter/Space`, `Escape`) | S | - | FR-11 |
| EM4-002 | Add visible focus states for mode and floating control buttons | S | EM4-001 | FR-11 |
| EM4-003 | Expand markdown fidelity regressions for links, blockquote, and code block round-trip across modes | S | EM4-002 | AC-8 |
| EM4-004 | Eliminate test harness `act(...)` warnings from editor selection simulation | S | EM4-003 | AC-9 |
| EM4-005 | Run verification suite and record results | S | EM4-004 | AC-8, AC-9 |

## Verification Commands
```bash
npm test -- --run src/components/Editor/index.test.tsx
npm test -- --run src/editor/plugins/keymap.test.ts
npm run -s typecheck
```
