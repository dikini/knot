# Component Spec: Explorer Tree Navigation

Spec-ID: COMP-EXPLORER-TREE-001
Change-Type: design-update
Trace: DESIGN-explorer-tree-navigation
Date: 2026-02-20

## Purpose
Replace the flat notes list with a filesystem-aware explorer tree that shows folders and notes, supports empty folders, and persists folder expansion state in vault metadata.

## Functional Requirements
- FR-1: Notes pane MUST render a tree with folders and note leaves.
- FR-2: Tree MUST include empty folders from the vault filesystem.
- FR-3: Folder row click MUST toggle expand/collapse only.
- FR-4: Note row click MUST open the selected note.
- FR-5: Expanded/collapsed state MUST persist in backend vault metadata (per vault).
- FR-6: On first load without saved state, fallback behavior MUST expand top-level folders and collapse deeper levels.
- FR-7: Notes in a folder MUST be sorted by displayed title (metadata title), with filename stem fallback when title is empty.
- FR-8: Folder and note actions MUST be exposed via context menu and top-pane icon actions.
- FR-9: UI updates MUST be optimistic for user actions and rollback on backend failure.
- FR-10: Backend watcher changes SHOULD be pushed to UI via events and reconciled with optimistic state.
- FR-11: Poll-based sync MUST remain as a reliability fallback when push events are unavailable or delayed.
- FR-12: Hidden files/folders MUST be hidden by default.
- FR-13: Tree MUST provide keyboard navigation and ARIA tree semantics.

## Design Decisions
- DD-1: Backend-first tree contract (`get_explorer_tree`) is authoritative; frontend does not infer empty folders from note paths.
- DD-2: Expansion state is stored in vault metadata/config, not browser localStorage.
- DD-3: Event-driven updates are layered over existing polling; polling remains a fallback safety net.
- DD-4: Full feature scope is specified now, implementation is phased (M0-M3).

## API/Contract Additions
- `get_explorer_tree() -> ExplorerTreePayload`
- `set_folder_expanded(path, expanded)`
- `create_directory(path)`
- `rename_directory(old_path, new_path)`
- `delete_directory(path, recursive)`
- Event channel: `vault://tree-changed` with typed change payloads.

## Acceptance Criteria
- AC-1: Opening a vault shows folder hierarchy and notes, including empty folders.
- AC-2: Folder expansion state is restored after app restart and vault reopen.
- AC-3: When expansion state is absent, top-level folders are expanded and deeper folders are collapsed.
- AC-4: Context menu actions exist for folder and note rows; top icon actions exist for quick operations.
- AC-5: Optimistic updates visibly apply immediately and rollback correctly when backend returns errors.
- AC-6: External filesystem changes are reflected in the explorer via events or polling fallback.
- AC-7: Keyboard tree navigation and ARIA roles/attributes are present and tested.
