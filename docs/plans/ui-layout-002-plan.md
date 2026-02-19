# Implementation Plan: UI Layout - Distraction-Free Design

## Metadata

- Spec: `docs/specs/component/ui-layout-002.md`
- Generated: 2026-02-19
- Approach: sequential

## Summary

- Total tasks: 6
- Size: 2 small, 4 medium
- Critical path: All tasks (sequential)

## Note: Implementation Already Exists

The UI layout is already implemented in the frontend:

- VaultSwitcher component exists (`src/components/VaultSwitcher/index.tsx`)
- New note button exists in sidebar
- Vault info panel removed from main area
- Editor takes full central area
- Welcome screen shows when no vault
- Empty state shows when vault open but no note selected

However, the workflow artifacts are missing:

- No SPEC markers in code
- No formal tests via bk-tdd
- No verification report via bk-verify

This plan focuses on adding required workflow artifacts.

## Tasks

### Phase 1: Test Development (bk-tdd)

| ID     | Task                                       | Size | Depends | Spec Ref |
| ------ | ------------------------------------------ | ---- | ------- | -------- |
| UI-001 | Write test: vault switcher in sidebar      | M    | -       | FR-1     |
| UI-002 | Write test: new note button in sidebar     | S    | -       | FR-2     |
| UI-003 | Write test: editor takes full central area | M    | -       | FR-4     |

### Phase 2: Code Markers (bk-implement-typescript)

| ID     | Task                                          | Size | Depends                | Spec Ref   |
| ------ | --------------------------------------------- | ---- | ---------------------- | ---------- |
| UI-004 | Add SPEC markers to VaultSwitcher component   | M    | UI-001                 | FR-1       |
| UI-005 | Add SPEC markers to Sidebar component         | M    | UI-002                 | FR-2, FR-6 |
| UI-006 | Add SPEC markers to Editor component          | M    | UI-003                 | FR-4       |
| UI-007 | Add SPEC markers to App.tsx for layout states | M    | UI-004, UI-005, UI-006 | FR-5, FR-6 |

### Phase 3: Verification (bk-verify)

| ID     | Task                                        | Size | Depends | Spec Ref |
| ------ | ------------------------------------------- | ---- | ------- | -------- |
| UI-008 | Run bk-verify to generate compliance report | L    | UI-007  | All FRs  |

## Dependency DAG

```
UI-001 → UI-004 ↗
UI-002 → UI-005 ↗ UI-008
UI-003 → UI-006 ↗
```

## Concern Coverage

| Concern | Tasks                          | Verification                                                         |
| ------- | ------------------------------ | -------------------------------------------------------------------- |
| CONF    | UI-004, UI-005, UI-006, UI-007 | Tests: test_vault_switcher, test_new_note_button, test_editor_layout |
| CAP     | All tasks                      | Component-level tests for rendering performance                      |

## Task Details

### UI-001: Write test: vault switcher in sidebar

**Spec Ref:** FR-1
**Acceptance:** Test passes - VaultSwitcher displays current vault name and dropdown
**Implementation:**

- Test renders VaultSwitcher component
- Test displays vault name when vault provided
- Test displays "No Vault Open" when no vault
- Test dropdown opens on click
- Test dropdown contains "Open Different Vault", "Create New Vault", recent vaults, "Close Vault"

### UI-002: Write test: new note button in sidebar

**Spec Ref:** FR-2
**Acceptance:** Test passes - New note button displays and creates note
**Implementation:**

- Test renders "+ New Note" button in sidebar header
- Test button is visible when vault open
- Test button is hidden when no vault open
- Test clicking button prompts for note name
- Test clicking button creates new note

### UI-003: Write test: editor takes full central area

**Spec Ref:** FR-4
**Acceptance:** Test passes - Editor occupies full main content area
**Implementation:**

- Test renders Editor component when note selected
- Test editor container has full width
- Test no vault info panel visible in main area
- Test toolbar only shows note title + save status

### UI-004: Add SPEC markers to VaultSwitcher component

**Spec Ref:** FR-1
**Acceptance:** SPEC markers present at component level
**Implementation:**

```typescript
// SPEC: COMP-UI-LAYOUT-002 FR-1
export function VaultSwitcher({ ... }: VaultSwitcherProps) {
```

### UI-005: Add SPEC markers to Sidebar component

**Spec Ref:** FR-2, FR-6
**Acceptance:** SPEC markers present at component level
**Implementation:**

```typescript
// SPEC: COMP-UI-LAYOUT-002 FR-2, FR-6
export function Sidebar({ ... }: SidebarProps) {
```

### UI-006: Add SPEC markers to Editor component

**Spec Ref:** FR-4
**Acceptance:** SPEC markers present at component level
**Implementation:**

```typescript
// SPEC: COMP-UI-LAYOUT-002 FR-4
export function Editor() {
```

### UI-007: Add SPEC markers to App.tsx for layout states

**Spec Ref:** FR-5, FR-6
**Acceptance:** SPEC markers present for conditional rendering
**Implementation:**

```typescript
// SPEC: COMP-UI-LAYOUT-002 FR-5, FR-6
// Welcome screen for no vault state
{!vault && (
  <div className="vault-setup">
    // ...
  </div>
)}

// Empty state for vault open but no note selected
{vault && !currentNote && (
  <div className="content-area">
    <Editor />
  </div>
)}
```

### UI-008: Run bk-verify to generate compliance report

**Spec Ref:** All FRs
**Acceptance:** Verification report in `docs/audit/ui-layout-verification-2026-02-19.md`
**Implementation:**

- Run `bk-verify --scope=component/frontend`
- Review compliance matrix
- Ensure all acceptance criteria pass
- Generate verification report

## Test Coverage Plan

| Functional Requirement | Test ID | Test Function                         |
| ---------------------- | ------- | ------------------------------------- |
| FR-1: Vault switcher   | UI-001  | `test_vault_switcher_in_sidebar`      |
| FR-2: New note button  | UI-002  | `test_new_note_button_in_sidebar`     |
| FR-4: Editor layout    | UI-003  | `test_editor_takes_full_central_area` |

## Success Criteria

- [ ] All tests pass (UI-001 through UI-003)
- [ ] SPEC markers added to all relevant components
- [ ] bk-verify reports >90% compliance
- [ ] Verification report generated in `docs/audit/`
- [ ] No regression in existing tests

## Next Steps

- **bk-tdd**: Execute tasks UI-001 through UI-003
- **bk-implement-typescript**: Execute tasks UI-004 through UI-007
- **bk-verify**: Execute task UI-008
