# Markdown Engine Upgrade and Reference Links

## Metadata
- ID: `COMP-MARKDOWN-ENGINE-001`
- Scope: `component`
- Status: `implemented`
- Parent: `COMP-EDITOR-MODES-001`, `COMP-EDITOR-WYSIWYM-002`, `COMP-FRONTEND-001`
- Concerns: `[REL, COMP, CAP, CONF]`
- Trace: `DESIGN-markdown-engine-upgrade-001`
- Created: `2026-02-22`
- Updated: `2026-02-22`

## Purpose
Replace the current handwritten markdown parser/serializer with a ProseMirror-compatible markdown engine based on `prosemirror-markdown` + `markdown-it`, while preserving existing edit/source/view behavior and adding Markdown reference-link support.

## Contract

### Functional Requirements
**FR-1**: The editor markdown pipeline MUST migrate to `prosemirror-markdown` parser/serializer backed by `markdown-it`.

**FR-2**: Existing supported markdown constructs MUST remain behaviorally compatible across `source`, `edit`, and `view` modes (headings, lists, blockquote, fenced code block with language, hr, bold/italic/code/strike, inline links, wikilinks).

**FR-3**: Wikilink behavior MUST remain supported (`[[Target]]`, `[[Target|Label]]`) with no regression in parse/serialize fidelity.

**FR-4**: Markdown reference links MUST be supported in source/edit/view round-trip:
- full form: `[label][id]` + `[id]: url "title"`
- collapsed form: `[id][]` + definition
- shortcut form: `[id]` + definition (where parser resolution is unambiguous)

**FR-5**: Reference-link definitions MUST be preserved through parse→serialize cycles, including optional title text.

**FR-6**: View-mode rendering MUST resolve reference links into clickable anchors equivalent to inline links.

**FR-7**: Migration MUST ship behind a feature gate/config switch so fallback to legacy parser is possible during validation.

**FR-8**: Existing editor and markdown tests MUST be expanded to golden round-trip fixtures and pass under both parser modes during migration window.

### Non-Goals (This Spec)
- Generic attribute syntax `{...}`.
- Footnotes, citations, bibliography handling.
- Task-list semantic nodes.
- Small-caps semantic or stylistic extension.

### Behavior
**Given** a note containing only currently supported syntax
**When** user moves between source/edit/view and saves
**Then** markdown semantics and visible rendering remain equivalent to pre-migration behavior.

**Given** a note with reference links and definitions
**When** it is parsed, edited, rendered, and serialized
**Then** link text and targets resolve correctly and definitions remain preserved.

## Design Decisions
| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Use `prosemirror-markdown` + `markdown-it` | Native ProseMirror compatibility and extensible token pipeline | Requires custom token mapping for Knot-specific wikilinks |
| Keep legacy pipeline behind feature flag during migration | Safe rollback and side-by-side validation | Temporary dual-path complexity |
| Preserve Markdown as canonical persisted representation | Matches existing architecture and UX | Requires strict round-trip test discipline |
| Implement reference links in markdown layer first | Enables requested syntax without premature UI coupling | Link-toolbar UX improvements deferred to follow-up |

## Compatibility Matrix
| Construct | Required in Migration |
| --- | --- |
| Paragraphs, H1-H6, HR | Preserve |
| Bullet/ordered lists | Preserve |
| Blockquote | Preserve |
| Fenced code block + language | Preserve |
| Bold/italic/code/strike | Preserve |
| Inline links | Preserve |
| Wikilinks | Preserve |
| Reference links | Add |

## Acceptance Criteria
- [x] Parser/serializer migration completed with adapter interface.
- [x] All existing markdown fixtures remain semantically equivalent.
- [x] Reference links parse and serialize correctly with definitions and titles.
- [x] View rendering resolves reference links.
- [x] Feature flag allows runtime fallback to legacy parser during rollout.
- [x] Golden round-trip tests cover legacy + migrated parser behavior.

## Verification Strategy
- Add parser parity fixture suite (`legacy` vs `new`) for existing syntax.
- Add reference-link fixture suite (full/collapsed/shortcut + titled definitions).
- Run editor mode tests to verify source/edit/view fidelity remains stable.
- Typecheck frontend and execute focused markdown/editor tests.

## Related
- Depends on: `COMP-EDITOR-MODES-001`, `COMP-EDITOR-WYSIWYM-002`
- Follow-ups: reference-link toolbar UX, extended markdown features
