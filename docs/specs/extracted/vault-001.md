# Vault Management

## Metadata
- ID: `COMP-VAULT-001`
- Source: `extracted`
- Component: `vault`
- Depth: `standard`
- Extracted: `2026-02-19`
- Concerns: [REL, SEC, CAP]

## Source Reference
- Codebase: `src-tauri/src/`
- Entry Points: 
  - `core/vault.rs` (VaultManager)
  - `commands/vault.rs` (Tauri commands)
  - `state.rs` (AppState)
- Lines Analyzed: ~650

## Confidence Assessment
| Requirement | Confidence | Evidence | Needs Review |
|-------------|------------|----------|--------------|
| FR-1: Create vault | high | Implementation + tests in `core/vault.rs:40-79` | no |
| FR-2: Open vault | high | Implementation + tests in `core/vault.rs:82-119` | no |
| FR-3: Close vault | high | Implementation in `core/vault.rs:122-135` | no |
| FR-4: Get vault info | high | Implementation in `commands/vault.rs:114-137` | no |
| FR-5: Check vault status | high | Implementation in `state.rs:35-38` | no |
| FR-6: List recent notes | high | Implementation in `commands/vault.rs:142-164` | no |
| FR-7: Sync files to DB | medium | Implementation in `core/vault.rs:318-363`, no tests | yes |
| FR-8: File watching | low | Stub in `core/vault.rs:369-374`, TODO comment | yes |

## Contract

### Functional Requirements

**FR-1**: Create a new vault at a specified filesystem path
- Evidence: `core/vault.rs:40-79`
- Confidence: high
- Behavior: Creates `.vault/` directory with config, database, and search index; imports existing `.md` files
- Errors: Returns `VaultAlreadyExists` if vault directory exists

**FR-2**: Open an existing vault at a specified filesystem path
- Evidence: `core/vault.rs:82-119`
- Confidence: high
- Behavior: Loads config, opens database and search index, rebuilds link graph, optionally starts file watcher
- Errors: Returns `VaultNotFound` if `.vault/` directory doesn't exist

**FR-3**: Close the currently open vault
- Evidence: `core/vault.rs:122-135`
- Confidence: high
- Behavior: Stops file watcher, closes search index, releases resources
- Errors: None (idempotent)

**FR-4**: Get vault metadata (path, name, note count, last modified)
- Evidence: `commands/vault.rs:93-105`, `commands/vault.rs:114-137`
- Confidence: high
- Returns: `VaultInfo { path, name, note_count, last_modified }`

**FR-5**: Check if a vault is currently open
- Evidence: `state.rs:35-38`, `commands/vault.rs:108-111`
- Confidence: high
- Returns: boolean

**FR-6**: List recently modified notes
- Evidence: `commands/vault.rs:142-164`
- Confidence: high
- Parameters: `limit: usize` - maximum number of notes to return
- Returns: Sorted list of `NoteSummary` by modified_at descending

**FR-7**: Sync files from filesystem to database
- Evidence: `core/vault.rs:318-363`
- Confidence: medium
- Behavior: Scans vault directory for `.md` files, updates database and search index
- Note: Used during vault creation to import existing notes

**FR-8**: File system watching for external changes
- Evidence: `core/vault.rs:369-374`
- Confidence: low
- Status: Stub implementation, TODO comment indicates not yet implemented

### Interface (Rust)

