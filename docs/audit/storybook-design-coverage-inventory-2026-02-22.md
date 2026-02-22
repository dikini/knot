# Storybook Design Coverage Inventory

Trace: `DESIGN-storybook-design-coverage-inventory-2026-02-22`
Date: `2026-02-22`
Scope: implemented component specs in `docs/specs/component/` vs current Storybook stories in `src/components/**/*.stories.tsx`

## Current Storybook Inventory

Story files present:
- `src/App.stories.tsx`
- `src/components/Editor/Editor.stories.tsx`
- `src/components/GraphView/GraphContextPanel.stories.tsx`
- `src/components/GraphView/GraphView.stories.tsx`
- `src/components/IconButton/IconButton.stories.tsx`
- `src/components/SearchBox/SearchBox.stories.tsx`
- `src/components/Shell/ContextPanel.stories.tsx`
- `src/components/Shell/InspectorRail.stories.tsx`
- `src/components/Shell/ToolRail.stories.tsx`
- `src/components/Sidebar/Sidebar.stories.tsx`
- `src/components/VaultSwitcher/VaultSwitcher.stories.tsx`
- `src/lib/noteMetadataFidelity.stories.tsx`
- `src/lib/vaultSwitchGuard.stories.tsx`
- `src/lib/windowControls.stories.tsx`

Story exports present (58):
- App/Shell: `NoVaultOpen`, `VaultOpenNoNoteSelected`, `EditorActive`, `GraphActive`, `NoCustomWindowControlButtons`
- Editor: `NoNoteSelected`, `EditModeDefault`, `SourceModeRoundTrip`, `EditModeBlockMenu`, `SourceModeEmptyDocument`, `ReferenceMarkdownRoundTrip`, `ViewModeWithMermaid`, `ViewModeWithMermaidVariants`, `MermaidInsertInsideInlinePreservesMarks`
- Graph/GraphView: `VaultScopeDefault`, `HoverHighlightsConnectedEdges`, `NodeScopeWithoutCenter`, `ResetAfterZoom`, `NodeScopeDepthTwo`, `DuplicateLabelDisambiguation`, `DisconnectedNodeDiscoverability`, `ControlledSelectionFromShellState`, `EmptyGraph`, `ErrorState`
- Graph/GraphContextPanel: `SelectedNodeDetails`, `NoNodeSelected`, `NodeScopeDepthControls`, `RelationSelection`, `ActiveRelationHighlight`
- IconButton: `Default`, `IconOnly`, `Active`
- SearchBox: `FocusedEmptyState`, `QueryWithResults`, `NoResults`
- ContextPanel: `NotesMode`, `SearchMode`, `GraphMode`
- InspectorRail: `OpenWithContent`, `Closed`, `CloseAction`
- ToolRail: `Compact`, `WithLabels`
- Sidebar: `NoVaultOpen`, `ExplorerTreeLoaded`, `KeyboardFolderToggle`, `DirtySwitchSavesBeforeOpen`, `ExplorerContextMenuCreateNote`, `IconOnlyActionAffordances`, `ExplorerPanelHasNoSearchBox`
- VaultSwitcher: `WithCurrentVault`, `NoVaultOpen`
- VaultSwitchGuard: `SaveAndProceed`, `DiscardAndProceed`, `SaveFails`
- Data/NoteMetadataFidelity: `BacklinkTitlesAndHeadingOffsets`
- Infra/WindowStartupControls: `BrowserNoop`, `TauriEventEmit`

## Coverage Rules

- `covered`: implemented spec has direct Storybook representation with documented behavior states and interaction coverage.
- `partial`: some visual/state representation exists, but behavior or spec coverage is incomplete.
- `missing`: no direct story coverage for the implemented design.
- `n/a`: non-UI/backend/process-only spec that does not require Storybook component stories.

Note: many stories now include `play` interactions. Remaining gap to full `covered` is explicit spec-id documentation linkage and full edge-state breadth for some specs.

## Spec Coverage Matrix (Implemented Specs)

### UI-facing specs

