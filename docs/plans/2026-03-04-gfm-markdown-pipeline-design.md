# GFM Markdown Pipeline Design

Change-Type: design-update
Trace: DESIGN-gfm-markdown-platform-024

Date: `2026-03-04`

Related:
- [markdown-engine-001.md](/home/dikini/Projects/knot/docs/specs/component/markdown-engine-001.md)
- [2026-03-02-wikilink-embed-design.md](/home/dikini/Projects/knot/docs/plans/2026-03-02-wikilink-embed-design.md)

## Goal

Adopt a new markdown pipeline that treats broad GFM support as the default target, keeps source markdown canonical, preserves edit/view consistency, and leaves room for first-class Knot extensions such as wikilinks, embeds, math, and future block-level extensions.

This design is intentionally general. It defines the rules and architecture first, then identifies where frontend and backend changes are actually required.

## Current State Summary

The current frontend markdown stack is a custom ProseMirror schema plus a `prosemirror-markdown` and `markdown-it` pipeline. It supports a subset of markdown plus custom Knot syntax, but it is not a true GFM pipeline.

Known gaps:
- frontend schema has no table nodes
- frontend parser does not target GFM as a whole
- frontend serializer does not support GFM tables or broader extension growth cleanly
- frontend view mode is consistent with the frontend schema, but not with backend-only markdown features
- backend renderer already supports some GFM constructs that frontend does not

The result is partial markdown support and growing drift between:
- source mode
- edit mode
- view mode
- backend rendering and extraction

## General Rules

These rules are the design baseline.

### 1. Canonical Source Rule

Markdown remains the canonical persisted format.

- Source mode shows canonical markdown.
- Edit mode works against a structured document model derived from canonical markdown.
- View mode renders from the same structured document model used by edit mode.

For this migration seam, "canonical" is intentionally conservative:
- if input already uses the canonical syntax for a supported feature, round-trip serialization should preserve that syntax family rather than rewriting it to a different equivalent form
- native GFM must stay native GFM; extension syntax must stay extension syntax
- structural features must serialize from structured document state, not from escaped plain-text fallbacks

Allowed normalization at this seam:
- normalize line endings to `\n`
- omit a trailing terminal newline
- preserve the serializer's existing reference-definition append behavior when reference definitions are stored separately in document attrs

Not allowed at this seam:
- downgrading autolink literals to plain text or rewriting them to a different link syntax unless the fixture explicitly expects that normalization
- serializing tables, footnotes, or other structured constructs as escaped paragraph text
- rewriting Knot extension syntax into a native GFM approximation or vice versa
- passing fixtures only because the original source text survived in an unsupported plain-text block

### 2. Native First Rule

If GFM has a native syntax for a feature, Knot should use it instead of inventing a custom one.

Examples:
- task lists use native GFM task list syntax
- tables use native GFM pipe-table syntax
- footnotes use native GFM footnote syntax
- strikethrough uses native GFM syntax
- autolink literals use native GFM behavior

### 3. Extension Rule

Custom Knot syntax is allowed only when GFM has no real equivalent or when the product requirement is clearly beyond GFM.

Current examples:
- `[[wikilink]]`
- `![[embed]]`
- inline math
- display math

Future examples may include:
- asides
- plugin-defined block syntaxes

### 4. Schema Rule

A feature is not considered supported unless it exists in the frontend document model.

That means every supported feature must have:
- schema representation
- markdown parse behavior
- markdown serialize behavior
- edit-mode behavior
- view-mode behavior
- round-trip tests

### 5. View Consistency Rule

Frontend view mode must render from the same document model as edit mode.

The frontend should not treat markdown preview as a separate rendering product with a different feature surface.

### 6. Backend Minimality Rule

Backend markdown changes are required only when backend responsibilities actually need the feature.

Backend support is required when a feature affects:
- backend-rendered markdown HTML
- link extraction
- heading extraction
- MCP-visible note rendering or parsing behavior
- search or indexing semantics

Backend support is not required merely because the frontend supports a feature in edit/view mode.

### 7. Extensibility Rule

The markdown pipeline must distinguish clearly between:
- native GFM features
- Knot-owned extensions
- future plugin-defined extensions

The system must not hardcode all future behavior into one parser file.

## Target Feature Surface

### Native GFM Features

The target native set should include:
- headings
- blockquotes
- bullet and ordered lists
- task lists
- fenced code blocks
- inline code
- emphasis and strong emphasis
- strikethrough
- tables
- autolink literals
- link reference definitions
- footnotes
- horizontal rules
- images
- hard line breaks

