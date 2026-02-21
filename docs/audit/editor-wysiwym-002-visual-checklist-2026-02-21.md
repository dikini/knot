# Editor WYSIWYM 002 Visual Checklist (2026-02-21)

Scope: manual validation of strict edit-mode WYSIWYM behavior, tool distinguishability, and block insertion stability.

## Preconditions
- Launch app via `npm run tauri dev`.
- Open any vault and a note with multiple headings and paragraphs.
- Switch editor mode to `Edit`.

## Checks

1. **Heading markdown marker hidden in edit mode**
   - Place cursor on first heading line.
   - Confirm heading text is editable and styled as heading.
   - Confirm no literal `#` marker appears before heading text.

2. **Selection toolbar distinguishability**
   - Select any phrase in paragraph text.
   - Confirm floating toolbar appears with clearly readable actions:
     - `Bold`
     - `Italic`
     - `Code`
     - `Link`
   - Confirm each action appears as icon + label chip (not indistinguishable dark squares).

3. **Block `+` button visibility**
   - Place caret on an empty/collapsed cursor position.
   - Confirm floating `+` button is visible with strong contrast.
   - Confirm icon remains visible on hover/focus.

4. **Block menu action clarity**
   - Click the `+` button to open block menu.
   - Confirm both actions show icon + label:
     - `Code block`
     - `Blockquote`

5. **Blockquote insertion stability**
   - With block menu open, click `Blockquote`.
   - Confirm editor content does not disappear.
   - Confirm newly inserted blockquote appears and caret lands in editable location.
   - Repeat 2-3 times on different paragraphs.

6. **Enter new paragraph persistence**
   - Inside normal paragraph, press `Enter` once.
   - Confirm a new paragraph is created and remains visible.
   - Type text in new paragraph and confirm it does not revert.

7. **Source fidelity sanity check**
   - Switch to `Source` mode.
   - Confirm markdown is clean and includes expected paragraph break and any inserted blockquote syntax.
   - Switch back to `Edit` and confirm content remains present.

## Pass/Fail Log
- [x] Check 1 passed
- [x] Check 2 passed
- [x] Check 3 passed
- [x] Check 4 passed
- [x] Check 5 passed
- [x] Check 6 passed
- [x] Check 7 passed

## Capture Notes (if any fail)
- Check number:
- Actual behavior:
- Expected behavior:
- Repro steps:
