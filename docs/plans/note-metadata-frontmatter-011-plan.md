# Implementation Plan: Note Metadata Front Matter

Change-Type: design-update
Trace: DESIGN-note-metadata-frontmatter-011
Spec: `docs/specs/component/note-metadata-frontmatter-011.md`
Generated: `2026-03-01`
Status: `completed`

## Summary
- Total tasks: 4
- Approach: sequential
- Size: 2 small, 2 medium
- Goal: add YAML front matter metadata editing without leaking front matter into body-first editor modes.

## Tasks

| ID | Task | Size | Depends | Spec Ref | Status |
| --- | --- | --- | --- | --- | --- |
| FM-001 | Add failing parsing and editor-mode regression tests for front matter, Meta mode, and save validation | M | - | FM-001, FM-004, FM-005, FM-006 | completed |
| FM-002 | Implement front matter split/merge/validation utilities with managed field helpers and unknown-key preservation | M | FM-001 | FM-001, FM-002, FM-003, FM-005 | completed |
| FM-003 | Add Meta mode UI and body/front matter integration across Source/Edit/View/Save flows | M | FM-002 | FM-002, FM-004, FM-005, FM-006 | completed |
| FM-004 | Run targeted verification and publish audit artifacts | S | FM-003 | FM-001, FM-002, FM-003, FM-004, FM-005, FM-006 | completed |

## Dependency DAG
```text
FM-001 -> FM-002 -> FM-003 -> FM-004
```

## Verification Commands
```bash
npx vitest run src/lib/frontmatter.test.ts src/components/Editor/index.test.tsx
npm run typecheck
npm run -s qa:docsync -- --against=HEAD
```
