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
| COMP-FRONTEND-001     | frontend        | extracted | extracted/frontend-001.md        | [CAP, REL]       | active (traceable, verified 100%)      |
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
| COMP-EDITOR-MODES-001 | editor-modes | designed | component/editor-modes-wysiwym-001.md | [CONF, REL] | implemented (M0-M4 verified) |
| COMP-EDITOR-WYSIWYM-002 | editor-wysiwym-fixes | designed | component/editor-wysiwym-002.md | [CONF, REL, CAP] | implemented (verified 100%) |
| COMP-MARKDOWN-ENGINE-001 | markdown-engine | designed | component/markdown-engine-001.md | [REL, COMP, CAP, CONF] | implemented (verified 100%) |
| COMP-MCP-SERVER-001 | mcp-server | designed | component/mcp-server-001.md | [REL, CONF] | implemented (verified 100%) |
| COMP-MCP-SERVER-002 | mcp-server-mutations | designed | component/mcp-server-mutations-002.md | [REL, CONF] | implemented (verified 100%) |
| COMP-TOOL-RAIL-CONTEXT-001 | tool-rail-context-policy | designed | component/tool-rail-context-policy-001.md | [CONF, REL, CAP] | implemented (verified 100%) |
| COMP-GRAPH-MODES-002 | graph-modes | designed | component/graph-modes-002.md | [CONF, REL, CAP] | implemented (verified 100%) |
| COMP-GRAPH-UI-CONTINUITY-003 | graph-ui-continuity | designed | component/graph-ui-continuity-003.md | [CONF, REL, CAP] | implemented (verified 100%) |
| COMP-WINDOW-STARTUP-003 | window-startup-controls | designed | component/window-startup-controls-003.md | [CONF, REL] | implemented (verified 100%) |
| COMP-NOTE-METADATA-001 | note-metadata-fidelity | designed | component/note-metadata-fidelity-001.md | [REL, CONF] | implemented (verified 100%) |
| COMP-VAULT-UNSAVED-001 | vault-unsaved-changes | designed | component/vault-unsaved-changes-001.md | [REL, CONF] | implemented (verified 100%) |
| COMP-VAULT-SWITCH-UX-001 | vault-switch-unsaved-ux | designed | component/vault-switch-ux-001.md | [CONF, REL] | implemented (verified 100%) |
| COMP-MERMAID-001 | mermaid-diagrams | designed | component/mermaid-diagrams-001.md | [REL, SEC, CAP, COMP, CONF] | implemented (verified 100%) |
| COMP-UI-AUTOMATION-DX-001 | ui-automation-dx | designed | component/ui-automation-dx-001.md | [REL, CAP, COMP, CONF] | implemented (verified 100%) |
| COMP-MERMAID-INLINE-SPLIT-001 | mermaid-inline-insert-splitting | designed | component/mermaid-inline-insert-splitting-001.md | [REL, CONF, COMP] | implemented (verified in browser + editor tests) |
| COMP-UI-QA-DX-001 | ui-quality-assurance-dx | designed | component/ui-quality-assurance-dx-001.md | [REL, CONF, COMP, CAP] | implemented (verified with CI gates + docs inventory) |
| COMP-STORYBOOK-DX-001 | storybook-dx | designed | component/storybook-dx-001.md | [CONF, REL, COMP, CAP] | implemented (verified with Storybook build + MCP smoke) |

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
| 2026-02-20 | Explore Medium-like editor interactions and draft mode-based editor spec | COMP-EDITOR-MODES-001 |
| 2026-02-20 | Implement editor modes M0 (source/edit/view framework) and verify | COMP-EDITOR-MODES-001 |
| 2026-02-20 | Implement editor modes M1 (selection floating toolbar) and verify | COMP-EDITOR-MODES-001 |
| 2026-02-20 | Implement editor modes M2 (block inserter + contextual separation) and verify | COMP-EDITOR-MODES-001 |
| 2026-02-20 | Implement editor modes M3 (syntax hardening, control placement, fidelity regression checks) and verify | COMP-EDITOR-MODES-001 |
| 2026-02-20 | Implement editor modes M4 (floating-control keyboard access, focus states, and expanded markdown fidelity checks) and verify | COMP-EDITOR-MODES-001 |
| 2026-02-21 | Define strict edit-mode WYSIWYM, toolbar distinguishability, and Enter paragraph stability fixes | COMP-EDITOR-WYSIWYM-002 |
| 2026-02-21 | Implement and verify strict edit-mode WYSIWYM, toolbar distinguishability, and Enter paragraph stability fixes | COMP-EDITOR-WYSIWYM-002 |
| 2026-02-20 | Design and implement MCP server with core tools and note resources | COMP-MCP-SERVER-001 |
| 2026-02-20 | Extend MCP server with note mutation and directory management tools | COMP-MCP-SERVER-002 |
| 2026-02-21 | Add tool rail and context panel interaction policy for deterministic toggling and future tool classification | COMP-TOOL-RAIL-CONTEXT-001 |
| 2026-02-21 | Implement and verify hybrid tool/context policy with active-tool toggle and zero-trace folded panel | COMP-TOOL-RAIL-CONTEXT-001 |
| 2026-02-21 | Define vault/node graph scopes with bounded local depth controls | COMP-GRAPH-MODES-002 |
| 2026-02-21 | Implement and verify vault/node graph scopes with bounded local depth controls | COMP-GRAPH-MODES-002 |
| 2026-02-21 | Define graph UI continuity and toggle semantics refinement | COMP-GRAPH-UI-CONTINUITY-003 |
| 2026-02-21 | Implement and verify graph UI continuity and toggle semantics refinement | COMP-GRAPH-UI-CONTINUITY-003 |
| 2026-02-21 | Implement startup-ready window reveal and accessible in-app window controls | COMP-WINDOW-STARTUP-003 |
| 2026-02-22 | Draft markdown engine migration spec for prosemirror-markdown + markdown-it and reference links | COMP-MARKDOWN-ENGINE-001 |
| 2026-02-22 | Implement and verify markdown engine migration with next-engine parser/serializer, reference links, and runtime toggle | COMP-MARKDOWN-ENGINE-001 |
| 2026-02-22 | Draft note metadata fidelity spec and plan for backlink titles and heading positions | COMP-NOTE-METADATA-001 |
| 2026-02-22 | Implement and verify note metadata fidelity for backlink titles and heading positions | COMP-NOTE-METADATA-001 |
| 2026-02-22 | Draft vault unsaved-changes guard spec for open-vault replacement flows | COMP-VAULT-UNSAVED-001 |
| 2026-02-22 | Draft implementation plan for vault unsaved-changes guard | COMP-VAULT-UNSAVED-001 |
| 2026-02-22 | Implement and verify vault unsaved-changes guard for vault replacement flows | COMP-VAULT-UNSAVED-001 |
| 2026-02-22 | Draft vault switch unsaved UX guard spec and implementation plan | COMP-VAULT-SWITCH-UX-001 |
| 2026-02-22 | Implement and verify vault switch unsaved UX guard flow in app handlers | COMP-VAULT-SWITCH-UX-001 |
| 2026-02-22 | Draft Mermaid diagrams spec for markdown view rendering and editor insertion | COMP-MERMAID-001 |
| 2026-02-22 | Draft Mermaid diagrams implementation plan and roadmap entry | COMP-MERMAID-001 |
| 2026-02-22 | Implement and verify Mermaid diagram rendering and block insertion workflow | COMP-MERMAID-001 |
| 2026-02-22 | Draft UI automation DX spec and implementation plan for browser lane + native smoke lane | COMP-UI-AUTOMATION-DX-001 |
| 2026-02-22 | Implement and verify UI automation DX lanes (browser-first + tauri-native smoke) and defer protocol-attach as future R&D | COMP-UI-AUTOMATION-DX-001 |
| 2026-02-22 | Document Mermaid inline mark splitting bug and draft fix design (planning deferred) | COMP-MERMAID-INLINE-SPLIT-001 |
| 2026-02-22 | Draft UI QA DX maturity spec for expanded test coverage, reviewable artifacts, and implementation-derived design system docs (planning deferred) | COMP-UI-QA-DX-001 |
| 2026-02-22 | Draft Storybook DX integration spec including DevOps automation, MCP configuration, and skill/process documentation freshness requirements (planning deferred; Penpot out of scope) | COMP-STORYBOOK-DX-001 |
| 2026-02-22 | Start Storybook DX implementation: scaffold Storybook, add baseline stories, add Storybook CI artifact workflow, and document MCP + freshness process | COMP-STORYBOOK-DX-001 |
| 2026-02-22 | Implement Mermaid inline insertion boundary normalization and verify with editor + browser journey tests | COMP-MERMAID-INLINE-SPLIT-001 |
| 2026-02-22 | Start UI QA DX implementation: add journey suite expansion, CI quality workflows, and review-artifact guide | COMP-UI-QA-DX-001 |
| 2026-02-22 | Complete UI QA DX implementation with design-system token/primitive inventories and formal verification policy integration | COMP-UI-QA-DX-001 |
| 2026-02-22 | Complete Storybook DX implementation and mark Storybook workflows/docs as operational | COMP-STORYBOOK-DX-001 |
