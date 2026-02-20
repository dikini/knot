# Editor Modes and Medium-Like Interactions

## Metadata
- ID: `COMP-EDITOR-MODES-001`
- Scope: `component`
- Status: `implemented (M0-M2)`
- Parent: `COMP-FRONTEND-001`, `COMP-EDITOR-READING-001`
- Concerns: `[CONF, REL]`
- Trace: `DESIGN-editor-medium-like-interactions`
- Created: `2026-02-20`
- Updated: `2026-02-20`

## Purpose
Introduce a mode-based editor UX (`source/edit/view`) with contextual interactions inspired by Medium, while preserving markdown as canonical content representation.

## Functional Requirements
- FR-1: Editor toolbar MUST expose mode toggles: `Source`, `Edit`, `View`.
- FR-2: `Edit` mode MUST be default and preserve distraction-free WYSIWYM behavior.
- FR-3: `Source` mode MUST show raw markdown without rich editor decorations.
- FR-4: `View` mode MUST show fully rendered markdown in read-only form.
- FR-5: In `Edit` mode, selecting text MUST show a floating formatting toolbar.
- FR-6: In `Edit` mode, empty paragraph blocks MUST show a contextual `+` inserter.
- FR-7: Initial `+` menu scope MUST include `Code block` and `Blockquote`.
- FR-8: Markdown syntax tokens MUST NOT be visibly leaked in `Edit` mode.
- FR-9: Mode switching MUST preserve document content fidelity.
- FR-10: Source mode edits MUST update markdown state live.

## Acceptance Criteria
- AC-1: Mode switch controls are visible in editor toolbar and persisted per vault.
- AC-2: `Source` edits propagate correctly to `Edit` and `View`.
- AC-3: `View` renders markdown output and prevents direct editing.
- AC-4: Text selection in `Edit` reveals formatting toolbar near selection.
- AC-5: Empty paragraph line in `Edit` reveals a `+` action leading to insert menu.
- AC-6: `Code block` and `Blockquote` insertion works from the `+` menu.
- AC-7: No heading markdown prefix leakage in `Edit` mode for standard heading editing.
- AC-8: Round-trip tests pass for source/edit/view mode transitions.

## Non-Goals (Phase 1)
- Media insertion UX (image/video/embed) beyond placeholder menu wiring.
- AI callouts/assist overlays.
- Full slash-command system.
- Selection toolbar action expansion beyond initial set (`Bold`, `Italic`, `Code`, `Link`, `Quote`) is deferred.

## Design Decisions
| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Source mode is live-updating | Matches requested editing feel and reduces handoff friction | Requires careful dirty-state handling |
| View mode is frontend-rendered from shared markdown->ProseMirror pipeline | Keeps rendering local to frontend for this app layer | Not byte-identical to backend HTML renderer |

## Verification Strategy
- Unit tests for mode reducer/state and mode persistence.
- Component tests for toolbar visibility and mode surfaces.
- Integration tests for markdown round-trip on mode switches.
- Regression tests for heading syntax invisibility in edit mode.

## Milestone Status
- M0 complete: mode framework (`source/edit/view`) with live source updates and frontend view renderer.
- M1 complete: selection floating toolbar with contextual placement above selected text.
- M2 complete: block-level contextual `+` inserter with starter actions (`Code block`, `Blockquote`) and separation from text toolbar actions.
- M3 pending: edit-mode syntax leak hardening.
