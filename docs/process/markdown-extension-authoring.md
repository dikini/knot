# Markdown Extension Authoring Guide

Trace: `DESIGN-gfm-markdown-platform-024`
Spec: `docs/specs/component/markdown-platform-024.md`

## Purpose
Provide a repeatable BK-aligned workflow for adding or changing markdown extensions for core markdown notes.

## Scope
This guide covers markdown syntax and markdown-note behavior only.

It does not cover:
- note-type plugins
- non-markdown file rendering
- node-type policy outside core markdown notes

## Authoring Workflow

### Step 1: Classify the Feature

Before any implementation work, classify the feature as one of:
- `native_gfm`
- `knot_extension`
- `future_extension`

Use these questions:
- Does GFM already define the syntax?
- Is the GFM behavior close enough for Knot?
- Does Knot need clearly different semantics?

### Step 2: Write or Update Spec

Use `bk-design` first.

The spec must state:
- syntax form
- classification
- schema representation
- parse/serialize requirements
- source/edit/view requirements
- backend-needed decision
- migration or compatibility risk

### Step 3: Plan by Surface

Use `bk-plan` after the spec exists.

Break work into these tracks:
1. syntax parse
2. syntax serialize
3. schema representation
4. edit-mode behavior
5. view-mode behavior
6. backend mirror if actually required
7. regression coverage

### Step 4: Write Failing Tests First

Use `bk-tdd`.

Minimum expected fixture set:
- source parse
- source serialize
- round-trip
- edit mode
- view mode
- mixed-feature interaction

Useful mixed fixtures:
- extension inside a table cell
- extension beside a footnote
- extension beside task lists
- extension mixed with links or autolinks
- raw HTML beside supported markdown content when relevant to fallback or policy boundaries
- unsupported rich table-cell content when native GFM cannot represent the structure safely

### Step 5: Implement Frontend First

For markdown-note features, frontend implementation usually starts with:
- syntax layer
- schema
- edit/view behavior

Add backend support only if the spec says backend responsibilities require it.

### Step 6: Verify Against the Support Bar

A feature is not done until it works across:
- source
- parse/serialize
- schema
- edit
- view
- tests

## Extension Record Template

Use this shape in design notes or specs:

```md
### Extension: <name>
- Classification: `native_gfm | knot_extension | future_extension`
- Syntax: `<canonical syntax>`
- Native equivalent: `<none | gfm construct>`
- Schema shape: `<node/mark summary>`
- Parse rule: `<summary>`
- Serialize rule: `<summary>`
- Edit mode: `<summary>`
- View mode: `<summary>`
- Backend support required: `<yes/no and why>`
```

## Recommended Implementation Defaults

- Prefer native GFM when possible.
- Prefer maintained upstream libraries when they fit.
- Prefer schema-level support over renderer-only tricks.
- Prefer one shared document model for edit and view.
- Prefer canonical markdown output over lossy convenience serialization.

## Red Flags

- “The backend already renders this, so frontend support is done.”
- “We only need preview support.”
- “This can stay parser-only for now.”
- “This is basically like a note type, so we can mix it in there.”
- “We can skip schema support until later.”
- “Raw HTML works in some markdown renderers, so we should just let it through.”

All of those create drift and should be rejected unless the spec explicitly scopes them as incomplete work.
