# Exploration: Medium-Like Editor Interactions

Date: 2026-02-20
Change-Type: design-update
Trace: DESIGN-editor-medium-like-interactions
Scope: frontend editor UX + markdown fidelity

## User Intent (captured)
- Medium-like contextual editing experience.
- Empty block shows minimal `+` inserter.
- Selected text shows inline formatting toolbar.
- Markdown remains canonical storage format.
- Three modes in toolbar:
  - `source`: raw markdown, no decorations
  - `edit`: WYSIWYM (default)
  - `view`: fully rendered markdown
- Markdown syntax should not leak in edit mode.

## Current State
- ProseMirror editor is already markdown-backed (`parseMarkdown` / `serializeMarkdown`).
- Toolbar currently exposes save and note metadata only.
- No selection toolbar or block inserter exists today.
- App has an editor surface theme toggle, but no source/edit/view mode.

## Feasibility
- High feasibility in existing stack.
- Primary effort is interaction layer and mode orchestration, not data model rewrite.
- Markdown round-trip constraints are compatible with requested UX.

## Proposed Architecture
1. Canonical document model:
- Keep markdown as source of truth in store/backend.
- `edit` mode operates on ProseMirror doc and serializes to markdown on change.
- `source` mode edits markdown text directly.
- `view` mode renders markdown read-only.

2. UI composition:
- Introduce editor mode state (per-vault persisted).
- Create mode switcher in editor toolbar (`Source`, `Edit`, `View`).
- Build floating selection toolbar in `edit` mode using ProseMirror selection state.
- Build contextual block inserter for empty paragraphs in `edit` mode.

3. Phase-1 block inserter scope:
- Start with `code block` and `blockquote` only.
- Keep extension points for future image/video/embed menu items.

## Risks / Trade-offs
- Source/Edit sync drift if conversions are lossy:
  - Mitigation: round-trip tests for mode switches.
- Selection toolbar positioning complexity:
  - Mitigation: keep minimal feature set initially (marks + simple block toggles).
- “No markdown leaks” in edit mode:
  - Mitigation: audit node views and syntax-hide plugin behavior per block type.

## Recommended Delivery Plan
1. M0: Mode framework
- Add `source/edit/view` state, toolbar switcher, persistence.
- Implement `source` textarea + `view` renderer shell.

2. M1: Selection toolbar (edit mode)
- Marks: bold, italic, code, link, blockquote toggle.
- Keyboard-first behavior stays intact.

3. M2: Empty-block `+` inserter
- Show only on empty paragraph hover/focus line.
- Menu: `Code block`, `Blockquote`.

4. M3: WYSIWYM hardening
- Ensure headings/markdown syntax are never visibly leaked in edit mode.
- Add regression coverage for heading rendering.

## Acceptance Direction for Phase 1
- User can switch among source/edit/view in toolbar.
- Edit mode remains default.
- Source mode shows plain markdown; edits reflect when returning to edit/view.
- View mode shows fully rendered markdown read-only.

## Open Decisions to confirm before implementation
- Source mode auto-save behavior:
  - A) live-update markdown store on each input
  - B) apply on blur/save only
- View renderer path:
  - A) backend `render_note` command
  - B) frontend markdown render (shared parser)
- Selection toolbar action set for first cut:
  - Current recommendation: `Bold`, `Italic`, `Code`, `Link`, `Quote`.
