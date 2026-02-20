# Knot Specification Registry

This file tracks all specifications in the Knot project. Extracted specs are machine-generated from existing code. Designed specs are human-authored.

## Components

| Spec ID               | Component       | Source    | Path                             | Concerns         | Status                                 |
| --------------------- | --------------- | --------- | -------------------------------- | ---------------- | -------------------------------------- |
| COMP-VAULT-001        | vault           | extracted | extracted/vault-001.md           | [REL, SEC, CAP]  | active (traceable, verified 100%)      |
| COMP-NOTE-001         | note            | extracted | extracted/note-001.md            | [REL, CAP]       | active (traceable, verified 100%)      |
| COMP-SEARCH-001       | search          | extracted | extracted/search-001.md          | [CAP, REL]       | active (traceable, verified 100%)      |
| COMP-GRAPH-001        | graph           | extracted | extracted/graph-001.md           | [CAP, REL]       | active (traceable, verified 100%)      |
| COMP-MARKDOWN-001     | markdown        | extracted | extracted/markdown-001.md        | [CAP]            | active (traceable, verified 100%)      |
| COMP-DATABASE-001     | database        | extracted | extracted/database-001.md        | [REL, SEC, CAP]  | active (traceable, verified 100%)      |
| COMP-FRONTEND-001     | frontend        | extracted | extracted/frontend-001.md        | [CAP, REL]       | active (traceable, verified 90%)       |
| COMP-VAULT-UI-001     | vault-ui        | designed  | component/vault-ui-001.md        | [REL, SEC, CONF] | implemented (verified 100%)            |
| COMP-CONTENT-LOAD-001 | content-loading | designed  | component/content-loading-001.md | [REL, SEC]       | implemented (bug fixed, verified 100%) |
| COMP-NOTE-SEL-001     | note-selection  | designed  | component/note-selection-001.md  | [REL, CAP]       | implemented (verified 100%)            |
| COMP-FILE-WATCH-001   | file-watcher    | designed  | component/file-watcher-001.md    | [REL, CONS]      | implemented (verified 100%)            |
| COMP-GRAPH-UI-001     | graph-ui        | designed  | component/graph-ui-001.md        | [CAP, REL]       | implemented (verified 100%)            |
| COMP-SEARCH-UI-001    | search-ui       | designed  | component/search-ui-001.md       | [CAP, REL]       | implemented (verified 100%)            |
| COMP-TAG-EXTRACTION-001 | tag-extraction | designed  | component/tag-extraction-001.md  | [CAP]            | implemented (verified 100%)            |
| COMP-TOOLCHAIN-001    | toolchain       | designed  | component/frontend-toolchain-modernization-001.md | [REL, CAP, COMP] | implemented (verified 100%)            |
| COMP-UI-LAYOUT-002    | ui-layout       | designed  | component/ui-layout-002.md       | [CONF, CAP]      | implemented (all FR complete)          |
| COMP-COMPLIANCE-001   | compliance-fixes | designed  | component/compliance-fixes-001.md | [REL, COMP]      | implemented (verified 100%)            |
| COMP-LINT-001         | lint-cleanup    | designed  | component/lint-cleanup-001.md | [COMP, REL]      | implemented (verified 100%)            |
| COMP-TRACE-LITE-001   | traceability-lite | designed  | component/traceability-lite-001.md | [COMP, REL]      | implemented (lightweight guardrails)   |
| COMP-EDITOR-READING-001 | editor-reading | designed  | component/editor-reading-001.md | [CONF, CAP, REL] | implemented (verified 100%)            |
| COMP-LAYOUT-RECOVERY-001 | layout-recovery | designed  | component/layout-recovery-001.md | [REL, CONF]      | implemented (verified 100%)            |
| COMP-ICON-CHROME-001 | icon-chrome | designed | component/icon-chrome-001.md | [CONF, REL, CAP] | implemented (verified 100%) |
| COMP-GRAPH-HOVER-001 | graph-hover-stability | designed | component/graph-hover-stability-001.md | [REL, CONF] | implemented (verified 100%) |
| COMP-EXPLORER-TREE-001 | explorer-tree | designed | component/explorer-tree-001.md | [CONF, REL, CAP] | implemented (M0-M1-M2-M3 complete) |
| COMP-EDITOR-EMPTY-DOC-001 | editor-empty-doc | designed | component/editor-empty-doc-001.md | [REL, CONF] | implemented (verified 100%) |
| COMP-EXPLORER-PANEL-SEARCH-001 | explorer-panel-search | designed | component/explorer-panel-search-removal-001.md | [CONF] | implemented (verified 100%) |
| COMP-GRAPH-CONSISTENCY-001 | graph-consistency | designed | component/graph-consistency-001.md | [REL, CONF] | implemented (verified 100%) |
| COMP-EXPLORER-ICON-ACTIONS-001 | explorer-icon-actions | designed | component/explorer-icon-only-actions-001.md | [CONF] | implemented (verified 100%) |

