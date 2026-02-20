# Component Spec: Graph Consistency and Selection Sync

Spec-ID: COMP-GRAPH-CONSISTENCY-001
Change-Type: bugfix
Trace: BUG-graph-consistency-selection-001
Date: 2026-02-20

## Purpose
Fix graph mode reliability issues where disconnected notes are missing, ambiguous duplicate labels make nodes appear duplicated, and selected note state is not visible in graph mode.

## Functional Requirements
- FR-1: Graph layout MUST include all notes in the vault, including notes with zero links.
- FR-2: Graph layout MUST only emit edges whose source and target resolve to existing notes.
- FR-3: Graph view MUST visually mark the app-selected note when entering graph mode from notes/explorer.
- FR-4: Graph view MUST disambiguate duplicate visible labels (same filename stem across different paths) so nodes are distinguishable.
- FR-5: Graph build MUST resolve common wiki-link targets that omit `.md` or use note title when the target maps unambiguously to an existing note.

## Acceptance Criteria
- AC-1: A vault with linked and disconnected notes renders nodes for both linked and disconnected notes.
- AC-2: Graph data does not include dangling edges to missing targets.
- AC-3: Passing selected note path from `App` marks that node with selected styling without requiring graph click.
- AC-4: When two nodes share the same `label`, rendered label text differs via path-based disambiguation.
- AC-5: Links such as `[[rust]]` to note `rust.md` and `[[Some Title]]` to note with title `Some Title` produce edges when target mapping is unique.