### Knot Extensions

The first extension set remains:
- wikilinks
- embed wikilinks
- inline math
- display math

These are supported features, but they are explicitly extensions, not part of the native GFM layer.

## MDP-001 Feature Inventory

This migration starts by making the feature boundary explicit. The parser and serializer seam must know whether a construct is native GFM, a Knot extension, or deferred.

### Native GFM vs Knot Extension Inventory

| Feature | Syntax | Classification | Source Canonical Form | Edit/View Baseline | Migration Notes |
| --- | --- | --- | --- | --- | --- |
| Headings | `# Heading` | Native GFM | Preserve authored heading level | Existing schema-backed support | Already in migration seam baseline |
| Blockquotes | `> Quote` | Native GFM | Preserve blockquote syntax | Existing schema-backed support | Already in migration seam baseline |
| Bullet and ordered lists | `- item`, `1. item` | Native GFM | Preserve authored list structure | Existing schema-backed support | Already in migration seam baseline |
| Task lists | `- [x] done` | Native GFM | Preserve checkbox marker and checked state | Existing schema-backed support | Already exercised in current tests |
| Fenced code blocks | ```` ```ts ```` | Native GFM | Preserve fence and info string | Existing schema-backed support | Already in baseline |
| Emphasis / strong / strike | `*em*`, `**strong**`, `~~strike~~` | Native GFM | Preserve authored inline syntax canonically | Existing schema-backed support | Already in baseline |
| Inline code | `` `code` `` | Native GFM | Preserve backtick-delimited code spans | Existing schema-backed support | Already in baseline |
| Links and images | `[text](url)`, `![alt](src)` | Native GFM | Preserve inline link/image syntax | Existing schema-backed support | Already in baseline |
| Autolink literals | `https://example.com` | Native GFM | Preserve literal source while materializing a link target in the document model | Missing in current parser because `linkify` is disabled | First red fixture in MDP-002 |
| Link reference definitions | `[id]: https://...` | Native GFM | Preserve definitions after serialization | Existing seam support | Already covered in migration tests |
| Tables | `| A | B |` | Native GFM | Preserve canonical pipe-table source | Missing schema parse/serialize support | First red fixture in MDP-002 |
| Footnotes | `[^id]` / `[^id]: note` | Native GFM | Preserve reference and definition blocks | Missing schema parse/serialize support | First red fixture in MDP-002 |
| Horizontal rules | `---` | Native GFM | Preserve canonical thematic break | Existing schema-backed support | Already in baseline |
| Hard line breaks | trailing two spaces / explicit break | Native GFM | Preserve canonical hard-break output | Partial baseline only | Keep in broader migration matrix |
| Wikilinks | `[[Target]]` | Knot extension | Preserve Knot syntax, not downgraded to normal links | Existing schema-backed support | Extension baseline |
| Embed wikilinks | `![[Target]]` | Knot extension | Preserve embed syntax | Existing schema-backed support | Extension baseline |
| Inline math | `$x^2$` | Knot extension | Preserve inline math delimiters | Existing schema-backed support | Extension baseline |
| Display math | `$$ ... $$` | Knot extension | Preserve display math fences | Existing schema-backed support | Extension baseline |
| Future asides / plugin blocks | TBD | Future extension | No current canonical commitment | Not yet modeled | Explicitly out of scope for this slice |

### Source/Edit/View Fixture Matrix

`parseMarkdown` and `serializeMarkdown` are the migration seam for source-mode contracts. Each fixture below also declares the edit/view expectation that later schema and renderer work must satisfy.

| Fixture ID | Source Fixture | Feature Mix | Source Contract (`parseMarkdown` / `serializeMarkdown`) | Edit Contract | View Contract |
| --- | --- | --- | --- | --- | --- |
| `GFM-TABLE-001` | Simple pipe table with header and body rows | Native GFM only | Parse into a non-paragraph table representation and serialize back to canonical pipe-table markdown | Table structure is preserved in the document model with row/cell boundaries | Preview renders an actual table from the shared document model |
| `GFM-AUTOLINK-001` | Paragraph containing bare `https://example.com/docs` | Native GFM only | Parse bare URL as link semantics while preserving literal source on serialization | Edit mode exposes a link target without requiring manual `[text](url)` syntax | View mode renders clickable link text from the same link mark/node |
| `GFM-FOOTNOTE-001` | Paragraph with `[^1]` plus definition block | Native GFM only | Parse reference plus definition as structured footnote data and serialize both back canonically | Edit mode preserves footnote reference identity and definition content | View mode renders reference/definition linkage from the same model |
| `GFM-MIXED-001` | Table cell containing a wikilink and inline math, followed by a footnote definition with an autolink literal | Native GFM + Knot extensions | Parse both native and extension syntax without downgrading either, and serialize back with the same feature mix | Edit mode preserves table, wikilink, math, autolink, and footnote semantics in one document | View mode renders the same mixed semantics without a separate preview parser |
| `GFM-MIXED-002` | Paragraph with autolink literal adjacent to `[[wikilink]]` and `[^note]` | Native GFM + Knot extensions | Preserve native/extension precedence and round-trip all three forms | Edit mode keeps distinct link, wikilink, and footnote semantics | View mode reflects the same distinction |

