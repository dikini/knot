# App Shell (Quiet Editorial) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a content-first app shell with a collapsible vertical tool rail, collapsible contextual panel, optional right inspector rail, and per-vault persisted shell state.

**Architecture:** Introduce a dedicated shell layout layer in `App.tsx`, with mode-driven contextual panel rendering (`notes | search | graph`). Keep existing editor/search/graph modules intact and rehost them in the new shell. Add a lightweight shell preference state slice persisted via `localStorage` keyed by vault path.

**Tech Stack:** React 19, TypeScript, Zustand, Vitest + Testing Library, existing CSS modules (`src/styles/App.css`, component CSS), shadcn-inspired component composition (implemented incrementally in current styling system).

---

## Preconditions
- Read and follow: `docs/plans/2026-02-20-app-shell-design.md`
- Use @superpowers:test-driven-development and @superpowers:verification-before-completion
- Keep commits frequent (one commit per task)

### Task 1: Add Shell State Model (mode + collapse + density)

**Files:**
- Modify: `src/lib/store.ts`
- Modify: `src/lib/store.test.ts`
- Modify: `src/types/vault.ts` (if new shared type needed)

**Step 1: Write the failing test**

Add tests in `src/lib/store.test.ts`:
```ts
it("stores shell defaults", () => {
  const state = useVaultStore.getState();
  expect(state.shell.toolMode).toBe("notes");
  expect(state.shell.isToolRailCollapsed).toBe(false);
  expect(state.shell.isContextPanelCollapsed).toBe(false);
  expect(state.shell.densityMode).toBe("comfortable");
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/lib/store.test.ts`
Expected: FAIL because `shell` state does not exist.

**Step 3: Write minimal implementation**

In `src/lib/store.ts`, add:
- `ShellToolMode = "notes" | "search" | "graph"`
- `ShellDensityMode = "comfortable" | "adaptive"`
- `shell` state with defaults
- actions: `setShellToolMode`, `toggleToolRail`, `toggleContextPanel`, `setDensityMode`, `setContextPanelWidth`

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/lib/store.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/store.ts src/lib/store.test.ts src/types/vault.ts
git commit -m "feat(shell): add shell state slice and actions"
```

### Task 2: Add Per-Vault Shell Preference Persistence

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Step 1: Write the failing test**

Add tests in `src/App.test.tsx` for:
- hydrating shell mode/collapse state from vault key
- persisting changes to `knot:shell:<vaultPath>`
- switching vaults restores each vault’s own shell state

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/App.test.tsx`
Expected: FAIL due missing shell persistence.

**Step 3: Write minimal implementation**

In `src/App.tsx`:
- add `useEffect` to hydrate shell preferences when `vault` changes
- add guarded persist effect (same hydration guard pattern used for view mode)
- serialize: `{ toolMode, isToolRailCollapsed, isContextPanelCollapsed, densityMode, contextPanelWidth }`

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/App.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat(shell): persist shell preferences per vault"
```

### Task 3: Build Vertical Tool Rail Component

**Files:**
- Create: `src/components/Shell/ToolRail.tsx`
- Create: `src/components/Shell/ToolRail.css`
- Create: `src/components/Shell/ToolRail.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles/App.css`

**Step 1: Write the failing test**

In `ToolRail.test.tsx`, add tests for:
- renders Notes/Search/Graph selectors
- active mode styling
- collapse toggle behavior
- keyboard shortcuts via callback mapping

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/components/Shell/ToolRail.test.tsx`
Expected: FAIL because component does not exist.

**Step 3: Write minimal implementation**

