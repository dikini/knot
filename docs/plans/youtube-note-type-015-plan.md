# Implementation Plan: YouTube Note Type

## Metadata
- Spec: `docs/specs/component/youtube-note-type-015.md`
- Generated: `2026-03-02`
- Approach: `sequential`

## Summary
- Total tasks: `5`
- Critical path: `YT-001 -> YT-002 -> YT-003 -> YT-004 -> YT-005`

## Tasks

| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| YT-001 | Add failing backend and frontend tests for YouTube note typing, creation, and rendering | M | - | FR-1 through FR-12 |
| YT-002 | Implement backend YouTube import pipeline and `.youtube.md` note-type resolution | L | YT-001 | FR-1, FR-5, FR-6, FR-7, FR-10, FR-11 |
| YT-003 | Add Tauri/API command wiring for YouTube note creation in embedded and daemon paths | M | YT-002 | FR-3, FR-4, FR-11 |
| YT-004 | Implement sidebar URL creation, external URL drop import, and editor rendering for YouTube notes | L | YT-003 | FR-2, FR-3, FR-4, FR-8, FR-9, FR-10 |
| YT-005 | Run targeted verification and publish audit artifact updates | S | YT-004 | FR-1 through FR-12 |

## Concern Coverage

| Concern | Tasks | Verification |
| --- | --- | --- |
| REL | YT-001, YT-002, YT-003, YT-005 | Typed import failures and regression tests |
| CONF | YT-001, YT-004, YT-005 | Mode-specific rendering assertions |
| COMP | YT-002, YT-003, YT-005 | Note-type and payload compatibility checks |
| CAP | YT-002, YT-004, YT-005 | No-download import path and plain-markdown transcript storage |