## Interfaces

| Spec ID      | Name           | Source    | Path                | Concerns | Status |
| ------------ | -------------- | --------- | ------------------- | -------- | ------ |
| IF-TAURI-001 | Tauri Commands | extracted | See component specs | [REL]    | active |

## Concerns Legend

- **SEC**: Security - authentication, authorization, encryption boundaries
- **REL**: Reliability - error handling, persistence, consistency
- **CAP**: Capacity - performance, resource limits, scalability
- **OBS**: Observability - logging, metrics, tracing

## Directory Structure

```
docs/specs/
├── extracted/           # Machine-generated specs (bk-analyze)
│   ├── vault-001.md
│   ├── note-001.md
│   ├── search-001.md
│   ├── graph-001.md
│   ├── markdown-001.md
│   ├── database-001.md
│   └── frontend-001.md
├── component/           # Human-designed component specs (bk-design)
├── interface/           # Human-designed interface specs (bk-design)
└── system/
    └── spec-map.md      # This file
```

## Extraction Metadata

- **Tool**: bk-analyze skill
- **Date**: 2026-02-19
- **Depth**: standard
- **Codebase Lines**: ~4000 (Rust + TypeScript)
- **Total Specs Generated**: 7
- **High Confidence Requirements**: ~85%
- **Uncertainties Flagged**: 15

## Next Steps

1. Review medium/low confidence requirements
2. Address flagged uncertainties
3. Add missing acceptance criteria
4. Transition extracted specs to designed specs as they stabilize
5. Maintain SPEC marker coverage as frontend scope evolves

## Change Log

| Date       | Action                           | Specs Affected  |
| ---------- | -------------------------------- | --------------- |
| 2026-02-19 | Initial extraction from codebase | All COMP-\*-001 |
| 2026-02-19 | Implement Graph UI component     | COMP-GRAPH-UI-001 |
| 2026-02-20 | Add frontend toolchain modernization spec | COMP-TOOLCHAIN-001 |
| 2026-02-20 | Implement and verify frontend toolchain modernization | COMP-TOOLCHAIN-001 |
| 2026-02-20 | Implement Search UI component     | COMP-SEARCH-UI-001 |
| 2026-02-20 | Implement Tag Extraction component | COMP-TAG-EXTRACTION-001 |
| 2026-02-20 | Add compliance fixes spec and plan | COMP-COMPLIANCE-001 |
| 2026-02-20 | Verify compliance fixes implementation | COMP-COMPLIANCE-001 |
| 2026-02-20 | Add lint cleanup spec and plan | COMP-LINT-001 |
| 2026-02-20 | Verify lint cleanup implementation | COMP-LINT-001 |
| 2026-02-20 | Add lightweight traceability policy + hook | COMP-TRACE-LITE-001 |
| 2026-02-20 | Document editor reading refresh and verification | COMP-EDITOR-READING-001 |
| 2026-02-20 | Add left-pane collapse recovery guard and verification | COMP-LAYOUT-RECOVERY-001 |
| 2026-02-20 | Add icon-first common chrome and label preference | COMP-ICON-CHROME-001 |
| 2026-02-20 | Fix graph node hover transform instability | COMP-GRAPH-HOVER-001 |
| 2026-02-20 | Design explorer tree navigation with backend metadata persistence | COMP-EXPLORER-TREE-001 |
| 2026-02-20 | Implement explorer tree M0 read model and sidebar rendering | COMP-EXPLORER-TREE-001 |
| 2026-02-20 | Implement explorer tree M1 context actions and optimistic rollback | COMP-EXPLORER-TREE-001 |
| 2026-02-20 | Implement explorer tree M2 watcher event reconciliation | COMP-EXPLORER-TREE-001 |
| 2026-02-20 | Implement explorer tree M3 accessibility and hidden-path hardening | COMP-EXPLORER-TREE-001 |
| 2026-02-20 | Fix editor crash on empty note content parse | COMP-EDITOR-EMPTY-DOC-001 |
| 2026-02-20 | Remove search box from Notes/Explorer panel | COMP-EXPLORER-PANEL-SEARCH-001 |
| 2026-02-20 | Add graph consistency and selection-sync bugfix spec | COMP-GRAPH-CONSISTENCY-001 |
| 2026-02-20 | Implement and verify graph consistency and selection-sync fixes | COMP-GRAPH-CONSISTENCY-001 |
| 2026-02-20 | Add graph link-target alias resolution follow-up fix and verification | COMP-GRAPH-CONSISTENCY-001 |
| 2026-02-20 | Add disconnected-node discoverability layout refinement and verification | COMP-GRAPH-CONSISTENCY-001 |
| 2026-02-20 | Remove textual + New Note control; keep explorer icon-only actions | COMP-EXPLORER-ICON-ACTIONS-001 |
