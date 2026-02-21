# Graph UI Continuity 003 Visual Checklist (2026-02-21)

Scope: quick manual validation of icon-toggle semantics and graph relation list continuity.

## Preconditions
- Open any vault with at least 2 linked notes.
- Ensure context panel is visible.

## Checks

1. **Note-pane mode toggle shows next mode**
   - In editor view, top-right mode control shows graph icon and `Graph mode` tooltip.
   - Click it.
   - In graph view, same control now shows edit icon and `Edit note` tooltip.

2. **Mode toggle round-trip**
   - From graph view, click `Edit note`.
   - Confirm return to editor view.

3. **Graph scope single-toggle placement**
   - Open Graph tool in context panel.
   - Confirm one scope toggle appears in same action row as `Reset` and `Editor`.
   - Confirm no second scope button row exists.

4. **Scope toggle next-action semantics**
   - In `vault` scope, scope toggle reads `Node graph`.
   - Click it, confirm node-scope state/depth controls appear.
   - In `node` scope, scope toggle reads `Vault graph`.

5. **Relation rows are selectable and style-consistent**
   - Select a node in graph with neighbors/backlinks shown.
   - Confirm relation items render as clickable rows (not plain bullets, not folder rows).
   - Hover relation row: should match note-list-like hover continuity.

6. **Relation click keeps graph mode**
   - Click one neighbor or backlink row.
   - Confirm graph view remains open.
   - Confirm selected note updates (node/path context updates accordingly).

## Pass/Fail Log
- [x] Check 1 passed
- [x] Check 2 passed
- [x] Check 3 passed
- [x] Check 4 passed
- [x] Check 5 passed
- [x] Check 6 passed

## Notes
- If any check fails, capture: check number + what you observed + expected behavior.
