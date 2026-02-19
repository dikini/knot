# Implementation Plan: Vault UI

## Metadata
- Spec: `docs/specs/component/vault-ui-001.md`
- Generated: `2026-02-19`
- Approach: `sequential` (each task depends on previous)

## Summary
- Total tasks: 8
- Size: 4 Small, 4 Medium
- Critical path: VUI-001 → VUI-002 → VUI-003 → VUI-004 → VUI-005 → VUI-006 → VUI-007 → VUI-008

## Prerequisites

1. Add Tauri dialog plugin npm dependency
2. Update capabilities for dialog permission

## Tasks

### Phase 1: Setup

| ID | Task | Size | Depends | Spec Ref |
|----|------|------|---------|----------|
| VUI-001 | Add dialog plugin npm dependency | S | - | Setup |
| VUI-002 | Update capabilities for dialog permission | S | VUI-001 | Setup |

### Phase 2: Backend Commands

| ID | Task | Size | Depends | Spec Ref |
|----|------|------|---------|----------|
| VUI-003 | Add `open_vault_dialog` Rust command | M | VUI-002 | FR-1 |
| VUI-004 | Add `create_vault_dialog` Rust command | M | VUI-003 | FR-2 |
| VUI-005 | Add recent vaults persistence (Rust) | M | VUI-004 | FR-3 |

### Phase 3: Frontend Integration

| ID | Task | Size | Depends | Spec Ref |
|----|------|------|---------|----------|
| VUI-006 | Add dialog API functions (TypeScript) | S | VUI-003 | Interface |
| VUI-007 | Update App.tsx with new UI | M | VUI-006 | All FRs |
| VUI-008 | Add recent vaults display | M | VUI-005, VUI-007 | FR-3 |

## Task Details

### VUI-001: Add dialog plugin npm dependency
```
npm install @tauri-apps/plugin-dialog
```

### VUI-002: Update capabilities
Edit `src-tauri/capabilities/default.json`:
```json
{
  "permissions": [
    "core:default",
    "dialog:default"
  ]
}
```

### VUI-003: Add `open_vault_dialog` Rust command
Location: `src-tauri/src/commands/vault.rs`
- Import `tauri_plugin_dialog::DialogExt`
- Add command that opens directory picker
- Validate selected path has `.vault/`
- Call existing `VaultManager::open()`
- Register command in `main.rs`

### VUI-004: Add `create_vault_dialog` Rust command
Location: `src-tauri/src/commands/vault.rs`
- Add command that opens directory picker
- Check if directory is empty
- Show confirmation dialog if not empty (using dialog::ask)
- Call existing `VaultManager::create()`
- Register command in `main.rs`

### VUI-005: Add recent vaults persistence
Location: `src-tauri/src/config.rs` or new `src-tauri/src/recent_vaults.rs`
- Add `RecentVaults` struct with Vec of paths + timestamps
- Load/save to app config directory
- Commands: `get_recent_vaults()`, `add_recent_vault(path)`
- Auto-add when vault opened/created
- Limit to 5 entries, sort by opened_at

### VUI-006: Add dialog API functions
Location: `src/lib/api.ts`
```typescript
export async function openVaultDialog(): Promise<VaultInfo>;
export async function createVaultDialog(): Promise<VaultInfo>;
export async function getRecentVaults(): Promise<RecentVault[]>;
export async function addRecentVault(path: string): Promise<void>;
```

### VUI-007: Update App.tsx
- Replace text input with "Open Vault" and "Create New Vault" buttons
- Add error banner with dismiss button
- Add loading spinner overlay
- Remove manual path input (or keep as fallback)

### VUI-008: Add recent vaults display
- Add RecentVaults component or section in App.tsx
- Display name + truncated path
- Click to open
- Update Zustand store to call `addRecentVault` on open

## Dependency DAG
```
VUI-001 → VUI-002 → VUI-003 → VUI-004 → VUI-005
                           ↘
                            VUI-006 → VUI-007 → VUI-008
```

## Acceptance Criteria Verification

| Criteria | Task | Verification |
|----------|------|--------------|
| Directory picker opens | VUI-003, VUI-004 | Manual test |
| Recent vaults display | VUI-008 | Manual test |
| Errors display clearly | VUI-007 | Visual inspection |
| Loading state works | VUI-007 | Manual test |
| Create warns on non-empty | VUI-004 | Manual test |
| Open validates vault | VUI-003 | Manual test |
| Recent vaults persist | VUI-005 | Unit test |

## Commands

```bash
# Test after each phase
cargo check
cargo test
npm run typecheck

# Run dev
npm run tauri dev
```
