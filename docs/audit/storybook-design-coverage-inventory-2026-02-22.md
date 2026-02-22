# Storybook Design Coverage Inventory

Trace: `DESIGN-storybook-design-coverage-inventory-2026-02-22`
Date: `2026-02-22`
Scope: implemented component specs in `docs/specs/component/` vs current Storybook stories in `src/components/**/*.stories.tsx`

## Current Storybook Inventory

Story files present:
- `src/components/IconButton/IconButton.stories.tsx`
- `src/components/Shell/ContextPanel.stories.tsx`
- `src/components/Shell/ToolRail.stories.tsx`
- `src/components/VaultSwitcher/VaultSwitcher.stories.tsx`

Story exports present (10):
- IconButton: `Default`, `IconOnly`, `Active`
- ContextPanel: `NotesMode`, `SearchMode`, `GraphMode`
- ToolRail: `Compact`, `WithLabels`
- VaultSwitcher: `WithCurrentVault`, `NoVaultOpen`

## Coverage Rules

- `covered`: implemented spec has direct Storybook representation with documented behavior states and interaction coverage.
- `partial`: some visual/state representation exists, but behavior or spec coverage is incomplete.
- `missing`: no direct story coverage for the implemented design.
- `n/a`: non-UI/backend/process-only spec that does not require Storybook component stories.

Note: current stories do not include `play` interactions or explicit spec-id documentation blocks, so no UI spec currently qualifies as fully `covered`.

## Spec Coverage Matrix (Implemented Specs)

### UI-facing specs

| Spec ID | Status | Evidence | Gap |
| --- | --- | --- | --- |
| `COMP-ICON-CHROME-001` | partial | `IconButton.stories.tsx` | Add docs + interaction checks for icon-first chrome policies across shell surfaces |
| `COMP-TOOL-RAIL-CONTEXT-001` | partial | `ToolRail.stories.tsx`, `ContextPanel.stories.tsx` | Add toggle semantics/play tests and persisted-state examples |
| `COMP-VAULT-UI-001` | partial | `VaultSwitcher.stories.tsx` | Add dialog/open/create/recent interaction documentation and edge states |
| `COMP-VAULT-SWITCH-UX-001` | missing | no dedicated story | Add unsaved-switch flow stories (save/discard/cancel) |
| `COMP-VAULT-UNSAVED-001` | missing | no dedicated story | Add unsaved state prompt scenarios |
| `COMP-UI-LAYOUT-002` | missing | no app-shell story | Add layout stories for no-vault / empty-state / note-open |
| `COMP-NOTE-SEL-001` | missing | no sidebar selection stories | Add note selection and dirty-guard stories |
| `COMP-SEARCH-UI-001` | missing | no `SearchBox` stories | Add query states, keyboard nav, result selection stories |
| `COMP-GRAPH-UI-001` | missing | no `GraphView` stories | Add graph rendering, node select, focus states |
| `COMP-GRAPH-MODES-002` | missing | no graph-mode stories | Add vault/node mode and depth-control stories |
| `COMP-GRAPH-UI-CONTINUITY-003` | missing | no continuity stories | Add toggle continuity and state preservation stories |
| `COMP-GRAPH-HOVER-001` | missing | no hover-specific stories | Add hover stability visual/interaction stories |
| `COMP-GRAPH-CONSISTENCY-001` | missing | no consistency stories | Add disconnected nodes + duplicate-label cases |
| `COMP-EXPLORER-TREE-001` | missing | no explorer tree stories | Add folder/note tree states + keyboard nav |
| `COMP-EXPLORER-ICON-ACTIONS-001` | missing | no explorer icon-action stories | Add icon-only action states and affordances |
| `COMP-EXPLORER-PANEL-SEARCH-001` | missing | no explorer-panel stories | Add search-removed panel state docs |
| `COMP-EDITOR-MODES-001` | missing | no editor mode stories | Add source/edit/view mode stories with controls |
| `COMP-EDITOR-WYSIWYM-002` | missing | no wysiwym fix stories | Add toolbar distinction + paragraph behavior stories |
| `COMP-EDITOR-READING-001` | missing | no reading-mode stories | Add reading surface and transition stories |
| `COMP-EDITOR-EMPTY-DOC-001` | missing | no empty-doc story | Add empty note safety rendering story |
| `COMP-MARKDOWN-ENGINE-001` | missing | no markdown-engine behavior stories | Add parsing/serialization examples in docs stories |
| `COMP-MERMAID-001` | missing | no mermaid stories | Add diagram render/insert stories for multiple diagram types |
| `COMP-MERMAID-INLINE-SPLIT-001` | missing | no regression story | Add inline-split regression story |
| `COMP-NOTE-METADATA-001` | missing | no metadata stories | Add backlink title + heading-position display stories |
| `COMP-LAYOUT-RECOVERY-001` | missing | no recovery stories | Add pane collapse recovery stories |
| `COMP-WINDOW-STARTUP-003` | missing | no startup/window control stories | Add startup ready-state and window controls stories |

