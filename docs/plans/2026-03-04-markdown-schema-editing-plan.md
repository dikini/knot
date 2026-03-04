# Markdown Schema Editing Implementation Plan

Change-Type: design-update
Trace: DESIGN-gfm-markdown-platform-024

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to execute this plan task-by-task.

**Goal:** Wire the expanded table and footnote schema into the editor so prosemirror can start editing these constructs without changing view-level UX.

**Architecture:** Keep the public parsing path on the legacy seam while the GFM layout and bridge verify structured tables/footnotes. Extend the plugin stack with `prosemirror-tables`, add helper commands for the new footnote nodes, and drive these changes through targeted Vitest fixtures and the existing migration suite.

**Tech Stack:** TypeScript, ProseMirror, `prosemirror-tables`, Vitest.

---

### Task 1: Add table editing plugin and commands

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/editor/plugins/index.ts`
- Modify: `src/editor/commands.ts`
- Create: `src/editor/commands.table.test.ts`

**Step 1: Write the failing test**
```ts
// commands.table.test.ts: verify plugin exports addTable command/+tableEditing plugin
```
**Step 2: Run the test to see it fail**
`npm run test -- --run src/editor/commands.table.test.ts`
Expected: failure because command/plugin not wired.
**Step 3: Add `prosemirror-tables` dependency & table helpers**
- `npm install prosemirror-tables`
- Import `tableNodes`/`tableEditing`/`addTable`.
- Extend `plugins()` to include `tableEditing` and register new table input keymap.
- Add `insertTable` command using schema/table helper for tests.
**Step 4: Run failing test again**
Expected: passes.
**Step 5: Commit addition**
`git add package.json package-lock.json src/editor/plugins/index.ts src/editor/commands.ts src/editor/commands.table.test.ts`
`git commit -m "feat: add table editing support"`

### Task 2: Add footnote commands for the new nodes

**Files:**
- Modify: `src/editor/commands.ts`
- Modify: `src/editor/commands.test.ts`

**Step 1: Write failing test**
- new test asserts `insertFootnoteReference` inserts `footnote_reference` with `id`/`label` and shifts focus.
**Step 2: Run test and observe failure**
`npm run test -- --run src/editor/commands.test.ts::footnote reference` expected fail.
**Step 3: Implement command**
- add helper to create `footnote_reference` node using current schema and update selection.
**Step 4: Run test again to pass**
**Step 5: Commit**
`git add src/editor/commands.ts src/editor/commands.test.ts`
`git commit -m "feat: add footnote reference command"`

### Task 3: Strengthen seam/migration coverage for tables/footnotes

**Files:**
- Modify: `src/editor/markdown-syntax.test.ts`
- Modify: `src/editor/markdown-engine.migration.test.ts`

**Step 1: Write failing tests**
- Update seam fixture expectations to require new doc structure for tables/footnotes (already red from earlier diff). Confirm they fail because post-implementation data still uses legacy path.
**Step 2: Run focused test set**
`npm run test -- --run src/editor/markdown-syntax.test.ts src/editor/markdown-engine.migration.test.ts -t "GFM-TABLE-001|GFM-FOOTNOTE-001"`
Expected: still red until commands implemented.
**Step 3: Once table/footnote editing hooks are wired, rerun tests to verify GFM paths produce structured nodes (they should still fail on legacy parse until MDP-008 but should now pass inside the seam comparisons).`
**Step 4: Commit test updates**
`git add src/editor/markdown-syntax.test.ts src/editor/markdown-engine.migration.test.ts`
`git commit -m "test: exercise table and footnote schema"`

### Task 4: Run full verification and capture remaining gap

**Files:**
- Verify: existing suite includes `src/editor/markdown-syntax.test.ts`, `src/editor/markdown-engine.migration.test.ts`

**Step 1: Run focused suite**
`npm run test -- --run src/editor/markdown-syntax.test.ts src/editor/markdown-engine.migration.test.ts`
Expected: seam tests pass (still red on public table/footnote until legacy seam switch). Note the gap in commit message.
**Step 2: Run typecheck**
`npm run -s typecheck`
**Step 3: Document residual red tests as blocked by legacy API before moving to MDP-006`
