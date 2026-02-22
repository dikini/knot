# Daily Visual QA Audit (2026-02-22)

## Scope (all work today)
- 463815a — feat(editor): migrate markdown engine with next parser route
- dfffeea — feat(editor): add wikilink autocomplete and missing-link follow/create
- 62848e4 — fix(editor): prevent escaped wikilink brackets in next serializer
- 6e77071 — feat(notes): metadata fidelity for backlinks/headings
- b594fbb — feat(vault): guard vault switch on unsaved edits
- 8d526de — feat(app): save/discard guard before vault switch
- 739dfa4 — refactor(editor): remove legacy markdown engine split

## Environment
- Date: 2026-02-22
- Workspace: /home/dikini/Projects/knot
- App runtime available: npm run tauri dev
- Test vault path: /home/dikini/Projects/knot/test-vault

## Automated QA Evidence

### Frontend verification
- Command: npx vitest run src/editor/markdown-engine.migration.test.ts src/editor/wikilink-utils.test.ts src/components/Editor/index.test.tsx src/lib/vaultSwitchGuard.test.ts src/App.test.tsx
- Result: PASS
- Details: 5 test files passed, 62/62 tests passed.
- Re-run after wikilink path + suggestions UI updates: PASS (5 files, 62/62 tests).

Coverage mapped to scope:
- Markdown migration + single-engine contract: src/editor/markdown-engine.migration.test.ts
- Wikilink autocomplete and missing-link flows: src/editor/wikilink-utils.test.ts, src/components/Editor/index.test.tsx
- Escaped wikilink regression: src/editor/markdown-engine.migration.test.ts (BUG-WIKILINK-ESCAPE-001)
- App-level save/discard/cancel vault-switch UX guard: src/lib/vaultSwitchGuard.test.ts, src/App.test.tsx

### Backend verification
- Command: cargo test --manifest-path src-tauri/Cargo.toml bug_note_metadata_001 -- --nocapture
- Result: PASS (2/2)
- Tests:
  - commands::notes::tests::bug_note_metadata_001_heading_offsets_track_heading_line_starts
  - commands::notes::tests::bug_note_metadata_001_title_fallback_uses_filename_stem

- Command: cargo test --manifest-path src-tauri/Cargo.toml bug_vault_unsaved_001 -- --nocapture
- Result: PASS (3/3)
- Tests:
  - commands::vault::tests::bug_vault_unsaved_001_allows_replace_when_clean
  - commands::vault::tests::bug_vault_unsaved_001_blocks_replace_when_dirty
  - state::tests::bug_vault_unsaved_001_tracks_unsaved_changes_flag

## Manual Visual QA Checklist (interactive app)
Status: pending manual confirmation in running UI.

### 1) Markdown display/edit fidelity
- [ ] Open a note containing headings, list, link, code block.
- [ ] Switch Source → View → Edit and confirm no structural drift.
- [ ] Confirm no engine toggle is shown in shell controls.

### 2) Wikilink UX
- [ ] In edit mode type [[Neu and confirm suggestion popup appears.
- [ ] Insert existing suggestion and confirm rendered link in View mode.
- [ ] Click missing wikilink in View mode and confirm create/open behavior.
- [ ] Confirm missing wikilinks have distinct visual styling.

### 3) Escaped wikilink regression
- [ ] Enter plain [[Neural Networks]] text, save, reopen.
- [ ] Confirm persisted text is not escaped (no \[\[ ... \]\]).

### 4) Note metadata fidelity
- [ ] Create link Alpha -> Beta, open Beta.
- [ ] Confirm backlink source title shows human title (not raw path).
- [ ] Confirm heading navigation aligns with heading positions.

### 5) Vault switch unsaved guard
- [ ] Edit current note without saving.
- [ ] Trigger Open Vault/Open Recent and confirm prompt appears.
- [ ] Choose Save and confirm switch proceeds after save.
- [ ] Choose Discard and confirm switch proceeds and dirty state clears.
- [ ] Choose Cancel and confirm switch is aborted.

## Summary
- Automated verification for all today scopes: PASS.
- Manual visual verification: pending interactive confirmation.
- Blocker: interactive desktop UI cannot be driven directly via terminal tools in this session.

## QA Regression Follow-up (same day)
- Reported: inline/block tools were not discoverable during edit flow.
  - Fix: editor now initializes and displays the block insertion tool immediately when entering Edit mode (no extra cursor move required).
  - Verification: src/components/Editor/index.test.tsx (22/22 pass).

- Reported: inline + block toolset was incomplete in Edit mode UI.
  - Fix (inline): added Quote and Strikethrough actions in the floating selection toolbar.
  - Fix (block): expanded block insertion menu with Heading 1/2/3, Bullet list, Numbered list, and Horizontal rule alongside Code block and Blockquote.
  - UI refinement: switched block menu layout to a responsive grid so all actions remain discoverable on narrower editor widths.
  - Verification: src/components/Editor/index.test.tsx updated to assert all inline/block actions and icons; frontend QA scope PASS (5 files, 62/62 tests).

- Reported: wikilink suggestions should display context path under the title.
  - Fix: suggestion rows now render in two lines (title on top, note path below in smaller/fainter text) to preserve folder context without clutter.
  - Verification: focused regressions PASS — src/editor/wikilink-utils.test.ts + src/components/Editor/index.test.tsx (27/27 tests).

- Reported: clicking a wikilink in View mode did not open the targeted note.
  - Root cause: View-mode rendered HTML links were not wired to the wikilink follow/create handler.
  - Fix: added click interception on rendered markdown article for data-wikilink anchors (and local .md links), routing to note load/create logic.
  - Verification: new regression test “follows existing wikilink targets when clicked in view mode” in src/components/Editor/index.test.tsx.
