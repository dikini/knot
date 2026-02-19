# Implementation Plan: UI Layout Redesign

## Metadata
- Spec: `docs/specs/component/ui-layout-002.md`
- Generated: `2026-02-19`
- Approach: `sequential`

## Summary
- Total tasks: 7
- Size: 3 Small, 4 Medium

## Tasks

| ID | Task | Size | Depends | Spec Ref |
|----|------|------|---------|----------|
| UL-001 | Create VaultSwitcher component | M | - | FR-1 |
| UL-002 | Update Sidebar with vault switcher + new note | M | UL-001 | FR-1, FR-2 |
| UL-003 | Remove vault info panel from App.tsx | S | - | FR-3 |
| UL-004 | Update App.tsx layout logic | M | UL-002, UL-003 | FR-4, FR-5 |
| UL-005 | Update Editor to full width | S | - | FR-4 |
| UL-006 | Update empty states | M | UL-004 | FR-5, FR-6 |
| UL-007 | CSS/styling adjustments | S | All | Polish |

## Task Details

### UL-001: Create VaultSwitcher component
Location: `src/components/VaultSwitcher/`

Component that shows:
- Current vault name
- Dropdown menu with:
  - Switch Vault (opens dialog)
  - Recent vaults (quick switch)
  - Close Vault
  - Create New Vault

### UL-002: Update Sidebar
Location: `src/components/Sidebar/index.tsx`

Changes:
- Add VaultSwitcher at top
- Add "+ New Note" button above note list
- Show placeholder when no vault

### UL-003: Remove vault info panel
Location: `src/App.tsx`

Delete the vault info section:
```typescript
// REMOVE this entire block:
<div className="vault-info">
  <h2>{vault.name}</h2>
  <p>Path: {vault.path}</p>
  ...
</div>
```

### UL-004: Update App.tsx layout logic
Location: `src/App.tsx`

Restructure render:
- No vault: Welcome screen in main area, sidebar placeholder
- Vault open: Sidebar with note list, main area = editor or empty state

### UL-005: Update Editor full width
Location: `src/components/Editor/Editor.css`

Ensure editor takes full available width/height of parent.

### UL-006: Update empty states
- No vault: Keep current welcome screen
- Vault open, no note: New placeholder component

### UL-007: CSS adjustments
- Sidebar width consistent
- Main area flexes properly
- Responsive behavior

## Verification

```bash
npm run typecheck
npm run tauri dev
```

Test scenarios:
1. No vault → Welcome screen in main, sidebar shows placeholder
2. Open vault → Sidebar shows notes, main area empty state
3. Select note → Sidebar highlights, editor full width
4. Switch vault via sidebar → Works correctly
5. Create note via sidebar → Creates and opens
