# Wikilink Embed Design

Date: `2026-03-02`

Related spec: `docs/specs/component/wikilink-embeds-017.md`

## Goal

Extend wikilinks with `![[...]]` embeds while keeping markdown canonical in source mode and introducing a shared embed contract that works for core note types and future plugins.

## Requirements Summary

- `[[...]]` remains a normal wikilink.
- `![[...]]` resolves targets by title/name using the existing wikilink pipeline.
- View mode renders rich embeds.
- Edit mode renders a single editable line with autocomplete suggestions.
- Suggestion rows may show note-type pills for context.
- Edit/view body rendering must not show note-type pills.
- Markdown notes embed as title link + plugin-defined description, or collapse to title link only.
- Image notes embed the image.
- YouTube notes embed the thumbnail; click opens YouTube externally; Shift-click opens the YouTube note.
- PDF notes embed title link plus description blockquote when description exists, else title link only.
- Other note-like plugins define their own embedding behavior through the same contract.

## Approach Options

### 1. Renderer-only note-type branching

Handle `![[...]]` directly in the frontend renderer with explicit `switch(note_type)` logic.

Pros:
- Fastest initial implementation.

Cons:
- Hardcodes core note types.
- Fights plugin extensibility.
- Duplicates behavior rules across edit/view surfaces.

### 2. Dedicated rich embed document node

Represent `![[...]]` as a dedicated ProseMirror node with custom view/edit behavior.

Pros:
- Strong editor modeling.
- Precise edit interactions.

Cons:
- Higher schema/serializer migration risk.
- More divergence from canonical markdown.

### 3. Shared embed descriptor contract

Keep source canonical as `![[...]]`, resolve the target through the existing wikilink pipeline, and produce a shared embed descriptor consumed by edit/view renderers.

Pros:
- Fits plugin-backed note types.
- Preserves markdown canonicality.
- Lets edit/view diverge without duplicating resolution logic.

Cons:
- Adds a new shared contract between note typing/resolution and frontend rendering.

Recommendation: `3`.

## Design

### Canonical Model

`![[...]]` is a distinct markdown construct, but it reuses the same target resolution path as `[[...]]`.

Resolution yields:
- target identity
- note type / plugin identity
- presentation kind
- optional description
- optional media payload
- primary action
- optional secondary action

The descriptor remains intentionally narrow. Presentation kinds in v1:
- `link_only`
- `note_card`
- `image`
- `youtube_thumbnail`
- `pdf_summary`
- `canvas`
- `iframe`

The current implementation work will cover all existing note-like types:
- markdown
- image
- youtube
- pdf

`canvas` and `iframe` are reserved as valid descriptor kinds for plugin growth but do not require a concrete core implementation in this first pass.

### Plugin Contract

Embed behavior is plugin-defined, not guessed by the renderer. Each note-like type exposes:
- whether it supports `![[...]]` embedding
- which presentation kind it uses
- how description is derived
- what primary and secondary actions it exposes

Core note types will implement the same contract as plugins.

### Rendering by Mode

Source mode:
- preserve literal `![[...]]`

Edit mode:
- render a single-line editable embed row
- target text remains directly editable
- autocomplete reuses wikilink suggestion mechanics
- suggestion rows may include note-type pills
- body rendering does not show pills
- authoring interaction takes priority over navigation

View mode:
- render by presentation kind
- markdown: title link + description if present, else title link only
- image: image embed
- youtube: thumbnail, click opens YouTube externally, Shift-click opens note
- pdf: title link + description blockquote if present, else title link only

### Fallback and Ambiguity

The contract must remain safe when target resolution is incomplete.

Fallback rules:
- unresolved target: degrade to link-like unresolved representation, do not invent preview content
- ambiguous target: degrade to link-like unresolved representation until disambiguated
- missing plugin embed data: degrade to `link_only`

### Risks

- Contract creep if the descriptor becomes a generic payload bag.
- Coupling between backend/plugin note typing and frontend rendering.
- Extra resolution cost for notes with many embeds.
- Edit/view divergence bugs if renderers interpret the descriptor differently.

Mitigation:
- keep descriptor fields narrow
- keep one shared resolver
- use deterministic fallback to `link_only`
- add parser/resolution/edit/view regression tests

## Architecture Touchpoints

Likely implementation areas:
- markdown parser/serializer for `![[...]]`
- wikilink resolution utilities
- note data / note type payload contracts
- editor edit-mode rendering
- view-mode rendering
- note-type/plugin metadata plumbing

## Testing Strategy

- parse/serialize round-trip for `![[...]]`
- resolution tests for markdown/image/youtube/pdf targets
- edit-mode tests for single-line embed row and autocomplete
- view-mode tests for each core presentation kind
- click behavior tests, including YouTube Shift-click
- fallback tests for unresolved and ambiguous targets