```rust
// Core type
pub struct VaultManager {
    root: PathBuf,
    config: VaultConfig,
    db: Database,
    search: SearchIndex,
    graph: LinkGraph,
    watcher: Option<FileWatcher>,
}

impl VaultManager {
    pub fn create(root: &Path) -> Result<Self>;
    pub fn open(root: &Path) -> Result<Self>;
    pub fn close(&mut self) -> Result<()>;
    pub fn root_path(&self) -> &Path;
    pub fn config(&self) -> &VaultConfig;
    pub fn vault_dir(&self) -> PathBuf;
    pub fn note_count(&self) -> Result<usize>;
    pub fn list_notes(&self) -> Result<Vec<NoteMeta>>;
    pub fn get_note(&self, path: &str) -> Result<Note>;
    pub fn save_note(&mut self, path: &str, content: &str) -> Result<()>;
    pub fn delete_note(&mut self, path: &str) -> Result<()>;
    pub fn rename_note(&mut self, old_path: &str, new_path: &str) -> Result<()>;
    pub fn search(&self, query: &str, limit: usize) -> Result<Vec<SearchResult>>;
    pub fn graph(&self) -> &LinkGraph;
    pub fn graph_neighbors(&self, path: &str, depth: usize) -> Vec<String>;
    pub fn graph_layout(&self, width: f64, height: f64) -> GraphLayout;
}

// Tauri Commands
#[tauri::command]
pub async fn create_vault(path: String, state: State<'_, AppState>) -> Result<VaultInfo, String>;

#[tauri::command]
pub async fn open_vault(path: String, state: State<'_, AppState>) -> Result<VaultInfo, String>;

#[tauri::command]
pub async fn close_vault(state: State<'_, AppState>) -> Result<(), String>;

#[tauri::command]
pub async fn get_vault_info(state: State<'_, AppState>) -> Result<VaultInfo, String>;

#[tauri::command]
pub async fn is_vault_open(state: State<'_, AppState>) -> Result<bool, String>;

#[tauri::command]
pub async fn get_recent_notes(limit: usize, state: State<'_, AppState>) -> Result<Vec<NoteSummary>, String>;
```

### Interface (TypeScript)

```typescript
export interface VaultInfo {
  path: string;
  name: string;
  note_count: number;
  last_modified: number;
}

// API functions
export async function createVault(path: string): Promise<VaultInfo>;
export async function openVault(path: string): Promise<VaultInfo>;
export async function closeVault(): Promise<void>;
export async function getVaultInfo(): Promise<VaultInfo | null>;
export async function isVaultOpen(): Promise<boolean>;
export async function getRecentNotes(limit?: number): Promise<NoteSummary[]>;
```

### Behavior

**Given** no vault is open
**When** `create_vault(path)` is called with a valid path
**Then** a new vault is created, AppState is updated, and VaultInfo is returned

**Given** a vault exists at path
**When** `open_vault(path)` is called
**Then** the vault is loaded, graph is rebuilt, and VaultInfo is returned

**Given** a vault is open
**When** `close_vault()` is called
**Then** resources are released and the vault is removed from AppState

**Given** a vault is already open
**When** `create_vault()` or `open_vault()` is called
**Then** the existing vault is closed first (with potential data loss warning needed)

## Design Decisions (Inferred)

| Decision | Evidence | Confidence |
|----------|----------|------------|
| Single vault per app instance | `state.rs:18` - `Option<VaultManager>` | high |
| Thread-safe state via Arc<Mutex<_>> | `state.rs:18` | high |
| Vault metadata in `.vault/` subdirectory | `core/vault.rs:19` - `VAULT_DIR` | high |
| Async Tauri commands | All commands use `async` | high |
| SQLite for metadata, filesystem for content | `db.rs`, `core/vault.rs:199` | high |
| Tantivy for full-text search | `core/vault.rs:16`, `search.rs` | high |
| In-memory link graph rebuilt on open | `core/vault.rs:109` | high |

## Uncertainties

- [ ] Should file watching be enabled by default? Config field exists but isn't used
- [ ] What happens to unsaved changes when switching vaults? No check implemented
- [ ] Should vault creation fail if the directory has existing files? Currently imports them
- [ ] File watcher implementation is stubbed - design decisions needed

## Acceptance Criteria (Derived from Tests)

- [ ] Vault can be created and opened (`test_create_and_open_vault`)
- [ ] Notes can be saved and retrieved (`test_save_and_get_note`)
- [ ] Only one vault can be open at a time
- [ ] Vault info correctly reports note count and timestamps

## Related
- Extracted from: `src-tauri/src/core/vault.rs`, `src-tauri/src/commands/vault.rs`, `src-tauri/src/state.rs`
- Depends on: `COMP-DATABASE-001`, `COMP-SEARCH-001`, `COMP-GRAPH-001`
- Used by: Frontend via Tauri commands