### Process/tooling specs (Storybook stories not primary artifact)

| Spec ID | Status | Notes |
| --- | --- | --- |
| `COMP-STORYBOOK-DX-001` | covered | Storybook scaffold + CI + MCP path implemented |
| `COMP-UI-QA-DX-001` | partial | Storybook exists, but spec->story coverage enforcement matrix not yet complete |
| `COMP-UI-AUTOMATION-DX-001` | n/a | Browser/native test lanes, not a story surface |
| `COMP-TOOLCHAIN-001` | n/a | Frontend toolchain modernization |
| `COMP-COMPLIANCE-001` | n/a | Compliance fixes scope |
| `COMP-LINT-001` | n/a | Lint cleanup scope |
| `COMP-TRACE-LITE-001` | n/a | Traceability policy scope |

### Backend/non-UI specs (Storybook N/A)

| Spec ID | Status | Notes |
| --- | --- | --- |
| `COMP-CONTENT-LOAD-001` | n/a | Backend content loading |
| `COMP-FILE-WATCH-001` | n/a | Watcher lifecycle/sync |
| `COMP-TAG-EXTRACTION-001` | n/a | Backend markdown tag extraction |
| `COMP-MCP-SERVER-001` | n/a | MCP server tools/resources |
| `COMP-MCP-SERVER-002` | n/a | MCP mutation/directory tools |

## Gap Summary

- Implemented component specs assessed: `38`
- UI-facing specs missing or partial story coverage: `26`
- UI-facing specs fully covered: `0`
- Existing baseline story files: `4`

Primary blockers to "comprehensive design docs in Storybook":
1. No stories for major surfaces (`Editor`, `Sidebar`, `SearchBox`, `GraphView`, `App shell`).
2. No interaction `play` coverage in current stories.
3. No explicit spec-id documentation in stories linking behavior contracts back to specs.

## Prioritized Gap Queue

1. `Editor` package stories: `COMP-EDITOR-MODES-001`, `COMP-EDITOR-WYSIWYM-002`, `COMP-EDITOR-READING-001`, `COMP-EDITOR-EMPTY-DOC-001`, `COMP-MARKDOWN-ENGINE-001`, `COMP-MERMAID-001`, `COMP-MERMAID-INLINE-SPLIT-001`.
2. `Sidebar`/explorer/search stories: `COMP-EXPLORER-TREE-001`, `COMP-EXPLORER-ICON-ACTIONS-001`, `COMP-EXPLORER-PANEL-SEARCH-001`, `COMP-SEARCH-UI-001`, `COMP-NOTE-SEL-001`.
3. `Graph` stories: `COMP-GRAPH-UI-001`, `COMP-GRAPH-MODES-002`, `COMP-GRAPH-UI-CONTINUITY-003`, `COMP-GRAPH-HOVER-001`, `COMP-GRAPH-CONSISTENCY-001`, `COMP-NOTE-METADATA-001`.
4. `Shell/App` stories: `COMP-UI-LAYOUT-002`, `COMP-LAYOUT-RECOVERY-001`, `COMP-WINDOW-STARTUP-003`, `COMP-VAULT-UNSAVED-001`, `COMP-VAULT-SWITCH-UX-001` (plus expand `COMP-VAULT-UI-001`).

## Recommended Next Step

Create a new execution spec/plan for Storybook coverage closure (spec-to-story trace matrix + required play interactions), then implement in phased story packages (Editor, Sidebar, Graph, Shell).
