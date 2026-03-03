# Roadmap Index

Roadmap status is a planning view, not the canonical registry.
Canonical component registry: `docs/specs/system/spec-map.md`

| Workstream                           | Scope     | Status      | Owner | Dependencies                                                                    | Target Specs                         |
| ------------------------------------ | --------- | ----------- | ----- | ------------------------------------------------------------------------------- | ------------------------------------ |
| tool-rail-context-001                | component | implemented | -     | []                                                                              | [COMP-TOOL-RAIL-CONTEXT-001]         |
| graph-modes-002                      | component | implemented | -     | []                                                                              | [COMP-GRAPH-MODES-002]               |
| window-startup-controls-003          | component | implemented | -     | []                                                                              | [COMP-WINDOW-STARTUP-003]            |
| markdown-engine-001                  | component | implemented | -     | []                                                                              | [COMP-MARKDOWN-ENGINE-001]           |
| note-metadata-fidelity-001           | component | implemented | -     | []                                                                              | [COMP-NOTE-METADATA-001]             |
| vault-unsaved-changes-001            | component | implemented | -     | []                                                                              | [COMP-VAULT-UNSAVED-001]             |
| vault-switch-ux-001                  | component | implemented | -     | [vault-unsaved-changes-001]                                                     | [COMP-VAULT-SWITCH-UX-001]           |
| mermaid-diagrams-001                 | component | implemented | -     | [markdown-engine-001, editor-modes-001]                                         | [COMP-MERMAID-001]                   |
| ui-automation-dx-001                 | component | implemented | -     | [frontend-toolchain-001]                                                        | [COMP-UI-AUTOMATION-DX-001]          |
| mermaid-inline-split-001             | component | implemented | -     | [mermaid-diagrams-001, editor-modes-001]                                        | [COMP-MERMAID-INLINE-SPLIT-001]      |
| ui-qa-dx-001                         | component | implemented | -     | [ui-automation-dx-001, mermaid-diagrams-001]                                    | [COMP-UI-QA-DX-001]                  |
| storybook-dx-001                     | component | implemented | -     | [ui-qa-dx-001, frontend-toolchain-001]                                          | [COMP-STORYBOOK-DX-001]              |
| authoring-flows-001                  | component | implemented | -     | [explorer-tree-001, editor-wysiwym-002, markdown-engine-001]                    | [COMP-AUTHORING-FLOWS-001]           |
| typecheck-cleanup-002                | component | implemented | codex | [frontend-toolchain-001]                                                        | [COMP-TYPECHECK-CLEANUP-002]         |
| task-list-ui-003                     | component | implemented | codex | [editor-modes-001, markdown-engine-001]                                         | [COMP-TASK-LIST-UI-003]              |
| list-continuation-004                | component | implemented | codex | [authoring-flows-001, task-list-ui-003]                                         | [COMP-LIST-CONTINUATION-004]         |
| editor-history-005                   | component | implemented | codex | [editor-modes-001]                                                              | [COMP-EDITOR-HISTORY-005]            |
| app-keymap-settings-006              | component | implemented | codex | [settings-pane-001, editor-history-005]                                         | [COMP-APP-KEYMAP-006]                |
| managed-shortcuts-007                | component | implemented | codex | [app-keymap-settings-006, tool-rail-context-001, editor-history-005]            | [COMP-MANAGED-SHORTCUTS-007]         |
| math-plugin-008                      | component | implemented | codex | [markdown-engine-001, editor-modes-001, authoring-flows-001]                    | [COMP-MATH-PLUGIN-008]               |
| view-list-styling-009                | component | implemented | codex | [task-list-ui-003, markdown-engine-001]                                         | [COMP-VIEW-LIST-STYLING-009]         |
| note-metadata-frontmatter-011        | component | implemented | codex | [markdown-engine-001, editor-modes-001]                                         | [COMP-NOTE-METADATA-FRONTMATTER-011] |
| ui-automation-runtime-013            | component | implemented | codex | [ui-automation-dx-001, knotd-ui-daemon-010]                                     | [COMP-UI-AUTOMATION-RUNTIME-013]     |
| task-toggle-roundtrip-014            | component | planned     | codex | [task-list-ui-003, ui-automation-runtime-013]                                   | [COMP-TASK-TOGGLE-ROUNDTRIP-014]     |
| youtube-note-type-015                | component | planned     | codex | [note-types-012, authoring-flows-001]                                           | [COMP-YOUTUBE-NOTE-TYPE-015]         |
| pdf-note-type-016                    | component | planned     | codex | [note-types-012, editor-modes-001]                                              | [COMP-PDF-NOTE-TYPE-016]             |
| wikilink-embeds-017                  | component | planned     | codex | [markdown-engine-001, note-types-012, youtube-note-type-015, pdf-note-type-016] | [COMP-WIKILINK-EMBEDS-017]           |
| settings-pane-001                    | component | planned     | -     | [tool-rail-context-001, vault-unsaved-changes-001]                              | [COMP-SETTINGS-PANE-001]             |
| documentation-registry-alignment-020 | component | implemented | codex | [traceability-lite-001, ui-qa-dx-001, storybook-dx-001]                         | [COMP-DOC-REGISTRY-020]              |
| workflow-freshness-hardening-021     | component | implemented | codex | [traceability-lite-001, documentation-registry-alignment-020, ui-qa-dx-001]     | [COMP-WORKFLOW-FRESHNESS-021]        |
| storybook-app-stability-022          | component | implemented | codex | [storybook-dx-001, ui-qa-dx-001, ui-automation-runtime-013]                     | [COMP-STORYBOOK-STABILITY-022]       |
