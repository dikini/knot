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

Story exports present (83):

- App/Shell: `NoVaultOpen`, `VaultOpenNoNoteSelected`, `EditorActive`, `GraphActive`, `AdaptiveLayoutRecovery`, `NoCustomWindowControlButtons`, `OpenVaultErrorToast`, `OpenRecentVaultSuccess`, `SearchModeSelectResult`, `HydratesPersistedShellAndView`
- Editor: `NoNoteSelected`, `EditModeDefault`, `SourceModeRoundTrip`, `EditModeBlockMenu`, `SourceModeEmptyDocument`, `ReferenceMarkdownRoundTrip`, `ViewModeWithMermaid`, `ViewModeWithMermaidVariants`, `MermaidInsertInsideInlinePreservesMarks`, `MermaidInsertInsideEmphasisPreservesMarks`, `MermaidInsertInsideCodePreservesMarks`, `MermaidInsertInsideLinkPreservesMarks`, `BlockMenuKeyboardNavigation`, `PersistsNoteScopedModeSelection`, `SaveFailureShowsAlert`, `SaveViaKeyboardShortcut`, `SaveViaCustomEvent`, `ViewModeInternalMarkdownLinkLoadsNote`, `WikilinkEventCreatesMissingNote`
- Graph/GraphView: `VaultScopeDefault`, `HoverHighlightsConnectedEdges`, `NodeScopeWithoutCenter`, `ResetAfterZoom`, `NodeScopeDepthTwo`, `DuplicateLabelDisambiguation`, `DisconnectedNodeDiscoverability`, `ControlledSelectionFromShellState`, `EmptyGraph`, `ErrorState`
- Graph/GraphContextPanel: `SelectedNodeDetails`, `NoNodeSelected`, `NodeScopeDepthControls`, `RelationSelection`, `ActiveRelationHighlight`
- IconButton: `Default`, `IconOnly`, `Active`
- SearchBox: `FocusedEmptyState`, `QueryWithResults`, `KeyboardSelectFirstResult`, `NoResults`
- ContextPanel: `NotesMode`, `SearchMode`, `GraphMode`, `Collapsed`
- InspectorRail: `OpenWithContent`, `Closed`, `CloseAction`
- ToolRail: `Compact`, `WithLabels`, `ModeSwitchInteraction`, `SettingsAction`
- Sidebar: `NoVaultOpen`, `ExplorerTreeLoaded`, `KeyboardFolderToggle`, `DirtySwitchSavesBeforeOpen`, `ExplorerContextMenuCreateNote`, `IconOnlyActionAffordances`, `ExplorerPanelHasNoSearchBox`, `ExplorerToolbarCreateFolderAndToggleAll`, `ExplorerContextMenuRenameAndDeleteFolder`, `ExplorerOperationFailureShowsAlert`
- VaultSwitcher: `WithCurrentVault`, `NoVaultOpen`, `OpenCreateAndRecentActions`, `CloseVaultAction`, `CloseDisabledWithoutVault`
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

