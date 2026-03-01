# Math Plugin Integration

## Metadata
- ID: `COMP-MATH-PLUGIN-008`
- Scope: `component`
- Status: `implemented`
- Parent: `COMP-MARKDOWN-ENGINE-001`, `COMP-EDITOR-MODES-001`, `COMP-AUTHORING-FLOWS-001`
- Concerns: `[CONF, REL, COMP]`
- Created: `2026-03-01`
- Updated: `2026-03-01`

## Purpose
Add a minimal, markdown-preserving math authoring flow to the editor using `@benrbray/prosemirror-math` and KaTeX without broadening the markdown engine beyond a safe supported subset.

## Contract

### Functional Requirements
**MP-001**: The editor schema and plugin stack MUST integrate `@benrbray/prosemirror-math` using `math_inline` and `math_display` nodes, the required math plugin, input rules, CSS, and clipboard text serialization.

**MP-002**: The editor command layer MUST expose shared commands for inline and block math insertion so UI entry points and keybindings reuse the same command paths.

**MP-003**: The editor UI MUST expose safe insertion affordances:
- Block menu: `Math block`
- Selection formatting toolbar: `Inline math`
- Keybindings: one inline shortcut and one block shortcut routed through the shared command helpers

**MP-004**: Markdown round-trip MUST preserve inline `$...$` and multiline block `$$...$$`, and view mode MUST render both forms with KaTeX.

### Behavior
**Given** a user types `$x+y$` in edit mode  
**When** the inline math input rule completes  
**Then** the content becomes an editable inline math node and serializes back to `$x+y$`.

**Given** a note contains a multiline block delimited by standalone `$$` lines  
**When** the note is parsed, edited, or viewed  
**Then** it remains a `math_display` node in edit mode, round-trips to the same markdown form, and renders with KaTeX in view mode.

## Design Decisions
| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Use the upstream plugin and KaTeX directly instead of custom math nodes | Follows the maintained integration path and avoids reimplementing node views/editing behavior | Adds two frontend dependencies and their CSS |
| Keep block math support to multiline `$$` delimiter lines | Lowest-risk subset for the existing markdown engine and serializer | Single-line `$$...$$` blocks are intentionally out of scope |
| Render KaTeX only in view mode while leaving edit mode to ProseMirror node views | Keeps authoring behavior stable and preserves source/edit/view separation | No separate live KaTeX mirror outside the math node view |

## Concern Mapping
| Concern | Requirement | Implementation Strategy |
| --- | --- | --- |
| CONF | MP-001, MP-002, MP-003 | Shared commands, bounded UI entry points, and documented shortcuts keep authoring predictable |
| REL | MP-001, MP-002, MP-004 | Upstream node views, input rules, and focused regression tests reduce editor-state drift |
| COMP | MP-001, MP-004 | Preserve canonical markdown via `$...$` and multiline `$$...$$` serialization only |

## Acceptance Criteria
- [x] `@benrbray/prosemirror-math`, KaTeX, schema nodes, plugin wiring, CSS, input rules, and clipboard serializer are integrated.
- [x] Shared editor commands exist for inline and block math insertion and are reused by UI and keybindings.
- [x] Block menu and selection toolbar expose the required math entry points.
- [x] Inline `$...$` and multiline block `$$...$$` round-trip through markdown parse/serialize.
- [x] View mode renders inline and block math with KaTeX.
- [x] Limitation documented: only multiline block `$$` sections are supported in this revision.

## Verification Strategy
- Extend markdown, renderer, command, keymap, and editor component tests for math parse/serialize, rendering, and insertion flows.
- Run focused Vitest suites plus `npm run typecheck`.
- Run `npm run build` before Rust verification so Tauri test builds can resolve `frontendDist`.

## Related
- Depends on: `COMP-MARKDOWN-ENGINE-001`, `COMP-EDITOR-MODES-001`, `COMP-AUTHORING-FLOWS-001`
- Used by: editor schema, plugin stack, view renderer, editor insertion UI
