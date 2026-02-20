# Component Spec: Explorer Panel Search Removal

Spec-ID: COMP-EXPLORER-PANEL-SEARCH-001
Change-Type: design-update
Trace: DESIGN-explorer-panel-no-search
Date: 2026-02-20

## Purpose
Keep Notes/Explorer focused on tree navigation and remove inline search from that panel.

## Functional Requirements
- FR-1: Notes/Explorer panel MUST NOT render a search box.
- FR-2: Search remains available through the dedicated Search tool mode.

## Acceptance Criteria
- AC-1: Explorer header shows explorer actions and note/folder controls, without search input.
- AC-2: Typecheck, sidebar tests, and lint pass.
