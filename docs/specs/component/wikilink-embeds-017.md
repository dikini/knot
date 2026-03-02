# Wikilink Embeds

## Metadata
- ID: `COMP-WIKILINK-EMBEDS-017`
- Scope: `component`
- Status: `draft`
- Parent: `COMP-MARKDOWN-ENGINE-001`, `COMP-EDITOR-MODES-001`, `COMP-NOTE-TYPES-012`, `COMP-YOUTUBE-NOTE-TYPE-015`, `COMP-PDF-NOTE-TYPE-016`
- Concerns: `[REL, SEC, CAP, CONS, COMP, CONF]`
- Created: `2026-03-02`
- Updated: `2026-03-02`

## Purpose
Extend wikilinks with canonical markdown embed syntax `![[...]]` and a shared embed capability contract so core note types and future plugins can define deterministic edit/view embedding behavior.

## Contract

### Functional Requirements
**FR-1**: The markdown engine MUST parse and serialize `![[Target]]` and `![[Target|Label]]` canonically without changing existing `[[...]]` behavior.

**FR-2**: `![[...]]` target resolution MUST reuse the same title/name resolution path as normal wikilinks.

**FR-3**: The system MUST expose a shared embed descriptor/type contract that is used by both core note types and note-like plugins to define embedding behavior.

**FR-4**: The shared embed descriptor MUST use a narrow canonical shape contract owned by core:
- `link`
- `image`
- `canvas`
- `iframe`

**FR-4a**: Plugin and note-type implementations MUST map their own embedding semantics onto one of the canonical core shapes instead of extending the shared render union directly.

**FR-5**: Source mode MUST preserve the literal `![[...]]` markdown form as the canonical representation.

**FR-6**: Edit mode MUST render `![[...]]` as a single-line editable embed row with direct target editing and autocomplete suggestions.

**FR-7**: Edit-mode autocomplete suggestions for embed targets MAY display note-type pills for context, but note-type pills MUST NOT be rendered in the edit-mode body widget or in view mode body rendering.

**FR-8**: View mode MUST render `![[...]]` using the resolved canonical embed descriptor for the target note type or plugin.

**FR-9**: Markdown notes without a plugin override MUST render as:
- title link + plugin-defined description when description is available
- title link only when description is absent

**FR-10**: Image note types MUST render as embedded images in view mode.

**FR-11**: YouTube note types MUST render a thumbnail embed in view mode where:
- normal click opens the YouTube URL externally
- Shift-click opens the YouTube note inside Knot

**FR-12**: PDF note types MUST render as:
- title link plus description blockquote when description is available
- title link only when description is absent

**FR-13**: Unresolved, ambiguous, or partially defined embed targets MUST degrade safely to a deterministic link-like fallback rather than producing broken rich embeds.

**FR-14**: Existing normal wikilinks, markdown notes, and current specialized note-type rendering MUST remain regression-safe.

### Behavior
**Given** a note contains `![[Project Alpha]]`
**When** the target resolves to a markdown note with a plugin-defined description
**Then** view mode renders a title link and the description.

**Given** a note contains `![[Sample Video]]`
**When** the target resolves to a YouTube note
**Then** view mode renders the thumbnail, click opens YouTube externally, and Shift-click opens the note.

**Given** a note contains `![[Target]]`
**When** the user edits the embed in edit mode
**Then** the embed is represented as a single editable line with autocomplete-backed target editing.

## Design Decisions
| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Keep `![[...]]` canonical in markdown instead of converting to a dedicated persisted rich node | Preserves source fidelity and aligns with existing markdown-first architecture | Requires separate edit/view renderers over the same source |
| Use a shared canonical-shape embed descriptor instead of renderer-only note-type branching | Supports plugin-defined behavior while keeping core rendering bounded and deterministic | Introduces a new cross-layer contract |
| Keep plugin semantics out of the shared render union | Plugins can differ internally while still mapping to stable core shapes | Some plugin-specific behavior must be expressed through actions and payloads instead of bespoke kinds |
| Prioritize direct target editing in edit mode | Keeps authoring fast and prevents the embed widget from hiding the markdown mental model | Rich navigation is secondary while editing |
| Degrade unresolved or incomplete embeds to link-like fallback | Preserves user trust and avoids error-prone preview guesses | Some embeds remain plain until metadata is available |
| Resolve view-mode embeds before React commit instead of mutating mounted DOM afterward | Keeps render ownership deterministic and avoids post-render repair loops | Requires async derived-state preparation for embedded targets |
| Keep Mermaid as a temporary exception to the no-post-render-mutation rule | Mermaid still requires mounted-container rendering in the current architecture | Mermaid ownership cleanup remains deferred follow-up work |

## Concern Mapping
| Concern | Requirement | Implementation Strategy |
| --- | --- | --- |
| REL | FR-2, FR-8, FR-11, FR-12, FR-13, FR-14 | Shared resolver and deterministic fallback rules prevent mode-specific drift and broken embeds |
| SEC | FR-3, FR-4, FR-8 | Embed contract keeps core render shapes bounded; iframe/canvas behavior remains typed rather than arbitrary HTML |
| CAP | FR-3, FR-6, FR-8, FR-13 | Shared resolution model and bounded fallback avoid repeated expensive branching and uncontrolled rich rendering |
| CONS | FR-1, FR-2, FR-5, FR-6 | Canonical source syntax with shared resolution keeps source/edit/view behavior aligned |
| COMP | FR-1, FR-3, FR-4, FR-14 | Backward-compatible wikilink handling and plugin-extensible descriptor contract preserve existing behavior while enabling new types |
| CONF | FR-6, FR-7, FR-9, FR-11, FR-12, FR-13 | Predictable edit affordances, hidden pills in body rendering, and deterministic fallback improve user trust |

## Acceptance Criteria
- [ ] `![[...]]` round-trips through parse/serialize with no regression to normal wikilinks.
- [ ] A shared canonical-shape embed descriptor/type contract exists and is used by current core note-like types.
- [ ] Edit mode renders a single-line editable embed row with autocomplete suggestions.
- [ ] Suggestion rows may show note-type pills, while edit/view body embeds do not.
- [ ] Markdown note embeds render title + description or collapse to title-only when description is absent.
- [ ] Image note embeds render the image.
- [ ] YouTube note embeds render the thumbnail with correct click and Shift-click behavior.
- [ ] PDF note embeds render title + description blockquote, or title-only when description is absent.
- [ ] Unresolved or ambiguous targets degrade to deterministic link-like fallback.
- [ ] Existing `[[...]]` behavior and current note-type rendering remain regression-safe.
- [ ] View-mode embeds are resolved before React commits rendered HTML; Mermaid is documented as the only deferred exception.

## Deferred
- TODO: binary note-like types such as `image` SHOULD support persisted editable metadata such as description/alt text through a safe metadata channel rather than file-content overwrite. Current MCP/UI save paths are text-note writes and are not safe for binary assets.

## Verification Strategy
- Markdown parser/serializer tests for `![[...]]` round-trip and normal-wikilink parity.
- Resolution tests for markdown, image, YouTube, and PDF embed descriptors.
- Editor tests for single-line embed editing and autocomplete suggestion rendering.
- View-mode tests for each currently implemented presentation kind and action behavior.
- Regression tests for unresolved/ambiguous fallback and existing wikilink flows.

## Related
- Depends on: `COMP-MARKDOWN-ENGINE-001`, `COMP-NOTE-TYPES-012`, `COMP-EDITOR-MODES-001`
- Used by: wikilink resolution, editor surfaces, view-mode rich rendering, plugin note-type embedding