Create `ToolRail.tsx` props:
```ts
interface ToolRailProps {
  mode: "notes" | "search" | "graph";
  collapsed: boolean;
  onModeChange: (mode: "notes" | "search" | "graph") => void;
  onToggleCollapse: () => void;
}
```
Render vertical buttons + collapse control; style in `ToolRail.css` for comfortable spacing.

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/components/Shell/ToolRail.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/Shell/ToolRail.tsx src/components/Shell/ToolRail.css src/components/Shell/ToolRail.test.tsx src/App.tsx src/styles/App.css
git commit -m "feat(shell): add vertical tool rail with collapse"
```

### Task 4: Create Context Panel Shell and Mode Switch Rendering

**Files:**
- Create: `src/components/Shell/ContextPanel.tsx`
- Create: `src/components/Shell/ContextPanel.css`
- Create: `src/components/Shell/ContextPanel.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles/App.css`

**Step 1: Write the failing test**

In `ContextPanel.test.tsx`, verify:
- notes mode renders notes panel slot
- search mode renders search panel slot
- graph mode renders graph control + context slots
- collapse button toggles panel hidden state class

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/components/Shell/ContextPanel.test.tsx`
Expected: FAIL because component does not exist.

**Step 3: Write minimal implementation**

Create `ContextPanel` with props:
- `mode`
- `collapsed`
- `width`
- `onToggleCollapse`
- `notesContent`, `searchContent`, `graphControlsContent`, `graphContextContent`

Wire into `App.tsx` and keep existing core features intact.

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/components/Shell/ContextPanel.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/Shell/ContextPanel.tsx src/components/Shell/ContextPanel.css src/components/Shell/ContextPanel.test.tsx src/App.tsx src/styles/App.css
git commit -m "feat(shell): add contextual panel with mode-based rendering"
```

### Task 5: Rehost Existing Features into New Shell Regions

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/Sidebar/index.tsx`
- Modify: `src/components/SearchBox/index.tsx` (if layout wrapper assumptions break)
- Modify: `src/components/GraphView/index.tsx` (if embedded dimensions need updates)
- Modify: `src/App.test.tsx`

**Step 1: Write the failing test**

Extend `src/App.test.tsx` to verify:
- Notes mode shows note tree panel (sidebar-derived content)
- Search mode shows search UI in contextual panel
- Graph mode shows split contextual panel and main graph/editor behavior remains functional

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/App.test.tsx`
Expected: FAIL on new shell assertions.

**Step 3: Write minimal implementation**

- Decompose old `Sidebar` into reusable content blocks (or create wrappers) so it can render inside contextual panel.
- Keep `Editor` as dominant center surface.
- Keep graph/editor toggle behavior compatible with current test coverage.

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/App.test.tsx src/components/SearchBox/index.test.tsx src/components/GraphView/index.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/App.tsx src/App.test.tsx src/components/Sidebar/index.tsx src/components/SearchBox/index.tsx src/components/GraphView/index.tsx
git commit -m "refactor(shell): place notes search graph tools in contextual panel"
```

### Task 6: Add Graph Context Split (Controls + Node Context)

**Files:**
- Create: `src/components/GraphView/GraphContextPanel.tsx`
- Create: `src/components/GraphView/GraphContextPanel.test.tsx`
- Modify: `src/lib/api.ts` (if additional graph context fetch helpers are needed)
- Modify: `src/App.tsx`

**Step 1: Write the failing test**

Add tests for `GraphContextPanel`:
- shows control section (depth/reset placeholders)
- shows selected node info and neighbors/backlinks section
- empty state when no selected node

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/components/GraphView/GraphContextPanel.test.tsx`
Expected: FAIL because file/component missing.

**Step 3: Write minimal implementation**

Implement a presentational context panel first (YAGNI):
- static controls wired to callbacks
- selected node data passed via props
- populate using already-available graph data paths where possible

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/components/GraphView/GraphContextPanel.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/GraphView/GraphContextPanel.tsx src/components/GraphView/GraphContextPanel.test.tsx src/App.tsx src/lib/api.ts
git commit -m "feat(graph): add contextual graph controls and node context panel"
```

### Task 7: Apply Quiet Editorial Visual System Tokens

