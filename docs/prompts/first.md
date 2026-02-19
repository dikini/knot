 Prompt: Implement Knot Core Features to Spec

  Context

  You are orchestrating development for Knot, a Tauri-based note-taking application with a
  Rust backend and TypeScript/React frontend. The project has existing specifications extr
  acted via bk-analyze located in docs/specs/extracted/.

  Objective

  Implement the following features following the full BK development cycle (bk-design → bk
  -plan → bk-implement-rust/bk-implement-typescript → bk-verify):

  Priority 0: Foundation (Cannot proceed without)

  0. Working Vault Open/Create UI (COMP-VAULT-001, COMP-FRONTEND-001)

  • Current state: Text input for path exists but may be broken/incomplete
  • Required functionality:
    • Open existing vault: Directory picker dialog (Tauri dialog API) OR text input with v
      ation
    • Create new vault: Directory picker + confirmation if not empty
    • Error display: Clear messages for "vault not found", "already exists", permission er
    • Loading state: Show spinner during open/create operations
    • Recent vaults: (Optional but nice) List recently opened vaults for quick access
  • Acceptance: User can successfully open or create a vault through the UI without manual
    typing paths

  Priority 1: Critical (Unblock Basic Workflow)

  1. Content Loading from Filesystem (COMP-DATABASE-001, COMP-NOTE-001)
    • Fix Database::get_note_by_path() to read content from filesystem
    • Currently returns content: String::new() (see db.rs:214-220)
    • Acceptance: Notes load with full content in editor
  2. Note Selection UI (COMP-FRONTEND-001)
    • Wire sidebar note list to editor
    • Acceptance: Clicking note in sidebar loads it in editor
  3. File System Watcher (COMP-VAULT-001)
    • Implement FileWatcher to detect external changes
    • Sync filesystem changes to database/index
    • Acceptance: Editing file outside app updates it inside app

  Priority 2: Configuration & Polish

  4. Search Configuration (COMP-SEARCH-001)
    • Add SearchConfig to VaultConfig with cyrillic_threshold
    • Wire config through to is_cyrillic() function
    • Acceptance: Threshold is configurable per-vault
  5. Tag Extraction (COMP-MARKDOWN-001, COMP-DATABASE-001)
    • Parse #tag syntax from markdown content
    • Store tags in database
    • Acceptance: Tags appear in database when notes saved

  Development Workflow

  For each feature:

  1. Design (bk-design):
    • Read relevant extracted specs from docs/specs/extracted/
    • Create/update design spec in docs/specs/component/ or docs/specs/interface/
    • Address uncertainties flagged in extracted specs
  2. Plan (bk-plan):
    • Convert spec to implementation plan
    • Identify Rust vs TypeScript tasks
    • Create task list with dependencies
  3. Implement:
    • Rust: Use bk-implement-rust for backend changes
    • TypeScript: Use bk-implement-typescript for frontend changes
    • Follow existing code style (see AGENTS.md)
  4. Verify (bk-verify):
    • Run cargo test for Rust
    • Run npm run typecheck for TypeScript
    • Verify against acceptance criteria in specs
  5. Update Registry:
    • Update docs/specs/system/spec-map.md
    • Mark completed specs as stable

  Technical Notes for Vault UI

  • Use Tauri's dialog plugin for directory picking (may need to add to Cargo.toml and ena
    e)
  • Current App.tsx has basic structure but needs:
    • Proper error handling and display
    • Validation before API call
    • Visual feedback during operations
  • Reference: src-tauri/src/commands/vault.rs for backend commands

  Constraints

  • Type Safety: Strict TypeScript, no any. Rust: no unwrap() without comment
  • Tests: Every Rust module must have tests. Critical paths need integration tests.
  • Error Handling: Use KnotError types, never panic in production code
  • Documentation: Update specs if implementation deviates (with justification)

  Starting Point

  # Verify current state
  cd /home/dikini/Projects/knot
  cargo test
  npm run typecheck
  npm run tauri dev  # Test current UI state

  # Read existing specs
  cat docs/specs/extracted/vault-001.md     # Vault operations
  cat docs/specs/extracted/frontend-001.md  # UI components
  cat docs/specs/extracted/database-001.md  # For content loading

  Deliverables

  • [ ] Priority 0: Working vault open/create UI
  • [ ] Priority 1: All features implemented and tested
  • [ ] Updated specs in docs/specs/component/ (migrated from extracted/)
  • [ ] Passing test suite (cargo test, npm run typecheck)
  • [ ] Updated spec-map.md with stable status

  Begin with Priority 0 (Vault UI), then proceed to Priority 1.

  ────────────────────────────────────────────────────────────────────────────────────────
  This puts the vault UI first since nothing else matters if users can't open a vault!
