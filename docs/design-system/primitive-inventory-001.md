# UI Primitive Inventory and Usage Contracts

Trace: `DESIGN-ui-qa-dx-001`
Spec: `docs/specs/component/ui-quality-assurance-dx-001.md`

## Purpose
Capture current primitive components and their usage contracts so implementation and documentation stay aligned.

## Primitive Inventory

### `IconButton`
- File: `src/components/IconButton/index.tsx`
- Stories: `src/components/IconButton/IconButton.stories.tsx`
- Role: base icon-first action control for rails and mode toggles.
- Contract:
  - Required props: `icon`, `label`
  - Optional: `showLabel`, `active`
  - Accessibility: `aria-label` and `title` from `label`
- Variants:
  - icon-only (`showLabel=false`)
  - icon+label (`showLabel=true`)
  - active state (`active=true`)

### `ToolRail`
- File: `src/components/Shell/ToolRail.tsx`
- Stories: `src/components/Shell/ToolRail.stories.tsx`
- Role: primary shell mode selector (`notes`, `search`, `graph`).
- Contract:
  - Controlled by `mode` and `onModeChange`
  - Label visibility policy via `showLabels`
  - Uses `IconButton` as internal primitive

### `ContextPanel`
- File: `src/components/Shell/ContextPanel.tsx`
- Stories: `src/components/Shell/ContextPanel.stories.tsx`
- Role: mode-dependent contextual surface for notes/search/graph.
- Contract:
  - Returns `null` when `collapsed=true`
  - For `mode=graph`, renders separate controls/context sections
  - Width is controlled by parent shell state

### `VaultSwitcher`
- File: `src/components/VaultSwitcher/index.tsx`
- Stories: `src/components/VaultSwitcher/VaultSwitcher.stories.tsx`
- Role: vault identity and vault-switch actions/dropdown menu.
- Contract:
  - Supports both vault-open and no-vault states
  - Exposes callbacks for open/create/recent/close operations
  - Uses menu/menuitem semantics

## Composition Map (Implemented Screens -> Primitives)
- App shell mode controls (`src/App.tsx`) -> `IconButton`
- Tool rail (`src/components/Shell/ToolRail.tsx`) -> `IconButton`
- Context panel shell (`src/components/Shell/ContextPanel.tsx`) -> panel primitive contract
- Vault entry point (`src/components/VaultSwitcher/index.tsx`) -> switcher primitive contract

## Usage Contracts (Do / Do Not)

### Buttons and Actions
Do:
1. Use `IconButton` for icon-driven shell/chrome actions.
2. Keep `label` meaningful; it drives accessibility metadata.
3. Prefer `active` prop for selected/toggled visual state.

Do Not:
1. Introduce ad-hoc icon button markup when `IconButton` fits.
2. Hide semantics in tooltip-only labels.

### Shell Surfaces
Do:
1. Keep `ToolRail` and `ContextPanel` controlled from global shell state.
2. Use mode-driven rendering boundaries (`notes`, `search`, `graph`) consistently.

Do Not:
1. Add mode-specific branch logic outside shell/controller layers without spec update.
2. Duplicate shell controls in unrelated components.

### Storybook Coverage Policy
Do:
1. Add/update `*.stories.tsx` when changing primitive behavior.
2. Capture key state variants in stories before/with implementation changes.

Do Not:
1. Merge primitive behavior changes without corresponding story updates.