**Files:**
- Modify: `src/styles/global.css`
- Modify: `src/styles/App.css`
- Modify: `src/components/Editor/Editor.css`
- Modify: `src/components/Shell/ToolRail.css`
- Modify: `src/components/Shell/ContextPanel.css`

**Step 1: Write the failing visual regression test (class-level)
**

In `src/App.test.tsx`, add assertions for:
- shell class markers: `app-shell--comfortable`, `tool-rail--collapsed` etc.
- content surface class on main area

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/App.test.tsx`
Expected: FAIL until classes/tokens are wired.

**Step 3: Write minimal implementation**

- Add warm neutral token set and typography token hooks.
- Ensure content region max line length and generous spacing.
- Keep chrome subdued, content contrast higher.
- Add smooth but minimal transitions for panel collapse.

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/App.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/styles/global.css src/styles/App.css src/components/Editor/Editor.css src/components/Shell/ToolRail.css src/components/Shell/ContextPanel.css src/App.test.tsx
git commit -m "style(shell): apply quiet editorial tokens and comfortable density"
```

### Task 8: Add Keyboard Navigation and Shortcuts for Shell Modes

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Step 1: Write the failing test**

In `src/App.test.tsx` add tests:
- `Ctrl/Cmd+1` activates Notes mode
- `Ctrl/Cmd+2` activates Search mode
- `Ctrl/Cmd+3` activates Graph mode
- shortcuts do nothing when no vault open (if intended)

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/App.test.tsx`
Expected: FAIL for new shortcut expectations.

**Step 3: Write minimal implementation**

Add a single `keydown` effect in `App.tsx` that maps shortcuts to `setShellToolMode`.

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/App.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat(shell): add keyboard mode switching shortcuts"
```

### Task 9: Add Optional Right Inspector Rail (Default Hidden)

**Files:**
- Create: `src/components/Shell/InspectorRail.tsx`
- Create: `src/components/Shell/InspectorRail.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles/App.css`

**Step 1: Write the failing test**

Add tests for inspector rail:
- hidden by default
- opens with toggle action
- closes and persists per vault

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/components/Shell/InspectorRail.test.tsx src/App.test.tsx`
Expected: FAIL because feature not implemented.

**Step 3: Write minimal implementation**

Create simple rail component and integrate with shell state/persistence.

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/components/Shell/InspectorRail.test.tsx src/App.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/Shell/InspectorRail.tsx src/components/Shell/InspectorRail.test.tsx src/App.tsx src/styles/App.css
git commit -m "feat(shell): add optional right inspector rail"
```

### Task 10: Verification, Documentation, and Final Audit

**Files:**
- Create: `docs/audit/app-shell-verification-2026-02-20.md`
- Modify: `docs/specs/system/spec-map.md`
- Modify: `docs/PROJECT_STATE.md`

**Step 1: Write verification checklist test cases**

Add/confirm tests cover:
- shell mode switching
- panel collapse behavior
- per-vault persistence
- graph panel split behavior

**Step 2: Run full verification**

Run:
```bash
npm run -s typecheck
npm run -s lint
npm test -- --run
```
Expected: all PASS.

**Step 3: Write audit report**

Create `docs/audit/app-shell-verification-2026-02-20.md` with compliance matrix and command outputs summary.

**Step 4: Update project tracking docs**

Update spec-map and project state with implementation status.

**Step 5: Commit**

```bash
git add docs/audit/app-shell-verification-2026-02-20.md docs/specs/system/spec-map.md docs/PROJECT_STATE.md
git commit -m "docs(shell): add verification report and update project state"
```

## Final Validation Commands

```bash
npm run -s typecheck
npm run -s lint
npm test -- --run
```

## Notes for Execution
- Keep features incremental and shippable after each task.
- Preserve existing behavior for note editing, search, and graph rendering while moving layout containers.
- Do not introduce unnecessary abstractions; prefer composition over new global complexity.
