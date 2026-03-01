# Implementation Plan: Graph Consistency and Selection Sync

Change-Type: bug-fix
Trace: BUG-graph-consistency-selection-001
Spec: `docs/specs/component/graph-consistency-001.md`
Generated: `2026-02-20`

## Tasks

| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| GCS-001 | Add failing backend tests for disconnected-note inclusion and dangling-edge filtering | S | - | FR-1, FR-2 |
| GCS-002 | Add failing frontend tests for external selected-node sync and duplicate-label disambiguation | S | GCS-001 | FR-3, FR-4 |
| GCS-003 | Add failing backend test for extensionless/title wiki target resolution | S | GCS-002 | FR-5 |
| GCS-004 | Update graph backend build and frontend rendering to satisfy tests | M | GCS-003 | FR-1, FR-2, FR-3, FR-4, FR-5 |
| GCS-005 | Verify targeted graph backend/frontend tests and publish audit | S | GCS-004 | FR-1, FR-2, FR-3, FR-4, FR-5 |
| GCS-006 | Add failing backend layout test for disconnected-node discoverability | S | GCS-005 | FR-6 |
| GCS-007 | Implement bounded center-gravity in graph layout and re-verify | S | GCS-006 | FR-6 |
| GCS-008 | Add backend regression test for saved/runtime note graph persistence and alias-resolved neighbors/backlinks | S | GCS-007 | FR-7 |
| GCS-009 | Persist parsed links/headings in save/sync flows and rebuild graph from database-backed state | M | GCS-008 | FR-7 |
| GCS-010 | Re-verify graph persistence regression and publish audit update | S | GCS-009 | FR-7 |
| GCS-011 | Add backend regression test for chain-like layout flattening | S | GCS-010 | FR-8 |
| GCS-012 | Add deterministic layout jitter to prevent horizontal ribbon collapse and re-verify | S | GCS-011 | FR-8 |

## Verification Commands
```bash
cargo test -p knot graph_build_from_db_includes_disconnected_notes_and_filters_dangling_edges
cargo test --lib graph_build_from_db_resolves_extensionless_and_title_targets
cargo test --lib save_note_persists_runtime_wikilink_neighbors_and_backlinks_across_reopen
npm test -- --run src/components/GraphView/index.test.tsx
npm run -s typecheck
cargo test --manifest-path src-tauri/Cargo.toml layout_chain_graph_preserves_vertical_spread
```