The first slice covers `GFM-TABLE-001`, `GFM-AUTOLINK-001`, `GFM-FOOTNOTE-001`, and `GFM-MIXED-001` as red tests only. Schema, parser, serializer, and renderer support are deferred to later migration tasks.

## Recommended Architecture

### Overview

Use a GFM-native markdown pipeline for parse and serialize, while keeping ProseMirror as the frontend editing model.

Recommended model:

`markdown text -> markdown AST -> ProseMirror document -> edit/view rendering`

and back:

`ProseMirror document -> markdown AST -> canonical markdown text`

This makes the markdown AST layer the canonical syntax boundary and the ProseMirror schema the canonical in-app behavior boundary.

### Why This Direction

This design is preferred over extending the current custom `prosemirror-markdown` pipeline because:
- GFM features like tables and footnotes fit more naturally in a markdown AST pipeline
- native GFM support becomes the default rather than a growing pile of special cases
- custom Knot syntax can be expressed as formal extensions rather than parser hacks
- future extension work has a better place to live

## Architecture Layers

### Layer 1: Markdown Syntax Layer

Responsibilities:
- parse canonical markdown text
- understand GFM features natively
- understand Knot extensions explicitly
- serialize back to canonical markdown

This layer owns:
- syntax recognition
- syntax precedence
- markdown fidelity
- native versus extension feature classification

This layer does not own:
- edit-mode UI
- view-mode UI behavior
- backend-specific extraction logic

### Layer 2: Frontend Document Model

Responsibilities:
- define the supported in-app feature surface
- provide structural nodes and marks for edit and view consistency
- represent both native GFM constructs and Knot extensions

This layer lives in the ProseMirror schema and related editor plugins.

Examples of required additions:
- table nodes
- footnote representation
- explicit extension nodes or marks where needed

### Layer 3: Frontend Rendering Layer

Responsibilities:
- edit mode interaction
- view mode rendering from the same document model
- mode-specific UX while preserving the same document semantics

Examples:
- task lists may have checkboxes in both edit and view
- tables may have richer edit interactions than view
- embeds may look different in edit and view while preserving the same underlying model

### Layer 4: Backend Markdown Layer

Responsibilities only where required:
- parsing features needed for extraction or rendering
- rendering markdown for backend-driven HTML output
- preserving semantic extraction behavior for links, headings, notes, and MCP tools

The backend should mirror frontend-supported syntax only where the backend genuinely consumes it.

## Feature Classification Model

Every markdown feature should be classified before implementation.

### Class A: Native GFM Feature

Questions:
- Does GFM define syntax for this?
- Can Knot use the native syntax without losing product intent?

If yes:
- use native syntax
- define native schema nodes or marks
- avoid custom syntax

Examples:
- task lists
- tables
- footnotes

### Class B: Knot Extension

Questions:
- Does GFM not define this feature?
- Is the Knot behavior materially different from any GFM equivalent?

If yes:
- define explicit extension syntax
- define explicit schema support
- define explicit parse and serialize rules

Examples:
- wikilinks
- embed wikilinks
- math

### Class C: Optional Backend Mirror

Questions:
- Does the backend need to parse or render this feature?

If yes:
- mirror the feature in backend parsing and rendering

If no:
- do not force backend parity prematurely

## Required Frontend Changes

### 1. Replace the Current Markdown Parse and Serialize Core

The current frontend parser and serializer are centered in:
- [markdown-next.ts](/home/dikini/Projects/knot/src/editor/markdown-next.ts)
- [markdown.ts](/home/dikini/Projects/knot/src/editor/markdown.ts)

These should be replaced or heavily reworked so that:
- GFM is the default markdown target
- extension syntax is registered as extensions, not bolted into the main parser by ad hoc rules
- serialization is driven by the same feature model

### 2. Expand the Schema

The current schema in [schema.ts](/home/dikini/Projects/knot/src/editor/schema.ts) needs to become the real supported feature surface.

