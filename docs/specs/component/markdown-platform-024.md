# Markdown Platform for GFM and Extensions

## Metadata
- ID: `COMP-MARKDOWN-PLATFORM-024`
- Scope: `component`
- Status: `draft`
- Parent: `COMP-MARKDOWN-ENGINE-001`, `COMP-EDITOR-MODES-001`, `COMP-MATH-PLUGIN-008`, `COMP-WIKILINK-EMBEDS-017`
- Concerns: `[REL, SEC, CAP, CONS, COMP, CONF]`
- Created: `2026-03-04`
- Updated: `2026-03-04`

## Purpose
Replace the current markdown-note pipeline with a GFM-first, extension-capable platform for core `note.md` authoring so source, edit, and view modes share one supported feature surface while custom markdown extensions remain explicit and maintainable.

This spec is limited to markdown notes and markdown syntax extensions. It does not define note-type behavior for non-markdown files.

## Contract

### Functional Requirements
- FR-1: The core markdown-note pipeline MUST target broad GFM support as the native markdown baseline for `note.md`.
- FR-2: Native GFM features MUST use native syntax instead of custom Knot syntax whenever product behavior is materially equivalent.
- FR-3: The initial native GFM baseline MUST include at least:
  - tables
  - task lists
  - strikethrough
  - autolink literals
  - footnotes
  - existing standard markdown constructs already supported by Knot
- FR-4: Custom markdown syntax MUST be implemented only as explicit markdown extensions when GFM has no real equivalent or when Knot behavior materially exceeds GFM.
- FR-5: The initial markdown extension set MUST include:
  - `[[wikilink]]`
  - `![[embed]]`
  - inline math
  - display math
- FR-6: The frontend schema MUST be the canonical supported feature surface for markdown notes. A markdown feature is not considered supported unless it has:
  - schema representation
  - parse support
  - serialize support
  - edit-mode behavior
  - view-mode behavior
  - regression coverage
- FR-7: View mode for markdown notes MUST render from the same frontend document model used by edit mode rather than through a separate markdown rendering product.
- FR-8: Source mode MUST preserve canonical markdown text for both native GFM and registered Knot extensions.
- FR-9: The markdown syntax layer MUST support explicit extension registration so future markdown-only constructs can be added without central parser-file hacks.
- FR-10: The extension registration model MUST carry enough metadata to implement and verify an extension consistently:
  - syntax form
  - classification (`native_gfm`, `knot_extension`, `future_extension`)
  - parse rule
  - serialize rule
  - schema representation
  - edit/view presentation responsibilities
  - backend support requirement
- FR-11: The implementation MUST remain scoped to core markdown notes and MUST NOT couple markdown-extension support to note-type or non-markdown file behavior.
- FR-12: Non-markdown note types MAY reuse the markdown source/edit/view shell and UI patterns, but that choice MUST remain outside this component’s contract.
- FR-13: Backend markdown support MUST be added only when backend responsibilities genuinely require it, such as:
  - backend HTML rendering
  - markdown link extraction
  - heading extraction
  - MCP-visible note parsing or rendering
  - search or indexing semantics
- FR-14: The recommended frontend implementation MUST use maintained upstream libraries where they clearly fit:
  - a GFM-capable markdown AST pipeline for parse and serialize
  - `prosemirror-tables` or equivalent maintained table support for the frontend schema
  - existing maintained math integration where already adopted
- FR-15: The first implementation MUST ship with process documentation for markdown extension development, including:
  - a policy document defining extension rules
  - a workflow guide for implementing a markdown extension under BK
- FR-16: Existing markdown-note behavior that remains in scope MUST be regression-safe across source, edit, and view modes during migration.
- FR-17: Raw HTML is not part of the supported markdown-note feature surface in this component revision. The GFM-native path MUST treat raw HTML as unsupported, and the public/frontend markdown-note path MUST preserve raw HTML-looking input as literal text rather than rendering live HTML.

### Behavior
**Given** a markdown note contains native GFM tables, task lists, autolinks, and footnotes  
**When** the note is loaded in source, edit, and view modes  
**Then** each mode preserves the same document semantics and canonical markdown round-trip.

**Given** a markdown note contains `[[wikilink]]`, `![[embed]]`, and inline math inside otherwise standard GFM content  
**When** the note is parsed, edited, viewed, and serialized  
**Then** native GFM constructs remain native, custom constructs remain explicit extensions, and no mode silently drops or rewrites supported syntax into a different form.

**Given** a proposed markdown feature is only implemented in parsing or only in backend rendering  
**When** the feature is reviewed for support status  
**Then** it is treated as incomplete until the schema and source/edit/view contract are satisfied.

**Given** a markdown note contains raw HTML such as `<span>unsafe</span>`  
**When** the note is parsed, rendered in view mode, or serialized through the public markdown-note API  
**Then** the content is treated as literal text and is not rendered as live HTML.

## Implementation Options Considered
| Option | Summary | Pros | Cons |
| --- | --- | --- | --- |
| Extend `prosemirror-markdown` + `markdown-it` directly | Keep the current stack and hand-add GFM features plus custom extensions | Lowest migration churn | Serializer and extension complexity keep growing; GFM stays partial and fragile |
| Use a GFM-capable markdown AST layer plus ProseMirror document model | Parse/serialize through a GFM-native markdown syntax layer and bridge to the schema | Best fit for broad GFM, extensions, and long-term maintainability | Larger migration and bridge work |
| Move to a higher-level editor wrapper stack | Replace more of the current editor layer | More batteries included | Highest migration cost and weakest fit with current custom editor behavior |

