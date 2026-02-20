# Implementation Plan: Explorer Tree Navigation

Change-Type: design-update
Trace: DESIGN-explorer-tree-navigation
Spec: `docs/specs/component/explorer-tree-001.md`
Generated: `2026-02-20`

## Summary
- Total tasks: 12
- Approach: phased (M0 -> M1 -> M2 -> M3)
- Goal: deliver full explorer-tree scope gradually with traceable milestones

## Milestones

### M0: Read Model + Render
| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| ET-001 | Add backend explorer tree response types and Tauri command `get_explorer_tree` | M | - | FR-1, FR-2 |
| ET-002 | Add backend metadata persistence for folder expansion state | M | ET-001 | FR-5, FR-6 |
| ET-003 | Add frontend API client/types for explorer tree payload | S | ET-001 | FR-1, FR-2 |
| ET-004 | Add read-only tree renderer in Notes pane (folder toggle + note open) | M | ET-003 | FR-1, FR-3, FR-4, FR-7 |
| ET-005 | Add fallback expansion behavior when metadata missing | S | ET-002, ET-004 | FR-6 |

### M1: CRUD Actions (Optimistic + Rollback)
| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| ET-006 | Expose directory CRUD commands (`create/rename/delete`) and frontend bindings | M | ET-001 | FR-8 |
| ET-007 | Add context menu and top icon actions for note/folder operations | M | ET-004, ET-006 | FR-8 |
| ET-008 | Add optimistic mutation model with rollback + toast errors | M | ET-007 | FR-9 |

### M2: Watcher Push + Reconciliation
| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| ET-009 | Emit `vault://tree-changed` events from backend watcher sync path | M | ET-001 | FR-10 |
| ET-010 | Add frontend event listener + reconcile strategy (subtree/full refresh) | M | ET-009, ET-008 | FR-10, FR-11 |

### M3: A11y + Hardening
| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| ET-011 | Add ARIA tree semantics and keyboard navigation | M | ET-004 | FR-13 |
| ET-012 | Add hidden-files policy enforcement and test coverage | S | ET-001, ET-011 | FR-12, FR-13 |

## Verification Commands (per milestone)
```bash
npm test -- --run src/components/Sidebar src/lib/store.test.ts src/App.test.tsx
cargo test explorer_tree
npm run -s typecheck
cargo check
```