At minimum, it needs support for:
- tables
- table rows
- table header and body cells
- footnotes or a footnote-compatible representation

It also needs a clear policy for custom extension modeling:
- mark versus inline node
- block node versus block wrapper
- atom versus editable content

### 3. Keep View Mode on the Same Model

The current view-mode direction in [render.ts](/home/dikini/Projects/knot/src/editor/render.ts) is correct and should be preserved:
- parse markdown into the frontend document model
- render view mode from that model

New GFM features should be added to this same path instead of building a separate preview renderer.

### 4. Revisit Special Renderers

Some features need post-processing or richer rendering:
- task lists
- math
- mermaid
- embeds

Those post-processing steps should remain view-only presentation layers over an already-supported document model, not syntax parsers.

## Required Backend Changes

Backend work should be driven by actual need, not symmetry for its own sake.

### Backend Changes Required If

The feature affects:
- backend HTML rendering
- link extraction
- heading extraction
- note parsing used in MCP or other backend-visible features

### Backend Changes Potentially Not Required If

The feature only affects frontend authoring and frontend display semantics.

### Immediate Likely Backend Requirements

If GFM becomes a documented project target, backend markdown parsing should likely support at least:
- tables
- task lists
- strikethrough
- footnotes
- autolink literals where link extraction depends on them

The backend already supports part of this set. The design expectation should be:
- backend mirrors the native GFM set needed for rendering and extraction
- backend mirrors Knot extensions only when those extensions matter to backend behavior

## Extension Strategy

The new pipeline should define a formal extension contract.

Each extension should specify:
- syntax form
- parse priority relative to GFM constructs
- schema representation
- serialization rule
- edit-mode presentation
- view-mode presentation
- whether backend support is required

### Extension Examples

#### Wikilinks

- syntax: `[[Target]]`
- native equivalent: none
- category: Knot extension
- backend support: yes, because links and note graph behavior depend on it

#### Embed Wikilinks

- syntax: `![[Target]]`
- native equivalent: none
- category: Knot extension
- backend support: only if backend needs embed-aware extraction or rendering

#### Math

- syntax: inline and display math
- native equivalent: none in GFM
- category: Knot extension
- backend support: yes if backend-rendered note HTML must show math consistently

#### Asides

- syntax: to be determined
- native equivalent: none
- category: future extension
- backend support: only if backend rendering or extraction needs it

## Migration Strategy

### Phase 1: Define Feature Inventory

Classify all currently supported and proposed syntax into:
- native GFM
- Knot extension
- future extension

### Phase 2: Introduce the New Markdown Core

Add the new markdown parse and serialize layer behind an internal migration seam.

Goals:
- prove GFM coverage
- prove extension support
- keep old and new paths comparable during migration

### Phase 3: Expand the Schema to Match the Target Surface

Add missing native and extension features to the schema.

The schema becomes the product truth for supported features.

### Phase 4: Align View Mode

Ensure all new features render through the shared frontend document model in both edit and view.

### Phase 5: Add Backend Support Only Where Needed

Update backend parsing and rendering for the subset of features that backend responsibilities require.

### Phase 6: Remove Legacy Markdown Assumptions

Retire frontend logic that assumes:
- commonmark-only parsing
- backend-only support for some markdown constructs
- feature support without schema support

## Testing Rules

No feature should be called supported without tests in all relevant paths.

### Required Test Axes

- source parse
- source serialize
- source round-trip
- edit-mode rendering and interaction
- view-mode rendering
- mixed-feature interaction

### Required Cross-Feature Fixtures

The new pipeline must be tested with combinations, not just isolated cases:
- table cells containing links
- table cells containing wikilinks
- table cells containing inline math
- task lists near tables
- footnotes with links
- embeds near footnotes
- extension syntax mixed with native GFM constructs

### Consistency Standard

A feature is considered supported only if:
- source mode accepts it
- edit mode preserves it
- view mode renders it
- serialization keeps it canonical

## Decision Summary

Recommended direction:
- adopt a new GFM-native markdown parse and serialize layer
- keep ProseMirror as the frontend editing model
- treat the schema as the canonical supported feature surface
- keep view mode derived from the same document model as edit mode
- implement backend support only where backend responsibilities actually require it

## Scope Boundaries

This design does not choose:
- the exact library set for the new markdown core
- the exact schema representation for footnotes
- the exact syntax for future asides

Those belong in a follow-up implementation plan or a narrower component spec.

This design does choose:
- the governing rules
- the layer boundaries
- the feature classification model
- the migration direction
