# Vault Unsaved Changes Guard

## Metadata
- ID: `COMP-VAULT-UNSAVED-001`
- Scope: `component`
- Status: `implemented`
- Parent: `COMP-VAULT-001`
- Concerns: `[REL, CONF]`
- Created: `2026-02-22`
- Updated: `2026-02-22`

## Purpose
Prevent silent data loss when replacing an open vault by enforcing an unsaved-changes check before implicit close paths (`open_vault` and `open_vault_dialog`).

## Contract

### Functional Requirements
**FR-1**: If a vault is currently open and unsaved note changes exist, `open_vault` MUST block vault replacement and return a deterministic error.

**FR-2**: If a vault is currently open and unsaved note changes exist, `open_vault_dialog` MUST block vault replacement and return a deterministic error.

**FR-3**: If no unsaved changes exist, both `open_vault` and `open_vault_dialog` MUST preserve current successful behavior.

**FR-4**: Unsaved-changes detection MUST use a single shared backend guard to keep command behavior consistent.

### Behavior
**Given** a vault is open and editor state is dirty
**When** user attempts `open_vault` with another path
**Then** command returns an unsaved-changes error and the current vault remains open.

**Given** a vault is open and editor state is clean
**When** user attempts `open_vault_dialog`
**Then** current vault is closed and the selected vault opens successfully.

## Design Decisions
| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Shared guard helper in vault command module | Avoids divergence between direct and dialog open flows | Requires both commands to route through helper |
| Fail-fast error before closing existing vault | Prevents irreversible close when dirty state exists | User needs explicit save/discard flow elsewhere |
| Keep API payload shape unchanged (string error) | Backward compatible with existing command callers | Less structured error semantics |

## Concern Mapping
| Concern | Requirement | Implementation Strategy |
| --- | --- | --- |
| REL | FR-1, FR-2, FR-4 | Centralized guard and command-level tests for both entry points |
| CONF | FR-1, FR-2, FR-3 | User-visible behavior is deterministic and non-surprising |

## Acceptance Criteria
- [ ] `open_vault` does not replace current vault when unsaved changes are present.
- [ ] `open_vault_dialog` does not replace current vault when unsaved changes are present.
- [ ] Existing open-vault success paths continue to pass when state is clean.
- [ ] Shared guard helper is used by both commands.
- [ ] Rust tests cover blocked and allowed paths.

## Verification Strategy
- Add command-level tests in `src-tauri/src/commands/vault.rs` for guarded behavior.
- Run targeted Rust tests for vault command module.

## Related
- Depends on: [`COMP-VAULT-001`]
- Touchpoints: `src-tauri/src/commands/vault.rs`, app state dirty-tracking path
