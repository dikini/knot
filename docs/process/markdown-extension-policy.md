# Markdown Extension Policy

Trace: `DESIGN-gfm-markdown-platform-024`
Spec: `docs/specs/component/markdown-platform-024.md`

## Purpose
Keep markdown-note feature growth disciplined so native GFM support, Knot markdown extensions, and future markdown-only syntax changes stay consistent across source, edit, and view modes.

## Policy

### 1. Native First

If GFM already defines the feature and Knot does not need materially different behavior, use the native GFM syntax.

Examples:
- task lists
- tables
- footnotes
- autolink literals

### 2. Extensions Must Be Explicit

If a feature is not native GFM, it must be introduced as an explicit markdown extension with:
- syntax definition
- feature classification
- schema representation
- parse rule
- serialize rule
- edit/view behavior
- backend-needed decision

Do not add syntax by slipping parser hacks into one file without a documented extension contract.

### 3. Markdown Notes Only

This policy applies to core markdown notes only.

It does not define:
- note-type behavior
- image/pdf/youtube-specific content rules
- whether non-markdown note types reuse markdown UI shells

### 4. Support Bar

A markdown feature is not considered supported unless it exists in:
1. source mode
2. parse/serialize pipeline
3. frontend schema
4. edit mode
5. view mode
6. regression coverage

### 5. Backend Is Conditional

Backend support is required only when the backend actually consumes the syntax for:
- rendering
- extraction
- MCP-visible parsing
- indexing/search semantics

Do not mirror frontend syntax in the backend by default.

### 6. Raw HTML Is Not Supported Markdown-Note Content

Raw HTML is outside the supported markdown-note feature surface for this component revision.

Policy:
- the GFM-native path treats raw HTML as unsupported
- the public/frontend markdown-note path preserves it as literal text
- view mode must not render raw HTML as live DOM

If the product later wants HTML-like richer blocks, they should be defined as explicit markdown extensions or note-type behavior, not smuggled in as arbitrary raw HTML support.

### 7. Rich Table Cells Are Not Part of The Contract

Native GFM pipe tables in markdown notes are treated as paragraph-style cell content only.

Policy:
- inline-rich content inside a cell is fine
- multi-block content inside a cell is outside the supported markdown-note contract
- serializer behavior must fail clearly instead of flattening block content into lossy text

## Skill/Workflow Augmentations
- `bk-design`: classify every proposed markdown feature as `native_gfm`, `knot_extension`, or `future_extension`, and state whether backend support is required.
- `bk-plan`: break work into parser, schema, source/edit/view, backend-if-needed, and regression tasks.
- `bk-tdd`: add round-trip fixtures plus mixed-feature fixtures before implementation.
- `bk-implement-typescript`: treat schema support as mandatory for any claimed frontend feature.
- `bk-verify`: reject “supported” claims unless source/edit/view coverage and regression evidence exist.

## Reviewer Checklist
1. Is this feature truly missing from GFM, or are we reinventing a native construct?
2. Does the feature have explicit schema support?
3. Is view mode derived from the same document model as edit mode?
4. Is backend work justified by backend responsibility, or is it symmetry for its own sake?
5. Are mixed-feature fixtures included, not just isolated happy-path tests?
6. Does the change accidentally make raw HTML live, or does it preserve the current literal-text policy?
