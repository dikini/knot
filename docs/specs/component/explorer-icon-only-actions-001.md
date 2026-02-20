# Component Spec: Explorer Icon-Only Actions

Spec-ID: COMP-EXPLORER-ICON-ACTIONS-001
Change-Type: design-update
Trace: DESIGN-explorer-icon-only-actions
Date: 2026-02-20

## Purpose
Keep Notes/Explorer actions icon-first by removing the redundant textual `+ New Note` button.

## Functional Requirements
- FR-1: Explorer header must expose note/folder actions via icon buttons only.
- FR-2: Creating a root note remains available through the existing `New Note` icon action.

## Acceptance Criteria
- AC-1: Sidebar does not render the textual `+ New Note` button.
- AC-2: `New Note` icon button remains visible and triggers root note creation flow.