| Spec ID | Status | Evidence | Gap |
| --- | --- | --- | --- |
| `COMP-ICON-CHROME-001` | partial | `IconButton.stories.tsx` | Add docs + interaction checks for icon-first chrome policies across shell surfaces |
| `COMP-TOOL-RAIL-CONTEXT-001` | partial | `ToolRail.stories.tsx`, `ContextPanel.stories.tsx` | Add toggle semantics/play tests and persisted-state examples |
| `COMP-VAULT-UI-001` | partial | `VaultSwitcher.stories.tsx` | Add dialog/open/create/recent interaction documentation and edge states |
| `COMP-VAULT-SWITCH-UX-001` | partial | `vaultSwitchGuard.stories.tsx`, `App.stories.tsx` | Add end-to-end in-app vault switch prompt story tied to actual actions |
| `COMP-VAULT-UNSAVED-001` | partial | `vaultSwitchGuard.stories.tsx` | Add direct app-level unsaved warning story coverage |
| `COMP-UI-LAYOUT-002` | partial | `App.stories.tsx` | Add fuller adaptive-density and collapsed-panel layout variants |
| `COMP-NOTE-SEL-001` | partial | `Sidebar.stories.tsx` | Add explicit note-open and dirty-switch assertions |
| `COMP-SEARCH-UI-001` | partial | `SearchBox.stories.tsx` | Add keyboard arrow navigation + enter-select story assertions |
| `COMP-GRAPH-UI-001` | partial | `GraphView.stories.tsx` | Add pan/zoom reset interaction assertions |
| `COMP-GRAPH-MODES-002` | partial | `GraphView.stories.tsx`, `GraphContextPanel.stories.tsx` | Add full mode transition continuity from App shell |
| `COMP-GRAPH-UI-CONTINUITY-003` | partial | `App.stories.tsx`, `GraphView.stories.tsx` | Add explicit continuity/persisted toggle contract stories |
| `COMP-GRAPH-HOVER-001` | partial | `GraphView.stories.tsx` | Add graph hover + pointer-transition assertions for multi-hop graphs |
| `COMP-GRAPH-CONSISTENCY-001` | partial | `GraphView.stories.tsx` | Add disconnected-node discoverability assertions |
| `COMP-EXPLORER-TREE-001` | partial | `Sidebar.stories.tsx` | Add context-menu actions and optimistic rollback scenarios |
| `COMP-EXPLORER-ICON-ACTIONS-001` | partial | `Sidebar.stories.tsx` | Add click-action assertions for icon-only actions |
| `COMP-EXPLORER-PANEL-SEARCH-001` | covered | `Sidebar.stories.tsx` | None |
| `COMP-EDITOR-MODES-001` | partial | `Editor.stories.tsx` | Add floating toolbar/block-menu interaction stories |
| `COMP-EDITOR-WYSIWYM-002` | partial | `Editor.stories.tsx` | Add heading-marker suppression and Enter stability explicit stories |
| `COMP-EDITOR-READING-001` | partial | `Editor.stories.tsx` | Add dedicated reading-focused story state documentation |
| `COMP-EDITOR-EMPTY-DOC-001` | partial | `Editor.stories.tsx` | Add explicit empty-doc fixture story |
| `COMP-MARKDOWN-ENGINE-001` | partial | `Editor.stories.tsx` | Add reference-link and round-trip fixture stories |
| `COMP-MERMAID-001` | partial | `Editor.stories.tsx` | Add additional diagram-type rendering stories |
| `COMP-MERMAID-INLINE-SPLIT-001` | partial | `Editor.stories.tsx` | Add emphasis/code/link-specific inline insertion variants |
| `COMP-NOTE-METADATA-001` | partial | `noteMetadataFidelity.stories.tsx` | Add app-surface presentation story once metadata UI is introduced |
| `COMP-LAYOUT-RECOVERY-001` | partial | `App.stories.tsx` | Add explicit recovery regression scenario stories |
| `COMP-WINDOW-STARTUP-003` | partial | `windowControls.stories.tsx`, `App.stories.tsx` | Add fallback-timeout behavior evidence from backend lane |

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
- UI-facing specs missing or partial story coverage: `22`
- UI-facing specs fully covered: `0`
- Existing story files: `14`

Primary blockers to "comprehensive design docs in Storybook":
1. Several specs are only partially covered and need deeper edge-state stories.
2. Explicit spec-id documentation linkage inside story docs is still incomplete.
3. Backend fallback-timeout evidence (`COMP-WINDOW-STARTUP-003`) still depends on non-Storybook verification lane.

## Prioritized Gap Queue

1. Add additional inline-mark variants for `COMP-MERMAID-INLINE-SPLIT-001` (emphasis/code/link).
2. Add backend-lane evidence link for startup fallback timeout in Storybook docs for `COMP-WINDOW-STARTUP-003`.
3. Attach explicit spec-id docs annotations inside stories for full `covered` status.

## Recommended Next Step

Create a new execution spec/plan for Storybook coverage closure (spec-to-story trace matrix + required play interactions), then implement in phased story packages (Editor, Sidebar, Graph, Shell).
