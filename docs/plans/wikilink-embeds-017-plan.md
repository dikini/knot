# Implementation Plan: Wikilink Embeds

## Metadata
- Spec: `docs/specs/component/wikilink-embeds-017.md`
- Generated: `2026-03-02`
- Approach: `sequential`

## Summary
- Total tasks: `7`
- Size mix: `2 small, 4 medium, 1 large`
- Critical path: `WKE-001 -> WKE-002 -> WKE-003 -> WKE-004 -> WKE-005 -> WKE-006 -> WKE-007`

## Tasks

### Phase 1: Canonical Markdown and Shared Types
| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| WKE-001 | Add failing parse/serialize tests for `![[...]]` round-trip and normal wikilink non-regression | M | - | FR-1, FR-14 |
| WKE-002 | Define shared canonical-shape embed descriptor/types and resolution result contract for core note types and plugin note-type implementations | M | WKE-001 | FR-2, FR-3, FR-4, FR-4a, FR-13 |

### Phase 2: Resolution and Core Type Capabilities
| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| WKE-003 | Implement backend/frontend resolution plumbing so `![[...]]` reuses wikilink target resolution and produces typed embed descriptors | L | WKE-002 | FR-2, FR-3, FR-8, FR-13 |
| WKE-004 | Implement current core note-type embed capabilities for markdown, image, YouTube, and PDF | M | WKE-003 | FR-9, FR-10, FR-11, FR-12 |

### Phase 3: Edit/View Rendering
| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| WKE-005 | Add edit-mode single-line embed row with autocomplete suggestions and suggestion-only note-type pills | M | WKE-003 | FR-5, FR-6, FR-7 |
| WKE-006 | Add view-mode rendering for current canonical shapes and wire action behavior including YouTube click/Shift-click semantics | M | WKE-004, WKE-005 | FR-8, FR-9, FR-10, FR-11, FR-12, FR-13 |

### Phase 4: Verification
| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| WKE-007 | Add regression coverage and run targeted verification across parser, resolver, editor, and note-type surfaces | S | WKE-006 | FR-1 through FR-14 |

## Dependency DAG
`WKE-001 -> WKE-002 -> WKE-003 -> WKE-004 -> WKE-006 -> WKE-007`

`WKE-003 -> WKE-005 -> WKE-006`

## Concern Coverage
| Concern | Tasks | Verification |
| --- | --- | --- |
| REL | WKE-001, WKE-003, WKE-004, WKE-006, WKE-007 | Descriptor resolution tests and fallback regression coverage |
| SEC | WKE-002, WKE-004, WKE-006, WKE-007 | Typed canonical-shape/action contract and bounded renderer assertions |
| CAP | WKE-002, WKE-003, WKE-005, WKE-007 | Resolution and rerender coverage avoiding uncontrolled body previews |
| CONS | WKE-001, WKE-003, WKE-005, WKE-006 | Source/edit/view parity and canonical markdown tests |
| COMP | WKE-001, WKE-002, WKE-004, WKE-007 | Normal wikilink parity and existing note-type non-regression suites |
| CONF | WKE-005, WKE-006, WKE-007 | Edit affordance and deterministic fallback behavior tests |

## Verification Commands
```bash
npm test -- --run src/editor/markdown.test.ts src/components/Editor/index.test.tsx
npm run -s typecheck
cargo test note_type
```

## Exit Criteria
- `![[...]]` remains canonical in source mode.
- A shared embed descriptor contract exists and is used by current core note-like types.
- Edit mode supports single-line embed editing with autocomplete.
- View mode renders markdown/image/youtube/pdf embeds according to the contract.
- Existing `[[...]]` and note-type rendering behavior stay regression-safe.
- Mermaid remains the only documented deferred exception to the no-post-render-mutation rule in view mode.