| Spec ID                          | Status  | Evidence                                                                                                             | Gap  |
| -------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------- | ---- |
| `COMP-ICON-CHROME-001`           | covered | `IconButton.stories.tsx`, `ToolRail.stories.tsx`, `App.stories.tsx`                                                  | None |
| `COMP-TOOL-RAIL-CONTEXT-001`     | covered | `ToolRail.stories.tsx`, `ContextPanel.stories.tsx`                                                                   | None |
| `COMP-VAULT-UI-001`              | covered | `VaultSwitcher.stories.tsx`                                                                                          | None |
| `COMP-VAULT-SWITCH-UX-001`       | covered | `vaultSwitchGuard.stories.tsx`, `App.stories.tsx`                                                                    | None |
| `COMP-VAULT-UNSAVED-001`         | covered | `vaultSwitchGuard.stories.tsx`, `Sidebar.stories.tsx`                                                                | None |
| `COMP-UI-LAYOUT-002`             | covered | `App.stories.tsx`                                                                                                    | None |
| `COMP-NOTE-SEL-001`              | covered | `Sidebar.stories.tsx`                                                                                                | None |
| `COMP-SEARCH-UI-001`             | covered | `SearchBox.stories.tsx`                                                                                              | None |
| `COMP-GRAPH-UI-001`              | covered | `GraphView.stories.tsx`                                                                                              | None |
| `COMP-GRAPH-MODES-002`           | covered | `GraphView.stories.tsx`, `GraphContextPanel.stories.tsx`, `App.stories.tsx`                                          | None |
| `COMP-GRAPH-UI-CONTINUITY-003`   | covered | `App.stories.tsx`, `GraphView.stories.tsx`                                                                           | None |
| `COMP-GRAPH-HOVER-001`           | covered | `GraphView.stories.tsx`                                                                                              | None |
| `COMP-GRAPH-CONSISTENCY-001`     | covered | `GraphView.stories.tsx`                                                                                              | None |
| `COMP-EXPLORER-TREE-001`         | covered | `Sidebar.stories.tsx`                                                                                                | None |
| `COMP-EXPLORER-ICON-ACTIONS-001` | covered | `Sidebar.stories.tsx`                                                                                                | None |
| `COMP-EXPLORER-PANEL-SEARCH-001` | covered | `Sidebar.stories.tsx`                                                                                                | None |
| `COMP-EDITOR-MODES-001`          | covered | `Editor.stories.tsx`                                                                                                 | None |
| `COMP-EDITOR-WYSIWYM-002`        | covered | `Editor.stories.tsx`                                                                                                 | None |
| `COMP-EDITOR-READING-001`        | covered | `Editor.stories.tsx`                                                                                                 | None |
| `COMP-EDITOR-EMPTY-DOC-001`      | covered | `Editor.stories.tsx`                                                                                                 | None |
| `COMP-MARKDOWN-ENGINE-001`       | covered | `Editor.stories.tsx`                                                                                                 | None |
| `COMP-MERMAID-001`               | covered | `Editor.stories.tsx`                                                                                                 | None |
| `COMP-MERMAID-INLINE-SPLIT-001`  | covered | `Editor.stories.tsx`                                                                                                 | None |
| `COMP-NOTE-METADATA-001`         | covered | `noteMetadataFidelity.stories.tsx`                                                                                   | None |
| `COMP-LAYOUT-RECOVERY-001`       | covered | `App.stories.tsx`                                                                                                    | None |
| `COMP-WINDOW-STARTUP-003`        | covered | `windowControls.stories.tsx`, `App.stories.tsx`, `docs/audit/window-startup-controls-003-verification-2026-02-21.md` | None |

### Process/tooling specs (Storybook stories not primary artifact)

| Spec ID                     | Status  | Notes                                                                                                                        |
| --------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------- | ---- |
| `COMP-STORYBOOK-DX-001`     | covered | Storybook scaffold + CI + MCP path implemented                                                                               |
| `COMP-UI-QA-DX-001`         | covered | `scripts/validate-storybook-coverage-matrix.mjs`, `.github/workflows/ui-quality.yml`, `package.json` (`qa:storybook-matrix`) | None |
| `COMP-UI-AUTOMATION-DX-001` | n/a     | Browser/native test lanes, not a story surface                                                                               |
| `COMP-TOOLCHAIN-001`        | n/a     | Frontend toolchain modernization                                                                                             |
| `COMP-COMPLIANCE-001`       | n/a     | Compliance fixes scope                                                                                                       |
| `COMP-LINT-001`             | n/a     | Lint cleanup scope                                                                                                           |
| `COMP-TRACE-LITE-001`       | n/a     | Traceability policy scope                                                                                                    |

### Backend/non-UI specs (Storybook N/A)

| Spec ID                   | Status | Notes                           |
| ------------------------- | ------ | ------------------------------- |
| `COMP-CONTENT-LOAD-001`   | n/a    | Backend content loading         |
| `COMP-FILE-WATCH-001`     | n/a    | Watcher lifecycle/sync          |
| `COMP-TAG-EXTRACTION-001` | n/a    | Backend markdown tag extraction |
| `COMP-MCP-SERVER-001`     | n/a    | MCP server tools/resources      |
| `COMP-MCP-SERVER-002`     | n/a    | MCP mutation/directory tools    |

## Gap Summary

Trace: `DESIGN-storybook-audit-summary-adjustment-2026-02-22`

- Implemented component specs assessed: `38`
- UI-facing specs missing or partial story coverage: `0`
- UI-facing specs fully covered: `26`
- Existing story files: `14`

Primary blockers to "comprehensive design docs in Storybook":

1. UI-facing coverage is complete for currently implemented component specs.
2. Process-level Storybook enforcement is now CI-gated via `qa:storybook-matrix`.

## Prioritized Gap Queue

Trace: `DESIGN-storybook-partial-closure-2026-02-22`

1. Keep inventory synchronized as new specs are implemented.

## Recommended Next Step

Maintain the `qa:storybook-matrix` check as a required CI gate and extend it when new inventory fields are introduced.