Recommendation: use a GFM-capable markdown AST layer plus the existing ProseMirror editing model.

## Recommended Ecosystem Fit

The current ecosystem fit for this component is:

- Markdown syntax layer:
  - `remark-parse`
  - `remark-gfm`
  - `remark-math`
  - `remark-directive` for future directive-style block extensions such as asides
- Frontend document model:
  - existing ProseMirror schema as the canonical in-app model
  - `prosemirror-tables` or equivalent maintained table package
  - existing maintained math integration already used by Knot
- Knot-specific extension layer:
  - custom extension handlers for:
    - wikilinks
    - embed wikilinks
    - any future markdown-only Knot syntax not covered by GFM

This recommendation is based on current maintained upstream options that align with the component goals:
- broad GFM support without custom reimplementation
- explicit extension layering for non-GFM syntax
- continued use of ProseMirror as the editor model

The spec intentionally does not require a single bridge package between markdown AST and ProseMirror. That bridge may be implemented in-house or by adopting a maintained adapter if one proves compatible with Knot's schema and fidelity requirements.

## Design Decisions
| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Use GFM as the native markdown baseline | Matches the product target and avoids inventing local syntax for standard constructs | Requires migration beyond the current CommonMark-oriented setup |
| Keep markdown canonical in storage | Preserves the current markdown-first product model | Demands strong round-trip discipline |
| Treat the frontend schema as the real support contract | Prevents edit/view/backend drift and keeps features explicit | Raises the bar for declaring support |
| Keep view mode derived from the same frontend document model as edit mode | Preserves consistency across user-facing surfaces | Some view-only post-processing still needs discipline |
| Use explicit extension registration for Knot-only syntax | Keeps custom syntax maintainable and future-proof | Adds extension plumbing that the current parser does not have |
| Scope this component to markdown notes only | Avoids mixing markdown platform concerns with note-type behavior | Some reuse questions move to future note-type work |
| Add backend support only where backend responsibilities require it | Prevents unnecessary parity work and keeps responsibilities clean | Frontend and backend feature sets may evolve at different speeds if not documented carefully |
| Prefer maintained upstream libraries for GFM tables, markdown syntax, math, and directives/extensions | Lowers maintenance risk and aligns with ecosystem behavior | Integration work shifts to bridging and policy rather than bespoke code |
| Keep directives/asides in the extension lane rather than promoting them into native markdown | Preserves native-first discipline while still leaving room for richer markdown-note semantics | Future aside-like syntax remains an explicit extension instead of a built-in guarantee |
| Treat raw HTML as unsupported content for markdown notes and preserve it only as literal text on the public/frontend path | Avoids accidental live HTML rendering and keeps the supported surface explicit | Users do not get raw HTML rendering even though some markdown ecosystems allow it |

## Concern Mapping
| Concern | Requirement | Implementation Strategy |
| --- | --- | --- |
| REL | FR-6, FR-7, FR-8, FR-16 | One frontend model for source/edit/view, deterministic round-trip tests, and staged migration reduce drift |
| SEC | FR-4, FR-9, FR-10, FR-13, FR-17 | Extensions remain explicit and typed; backend mirroring is opt-in and reviewable rather than accidental; raw HTML is not silently promoted into live rendering |
| CAP | FR-6, FR-7, FR-10, FR-14 | Reuse maintained libraries and bounded feature registration instead of repeated ad hoc parsing logic |
| CONS | FR-1, FR-2, FR-3, FR-6, FR-7, FR-8, FR-17 | Native GFM first, explicit extension classification, schema-based support, and the literal-text raw-HTML rule keep behavior stable across surfaces |
| COMP | FR-1, FR-3, FR-13, FR-16 | Existing markdown support remains regression-safe while the platform upgrades to a broader syntax target |
| CONF | FR-6, FR-7, FR-11, FR-12, FR-15 | Users and contributors get one clear support contract, while process docs define how extensions should be added |

## Acceptance Criteria
- [ ] A new markdown-note platform spec exists that defines GFM as the native baseline and markdown extensions as explicit extensions.
- [ ] The spec makes clear that this work applies to markdown notes only and does not own note-type behavior.
- [ ] The implementation direction identifies a GFM-capable markdown syntax layer plus a ProseMirror schema/document model as the recommended path.
- [ ] The spec defines native-first feature rules and an explicit extension registration contract.
- [ ] The spec defines schema, source, edit, and view as the minimum support bar for a markdown feature.
- [ ] The spec defines backend mirroring as conditional on backend responsibilities rather than mandatory symmetry.
- [ ] A markdown extension policy document exists in `docs/process/`.
- [ ] A markdown extension authoring workflow guide exists in `docs/process/`.

## Verification Strategy
- Review the spec and process docs for consistency with:
  - `COMP-MARKDOWN-ENGINE-001`
  - `COMP-MATH-PLUGIN-008`
  - `COMP-WIKILINK-EMBEDS-017`
  - the 2026-03-04 GFM markdown pipeline design note
- Verify the component is registered in `docs/specs/system/spec-map.md`.
- Verify the planning view is updated in `docs/planning/roadmap-index.md`.
- Future implementation verification should include native GFM and extension fixtures across source/edit/view.

## Related
- Depends on: `COMP-MARKDOWN-ENGINE-001`, `COMP-EDITOR-MODES-001`, `COMP-MATH-PLUGIN-008`
- Informs: future implementation plan for markdown pipeline migration, markdown extension authoring workflow, and any future markdown-only extensions
