# Left Pane Recovery Guard

## Metadata
- ID: `COMP-LAYOUT-RECOVERY-001`
- Scope: `component`
- Status: `implemented`
- Concerns: `[REL, CONF]`
- Created: `2026-02-20`
- Updated: `2026-02-20`

## Purpose
Prevent dead-end UI states by making the leftmost tool rail non-collapsible and auto-healing legacy persisted collapsed state.

## Contract

### Functional Requirements
**FR-1**: The leftmost tool rail must be non-collapsible in the current shell UI.

**FR-2**: If a legacy persisted state marks the tool rail as collapsed, app logic must auto-expand it.

**FR-3**: Recovery behavior must be covered by automated test(s).

## Behavior
**Given** a vault is open and persisted shell state marks tool rail as collapsed  
**When** app hydrates shell state  
**Then** tool rail is restored to expanded and stays non-collapsible.

## Acceptance Criteria
- [x] Tool rail collapse control is removed from UI.
- [x] Legacy collapsed tool-rail state triggers automatic tool-rail expansion.
- [x] App tests include a regression case for this condition.

## Verification Strategy
- `src/App.test.tsx` recovery scenario.
- Typecheck and lint on changed App files.
