# Implementation Plan: Markdown Platform for GFM and Extensions

Change-Type: design-update
Trace: DESIGN-gfm-markdown-platform-024
Spec: `docs/specs/component/markdown-platform-024.md`
Generated: `2026-03-04`

## Summary
- Total tasks: 12
- Approach: sequential with bounded parallel test authoring
- Size: 3 small, 7 medium, 2 large
- Goal: migrate core markdown notes to a GFM-first, extension-capable platform while preserving source/edit/view consistency and keeping note-type behavior out of scope.

## Tasks

| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| MDP-001 | Define native-versus-extension feature inventory and fixture matrix for markdown notes | S | - | FR-1, FR-2, FR-3, FR-4, FR-5 |
| MDP-002 | Add failing round-trip and mixed-feature tests for GFM baseline and current Knot extensions | M | MDP-001 | FR-3, FR-5, FR-6, FR-8, FR-16 |
| MDP-003 | Introduce the new GFM-capable markdown syntax layer behind a migration seam | L | MDP-001, MDP-002 | FR-1, FR-8, FR-14 |
| MDP-004 | Define extension registration primitives and port existing custom syntax hooks onto them | M | MDP-003 | FR-4, FR-5, FR-9, FR-10 |
| MDP-005 | Expand the frontend schema for native GFM tables and footnote-compatible support | L | MDP-003 | FR-3, FR-6, FR-14 |
| MDP-006 | Wire edit mode to the expanded schema and maintained table support without changing note-type scope | M | MDP-004, MDP-005 | FR-6, FR-7, FR-11, FR-12 |
| MDP-007 | Keep view mode on the shared frontend document model and add rendering coverage for new GFM constructs | M | MDP-005, MDP-006 | FR-6, FR-7, FR-16 |
| MDP-008 | Reintegrate wikilinks, embeds, and math through the new syntax layer and shared model | M | MDP-004, MDP-005, MDP-006 | FR-4, FR-5, FR-6, FR-7, FR-8, FR-16 |
| MDP-009 | Audit backend markdown responsibilities and implement only the required native/extension mirrors | M | MDP-001, MDP-008 | FR-13, FR-16 |
| MDP-010 | Publish extension registration types, process docs, and implementation-facing examples in repo docs | S | MDP-004 | FR-9, FR-10, FR-15 |
| MDP-011 | Add migration/fallback gating plus compatibility checks for existing markdown notes | S | MDP-003, MDP-008, MDP-009 | FR-14, FR-16 |
| MDP-012 | Run focused verification, capture gaps, and prepare the implementation audit trail | M | MDP-007, MDP-009, MDP-010, MDP-011 | FR-6, FR-7, FR-13, FR-15, FR-16 |

## Dependency DAG
```text
MDP-001 -> MDP-002 -> MDP-003 -> MDP-004 -> MDP-008 -> MDP-011 -> MDP-012
                       \-> MDP-005 -> MDP-006 -> MDP-007 -/
MDP-001 -------------------------------------------> MDP-009 -/
MDP-004 -------------------------------------------> MDP-010 -/
```

## Task Notes

### MDP-001 Feature Inventory
- Classify current and target syntax as:
  - `native_gfm`
  - `knot_extension`
  - `future_extension`
- Lock the initial native baseline:
  - tables
  - task lists
  - strikethrough
  - autolink literals
  - footnotes
- Lock the initial extension baseline:
  - wikilinks
  - embed wikilinks
  - inline math
  - display math

### MDP-003 Syntax Layer
- Add a GFM-capable markdown syntax layer using the recommended ecosystem fit from the spec.
- Keep a migration seam so old and new behavior can be compared during rollout.
- Scope remains core markdown notes only.

### MDP-005 Schema Expansion
- Add native support for tables.
- Add a footnote-compatible representation suitable for source/edit/view consistency.
- Avoid scope creep into note types or non-markdown nodes.

### MDP-009 Backend Audit
- Implement backend mirroring only when required by:
  - HTML rendering
  - extraction
  - MCP-visible parsing/rendering
  - indexing/search semantics
- Explicitly document anything intentionally frontend-only.

## Concern Coverage
| Concern | Tasks | Verification |
| --- | --- | --- |
| REL | MDP-002, MDP-003, MDP-011, MDP-012 | Migration seam, regression fixtures, compatibility checks, verification audit |
| SEC | MDP-004, MDP-009, MDP-012 | Explicit extension registration, backend-needed audit, safe rendering review |
| CAP | MDP-003, MDP-005, MDP-007, MDP-009 | Maintained libraries, bounded model growth, avoid redundant render pipelines |
| CONS | MDP-001, MDP-005, MDP-006, MDP-007, MDP-008 | Shared schema and source/edit/view fixture matrix |
| COMP | MDP-002, MDP-008, MDP-011 | Existing markdown-note compatibility and staged migration checks |
| CONF | MDP-006, MDP-007, MDP-010, MDP-012 | Consistent mode behavior, explicit policy docs, and documented gaps if any remain |

## Verification Commands
```bash
npm run test -- --run src/editor/markdown.test.ts src/editor/markdown-engine.migration.test.ts src/editor/render.test.ts src/components/Editor/index.test.tsx
npm run typecheck
npm run -s qa:docsync -- --against=HEAD
npm run -s qa:project-registry
```

## Exit Criteria
- Native GFM baseline features required by the spec round-trip through source/edit/view for markdown notes.
- Wikilinks, embeds, and math remain supported as explicit extensions through the new pipeline.
- View mode stays derived from the same frontend model as edit mode.
- Backend support exists only for features the backend truly consumes, with any intentional omissions documented.
- Process docs for markdown extension policy and authoring remain aligned with the implementation.

