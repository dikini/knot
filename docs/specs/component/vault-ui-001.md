# Vault UI Component

## Metadata

- ID: `COMP-VAULT-UI-001`
- Scope: `component`
- Status: `implemented`
- Parent: `COMP-VAULT-001`, `COMP-FRONTEND-001`
- Concerns: [REL, SEC, CONF]
- Created: `2026-02-19`
- Verified: `2026-02-19` (100% compliance)

## Purpose

Provide an intuitive, user-friendly interface for opening and creating vaults. Replace the manual path text input with a proper directory picker dialog, add separate flows for open vs create, and display recent vaults for quick access.

## Contract

### Functional Requirements

**FR-1**: Open existing vault via directory picker

- User clicks "Open Vault" button
- Native directory picker dialog opens
- User selects directory containing `.vault/` subdirectory
- Vault opens and loads
- Errors displayed clearly (vault not found, permission denied, etc.)

**FR-2**: Create new vault via directory picker

- User clicks "Create New Vault" button
- Native directory picker dialog opens
- User selects empty or non-existent directory
- If directory not empty, show confirmation warning
- Vault created and opened

**FR-3**: Display recent vaults list

- Show last 5 opened vaults
- Each entry shows vault name and path (truncated if long)
- Click entry to open vault directly
- Persist recent vaults list across sessions

**FR-4**: Clear error display

- Errors from backend shown in banner
- Dismissible by user
- Auto-clear on successful operation

**FR-5**: Loading states

- Show spinner during open/create operations
- Disable buttons while operation in progress
- Prevent duplicate submissions

**FR-6**: Validation

- Open: Verify `.vault/` exists in selected directory
- Create: Warn if directory not empty (but allow)
- Reject paths that are files (not directories)

### Interface (TypeScript)

```typescript
// New API functions to add
export async function openVaultDialog(): Promise<VaultInfo>;
export async function createVaultDialog(): Promise<VaultInfo>;
export async function getRecentVaults(): Promise<RecentVault[]>;
export async function addRecentVault(path: string): Promise<void>;

export interface RecentVault {
  path: string;
  name: string;
  opened_at: number; // timestamp
}
```

### Interface (Rust)

```rust
// New commands to add
#[tauri::command]
pub async fn open_vault_dialog(
    window: tauri::Window,
    state: State<'_, AppState>
) -> Result<VaultInfo, String>;

#[tauri::command]
pub async fn create_vault_dialog(
    window: tauri::Window,
    state: State<'_, AppState>
) -> Result<VaultInfo, String>;

#[tauri::command]
pub async fn get_recent_vaults(state: State<'_, AppState>) -> Result<Vec<RecentVault>, String>;

#[tauri::command]
pub async fn add_recent_vault(path: String, state: State<'_, AppState>) -> Result<(), String>;

#[derive(Serialize)]
pub struct RecentVault {
    path: String,
    name: String,
    opened_at: i64,
}
```

### Behavior

**Given** no vault is open
**When** user clicks "Open Vault"
**Then** directory picker opens, user selects vault directory, vault opens

**Given** directory without `.vault/` selected for open
**When** user confirms
**Then** error shown "No vault found at this location"

**Given** user selects directory for create
**When** directory contains files
**Then** confirmation dialog shows "Directory not empty. Create vault here anyway?"

**Given** vault successfully opened
**When** operation completes
**Then** vault added to recent vaults list, UI updates to show vault

## Design Decisions

| Decision                        | Rationale                         | Trade-off                |
| ------------------------------- | --------------------------------- | ------------------------ |
| Use Tauri dialog plugin         | Native look, proper permissions   | Adds dependency          |
| Separate open/create buttons    | Clearer UX, different validation  | Slightly more UI         |
| Persist recent vaults in config | Simple, works across restarts     | Per-user, not per-vault  |
| Store full path (not relative)  | Works with any location           | Paths may break if moved |
| Show 5 recent vaults            | Balance of convenience vs clutter | Can be adjusted          |

## Concern Mapping

| Concern  | Requirement               | Implementation Strategy                                           |
| -------- | ------------------------- | ----------------------------------------------------------------- |
| REL-001  | Clear error handling      | All errors mapped to user-friendly messages                       |
| SEC-001  | Path validation           | Verify paths are directories, not symlinks to sensitive locations |
| CONF-001 | Recent vaults persistence | Store in VaultConfig or separate app config                       |

## Acceptance Criteria

- [ ] Directory picker opens on "Open Vault" click
- [ ] Directory picker opens on "Create Vault" click
- [ ] Recent vaults display and are clickable
- [ ] Errors display clearly and are dismissible
- [ ] Loading state prevents duplicate clicks
- [ ] Create warns on non-empty directory
- [ ] Open validates vault exists
- [ ] Recent vaults persist across app restarts

## Verification Strategy

- Manual UI testing (dialog interaction)
- Unit tests for validation logic
- Integration test for recent vaults persistence

## Related

- Depends on: `COMP-VAULT-001`, Tauri dialog plugin
- Used by: Frontend main UI
- Extracted from: `docs/specs/extracted/vault-001.md`, `docs/specs/extracted/frontend-001.md`
