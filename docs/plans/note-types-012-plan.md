# Implementation Plan: Note Type Plugins and Image Notes

Change-Type: design-update
Trace: DESIGN-note-types-012
Spec: `docs/specs/component/note-types-012.md`
Generated: `2026-03-02`
Status: `completed`

## Summary
- Total tasks: 6
- Approach: sequential
- Size: 2 small, 4 medium
- Goal: add a backend note-type registry, image note support, unknown-file fallback handling, and explorer visibility settings without regressing markdown notes.

## Tasks

| ID | Task | Size | Depends | Spec Ref | Status |
| --- | --- | --- | --- | --- | --- |
| NT-001 | Add failing Rust tests for note-type resolution, explorer visibility policies, and typed note loading for markdown/image/unknown files | M | - | FR-1, FR-2, FR-3, FR-4, FR-6, FR-7, FR-10, FR-11 | completed |
| NT-002 | Add failing frontend tests for explorer badges/dim state and editor mode gating for image and unknown notes | M | NT-001 | FR-4, FR-5, FR-8, FR-9 | completed |
| NT-003 | Implement backend note-type registry, typed note contracts, vault loading, and explorer payload updates | M | NT-002 | FR-1, FR-3, FR-4, FR-5, FR-6, FR-7, FR-10, FR-11 | completed |
| NT-004 | Add vault setting support for file visibility policy and wire it through Tauri/frontend settings state | S | NT-003 | FR-2, FR-3 | completed |
| NT-005 | Update frontend explorer and editor shell to render badges, dim unknown files, scaled image view, and inactive source/edit modes for non-markdown types | M | NT-004 | FR-4, FR-5, FR-8, FR-9 | completed |
| NT-006 | Run targeted verification and publish audit artifacts for note-type plugin/image-note support | S | NT-005 | FR-1 through FR-11 | completed |

## Dependency DAG
```text
NT-001 -> NT-002 -> NT-003 -> NT-004 -> NT-005 -> NT-006
```

## Concern Coverage
| Concern | Tasks | Verification |
| --- | --- | --- |
| CONF | NT-002, NT-004, NT-005 | Explorer/editor component tests validate explicit fallback and mode affordances |
| REL | NT-001, NT-003, NT-006 | Typed backend loading and regression tests protect markdown and non-markdown note flows |
| COMP | NT-001, NT-003, NT-005 | Markdown regression coverage and shared note contracts preserve existing behavior |
| CAP | NT-003, NT-005 | Backend filtering plus bounded image rendering avoid unnecessary frontend work |

## Verification Commands
```bash
npx vitest run src/components/Sidebar/index.test.tsx src/components/Editor/index.test.tsx src/App.test.tsx src/lib/api.test.ts
npm run typecheck
cargo test note_type
cargo test explorer
cargo test get_note
```

## Notes
- Image support ships through the new note-type registry rather than direct markdown special-casing.
- Metadata payloads are intentionally empty for non-markdown note types in this revision.
