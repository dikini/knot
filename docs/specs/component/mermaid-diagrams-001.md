# Mermaid Diagrams in Markdown and Editor

## Metadata
- ID: `COMP-MERMAID-001`
- Scope: `component`
- Status: `implemented`
- Parent: `COMP-MARKDOWN-ENGINE-001`, `COMP-EDITOR-MODES-001`, `COMP-EDITOR-WYSIWYM-002`
- Concerns: `[REL, SEC, CAP, COMP, CONF]`
- Created: `2026-02-22`
- Updated: `2026-02-22`

## Purpose
Add Mermaid diagram support for markdown notes while preserving markdown as the canonical source and maintaining existing source/edit/view mode fidelity.

## Contract

### Functional Requirements
**FR-1**: Mermaid diagrams MUST be represented as fenced code blocks with language `mermaid` in canonical markdown (for example, ```mermaid ... ```).

**FR-2**: Source mode MUST preserve Mermaid fences verbatim through source -> view -> source and source -> edit -> source transitions.

**FR-3**: View mode MUST render Mermaid fences as diagrams instead of plain code blocks when Mermaid parsing succeeds.

**FR-4**: View mode MUST provide a deterministic non-crashing fallback (plain code block or inline error state) when Mermaid parsing/rendering fails.

**FR-5**: Edit mode MUST keep Mermaid content editable as regular code block content (no live diagram rendering in edit mode for this spec revision).

**FR-6**: Editor block insertion UI MUST include a `Mermaid diagram` action that inserts a Mermaid-fenced starter snippet suitable for immediate editing.

**FR-7**: Diagram rendering initialization MUST use a secure Mermaid runtime configuration that avoids unsafe HTML/script execution.

**FR-8**: Mermaid rendering MUST be bounded to avoid unnecessary repeated heavy rerenders during normal editor/view interactions.

**FR-9**: Existing markdown parser/serializer compatibility MUST be preserved for all non-Mermaid syntax currently supported.

### Behavior
**Given** a note contains a fenced Mermaid block
**When** user switches to view mode
**Then** the fence is rendered as a Mermaid diagram.

**Given** a Mermaid fence has invalid syntax
**When** user opens view mode
**Then** the note still renders and the Mermaid block falls back to a readable non-crashing state.

**Given** user inserts `Mermaid diagram` from block menu in edit mode
**When** insertion completes
**Then** a Mermaid fenced block template is inserted into the note and remains round-trip stable in markdown.

## Design Decisions
| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Treat Mermaid as fenced code (`language=mermaid`) instead of schema node | Preserves markdown canonicality and avoids schema migration | No rich typed Mermaid node semantics |
| Render Mermaid only in view mode for v1 | Low regression risk for WYSIWYM edit flow and cursor behavior | No live diagram preview while editing |
| Add explicit block-menu insertion action | Improves discoverability and authoring speed | Adds one more menu action to maintain |
| Use secure Mermaid config + deterministic fallback | Aligns privacy/security posture and avoids hard failures | Slightly more render pipeline complexity |

## Concern Mapping
| Concern | Requirement | Implementation Strategy |
| --- | --- | --- |
| REL | FR-3, FR-4, FR-5 | Guarded rendering path with fallback; no edit-mode rendering side effects |
| SEC | FR-7 | Mermaid security mode configured for strict/safe rendering boundaries |
| CAP | FR-8 | Render only in view mode and avoid repeated full redraw loops |
| COMP | FR-1, FR-2, FR-9 | Keep parser/serializer code-block behavior unchanged; add focused regression tests |
| CONF | FR-4, FR-6 | Clear insertion affordance and readable error/fallback behavior |

## Acceptance Criteria
- [x] Mermaid-fenced markdown round-trips without loss through parse/serialize.
- [x] View mode renders valid Mermaid fences as diagrams.
- [x] Invalid Mermaid fences do not crash rendering and display fallback state.
- [x] Edit mode continues treating Mermaid as normal code block content.
- [x] Block menu exposes `Mermaid diagram` action and inserts Mermaid starter fence.
- [x] Existing non-Mermaid markdown behavior remains regression-safe.

## Verification Strategy
- Extend frontend markdown tests for Mermaid fence parse/serialize round-trip.
- Add editor component tests for source/view/edit fidelity with Mermaid fences.
- Add editor block-menu test asserting Mermaid insertion action.
- Typecheck and run focused editor/markdown test suites.

## Related
- Depends on: `COMP-MARKDOWN-ENGINE-001`, `COMP-EDITOR-MODES-001`
- Used by: editor view renderer, editor block insertion UI
