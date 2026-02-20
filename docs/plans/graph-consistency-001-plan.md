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
| GCS-003 | Update graph backend build query and frontend graph rendering to satisfy tests | M | GCS-002 | FR-1, FR-2, FR-3, FR-4 |
| GCS-004 | Verify targeted graph backend/frontend tests and publish audit | S | GCS-003 | FR-1, FR-2, FR-3, FR-4 |

## Verification Commands
```bash
cargo test -p knot graph_build_from_db_includes_disconnected_notes_and_filters_dangling_edges
npm test -- --run src/components/GraphView/index.test.tsx
npm run -s typecheck
```
