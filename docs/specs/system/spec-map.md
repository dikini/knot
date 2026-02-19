# Knot Specification Registry

This file tracks all specifications in the Knot project. Extracted specs are machine-generated from existing code. Designed specs are human-authored.

## Components

| Spec ID               | Component       | Source    | Path                             | Concerns         | Status                                 |
| --------------------- | --------------- | --------- | -------------------------------- | ---------------- | -------------------------------------- |
| COMP-VAULT-001        | vault           | extracted | extracted/vault-001.md           | [REL, SEC, CAP]  | active                                 |
| COMP-NOTE-001         | note            | extracted | extracted/note-001.md            | [REL, CAP]       | active                                 |
| COMP-SEARCH-001       | search          | extracted | extracted/search-001.md          | [CAP, REL]       | active                                 |
| COMP-GRAPH-001        | graph           | extracted | extracted/graph-001.md           | [CAP, REL]       | active                                 |
| COMP-MARKDOWN-001     | markdown        | extracted | extracted/markdown-001.md        | [CAP]            | active                                 |
| COMP-DATABASE-001     | database        | extracted | extracted/database-001.md        | [REL, SEC, CAP]  | active                                 |
| COMP-FRONTEND-001     | frontend        | extracted | extracted/frontend-001.md        | [CAP, REL]       | active                                 |
| COMP-VAULT-UI-001     | vault-ui        | designed  | component/vault-ui-001.md        | [REL, SEC, CONF] | implemented (verified 100%)            |
| COMP-CONTENT-LOAD-001 | content-loading | designed  | component/content-loading-001.md | [REL, SEC]       | implemented (bug fixed, verified 100%) |
| COMP-NOTE-SEL-001     | note-selection  | designed  | component/note-selection-001.md  | [REL, CAP]       | implemented (verified 100%)            |
| COMP-FILE-WATCH-001   | file-watcher    | designed  | component/file-watcher-001.md    | [REL, CONS]      | partial (stub only, verified 25%)      |
| COMP-UI-LAYOUT-002    | ui-layout       | designed  | component/ui-layout-002.md       | [CONF, CAP]      | implemented (all FR complete)          |

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
5. Add SPEC markers to codebase for traceability

## Change Log

| Date       | Action                           | Specs Affected  |
| ---------- | -------------------------------- | --------------- |
| 2026-02-19 | Initial extraction from codebase | All COMP-\*-001 |
