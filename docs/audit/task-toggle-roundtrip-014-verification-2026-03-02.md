# Task Toggle Roundtrip Verification

Trace: `DESIGN-task-toggle-roundtrip-014`
Spec: `docs/specs/component/task-toggle-roundtrip-014.md`
Plan: `docs/plans/task-toggle-roundtrip-014-plan.md`
Tasks: `docs/plans/task-toggle-roundtrip-014-tasks.yaml`
Date: `2026-03-02`

## Summary

The implementation fixes the edit-mode task checkbox refresh regression, adds roundtrip coverage for task toggles across edit/view/source surfaces, and introduces the first UI automation behavior surface with `core.task.toggle` plus MCP behavior discovery/invocation tools.

Assessment: `pass`

## Requirement Coverage

| Requirement | Evidence | Status |
| --- | --- | --- |
| FR-1 Task toggles in view mode remain reflected after switching to edit or source | `src/components/Editor/index.test.tsx` roundtrip tests for `view -> toggle -> edit` and `view -> toggle -> source` | ✅ |
| FR-2 Task toggles in edit mode remain reflected after switching to view or source | `src/components/Editor/index.test.tsx` roundtrip tests for `edit -> toggle -> view` and `edit -> toggle -> source`; `src/editor/plugins/task-list.ts` checkbox sync fix | ✅ |
| FR-3 Edit-mode checkbox visual state updates immediately when toggled | `src/editor/plugins/task-list.ts`; `src/editor/plugins/task-list.test.ts` DOM checked-state assertions across click, undo, redo | ✅ |
| FR-4 UI automation exposes a semantic task-toggle behavior addressable by note path and task index | `src/lib/uiAutomation.ts`, `src-tauri/src/ui_automation.rs`, `src-tauri/src/mcp.rs`, `src/App.tsx`, `src/components/Editor/index.tsx` | ✅ |
| FR-5 Behavior surface is gated by the existing `ui_automation.groups.behaviors` policy | `src-tauri/src/main.rs` list/invoke behavior policy checks | ✅ |
| FR-6 MCP exposes discoverable behavior tools for development and visual testing | `src-tauri/src/mcp.rs` adds `list_ui_behaviors` and `invoke_ui_behavior`; `src-tauri/src/mcp.rs` test covers tools list exposure | ✅ |

## Verification Commands

```bash
npm run test -- --run src/editor/plugins/task-list.test.ts src/components/Editor/index.test.tsx src/lib/api.test.ts
npm run typecheck
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml --lib
```

## Results

- `npm run test -- --run src/editor/plugins/task-list.test.ts src/components/Editor/index.test.tsx src/lib/api.test.ts` → pass
- `npm run typecheck` → pass
- `cargo check --manifest-path src-tauri/Cargo.toml` → pass
- `cargo test --manifest-path src-tauri/Cargo.toml --lib` → pass (`136 passed; 0 failed`)

## Gaps

- Live MCP smoke for `list_ui_behaviors` / `invoke_ui_behavior(core.task.toggle)` could not be completed in the current daemon session because the running `knotd` instance was still serving the pre-change tool set and returned `Unknown tool: list_ui_behaviors`. A daemon/UI restart is required to verify the new live behavior surface.

## Compliance

- Functional requirements satisfied: `6 / 6`
- Compliance: `100% (targeted verification; live daemon smoke pending restart)`
