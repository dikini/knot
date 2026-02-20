# Explorer Tree Design

Date: 2026-02-20
Change-Type: design-update
Trace: DESIGN-explorer-tree-navigation
Scope: Notes pane tree navigation with backend metadata persistence and watcher signaling

## Goals
- Replace flat notes list with folder+note tree.
- Show empty folders.
- Persist expansion state in backend vault metadata.
- Support context menu and top icon actions.
- Keep UX responsive via optimistic updates with rollback.

## Chosen Approach
Backend-first contract with phased frontend rollout:
1. M0 read model and rendering.
2. M1 CRUD actions with optimistic state.
3. M2 event-driven reconciliation over watcher signaling.
4. M3 keyboard/a11y hardening and polish.

## Data Model
- `ExplorerFolderNode`
  - `path`, `name`, `folders[]`, `notes[]`, `expanded`
- `ExplorerNoteNode`
  - `path`, `title`, `display_title`, `modified_at`, `word_count`
- `ExplorerTreePayload`
  - `root`, `hidden_policy`, `version`

## UX Rules
- Folder click toggles only.
- Note click opens note.
- Notes sorted by `display_title` (metadata title; fallback filename stem).
- Hidden entries excluded by default.
- Restore expansion from metadata; fallback to top-level expanded/deeper collapsed.

## Eventing + Reliability
- Primary: backend emits `vault://tree-changed`.
- Secondary: existing `sync_external_changes` polling.
- Conflict: optimistic state reconciles against authoritative backend subtree/full refresh.

## Actions
- Row context menu:
  - Folder: new note, new folder, rename, delete.
  - Note: rename, delete.
- Top icons:
  - new note, new folder, collapse/expand, refresh.

## Risks
- Race between optimistic actions and external watcher events.
- Rename/move semantics for non-empty folders.
- Metadata migration for existing vault config files.

## Mitigations
- Versioned payloads and idempotent reconcile.
- Explicit rollback pathway on failed mutation.
- Config fields with serde defaults for backwards compatibility.
