# Mermaid Inline Insert Splitting Fix

## Metadata
- ID: `COMP-MERMAID-INLINE-SPLIT-001`
- Scope: `component`
- Status: `designed (planning deferred)`
- Parent: `COMP-MERMAID-001`, `COMP-EDITOR-MODES-001`, `COMP-EDITOR-WYSIWYM-002`
- Concerns: `[REL, CONF, COMP]`
- Trace: `BUG-mermaid-inline-split-001`
- Created: `2026-02-22`
- Updated: `2026-02-22`

## Purpose
Document and design a fix for a Mermaid insertion bug where inserting a Mermaid block while the caret is inside inline-marked text (for example strong/emphasis) splits the inline run across the inserted block.

## Problem Statement
Current behavior in edit mode allows block insertion at a cursor position within inline-marked text. When `Mermaid diagram` is inserted from the block menu at that location, surrounding inline markup can be split into two fragments around the inserted code block.

Observed example (source mode):
- before insertion: `Before **bold** and *emphasis* after.`
- after insertion near midpoint: `Before **bo**` + Mermaid block + `**ld** and *emphasis* after.`

This behavior is reproducible in Playwright coverage:
- `e2e/browser/markdown-mermaid.spec.ts` test: `inserts Mermaid when cursor is inside inline formatted text`

## Contract

### Functional Requirements
**FR-1**: Mermaid block insertion from the block menu MUST insert at a block boundary and MUST NOT split an inline mark run (`strong`, `em`, `code`, `strike`, `link`) into partial fragments.

**FR-2**: If the caret is inside inline-marked text, insertion behavior MUST normalize to a deterministic boundary policy:
- insert after the containing textblock by default, or
- insert before the containing textblock when explicitly configured.

**FR-3**: Source mode output after insertion MUST preserve original inline text continuity (for example, keep `**bold**` intact) and emit Mermaid as a fenced ` ```mermaid ` block.

**FR-4**: Edit/source/view transitions after insertion MUST remain round-trip stable without introducing escaped Mermaid syntax artifacts.

**FR-5**: Regression coverage MUST include insertion when caret is inside each major inline mark class used by the schema.

### Non-Goals
- Changing generic block insertion semantics for non-Mermaid block actions in this revision.
- Introducing live Mermaid rendering in edit mode.

## Design Decisions
| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Normalize Mermaid insertion to nearest textblock boundary | Prevents mark fragmentation and preserves user intent for inline formatting | Insert position may differ from exact caret offset |
| Keep Mermaid representation as `code_block(language=mermaid)` | Aligns existing markdown canonical model and avoids schema migration | No dedicated Mermaid node type |
| Add targeted mark-fragmentation regression tests | Locks behavior and prevents recurrence | More editor/e2e test maintenance |

## Proposed Fix Strategy
1. In `insertBlockAfterSelection("mermaid_diagram")`, resolve insertion anchor from the selection:
   - detect containing textblock and compute safe boundary position (`$from.end()` or `Selection.near` after the block),
   - avoid insertion within inline text offsets.
2. Insert Mermaid `code_block` at normalized boundary.
3. Set selection/focus predictably after insert (start of inserted block or next paragraph per existing UX policy).
4. Add/adjust tests:
   - unit/component test for no inline mark split,
   - Playwright assertion updated from current split behavior to expected non-splitting behavior.

## Acceptance Criteria
- [ ] Inserting Mermaid inside bold text does not split bold token into fragments.
- [ ] Inserting Mermaid inside emphasis/code/link text does not split those tokens into fragments.
- [ ] Source mode preserves unescaped Mermaid fence and original inline-mark continuity.
- [ ] Existing Mermaid insertion path remains functional in non-inline contexts.
- [ ] Regression tests fail before fix and pass after fix.

## Verification Strategy (Future)
- Run targeted editor component tests for block insertion with inline-marked input.
- Run Playwright markdown-mermaid scenarios including inline-mark insertion case.
- Run `typecheck` and `lint`.

## Status Note
This spec is intentionally design-only for now. Implementation planning (`bk-plan`) is explicitly deferred to a future stage.

