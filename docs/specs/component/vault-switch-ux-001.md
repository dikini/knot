# Vault Switch Unsaved UX Guard

## Metadata
- ID: `COMP-VAULT-SWITCH-UX-001`
- Scope: `component`
- Status: `implemented`
- Parent: `COMP-VAULT-UNSAVED-001`
- Concerns: `[CONF, REL]`
- Created: `2026-02-22`
- Updated: `2026-02-22`

## Purpose
Provide a deterministic in-app decision flow when switching vaults with unsaved note edits so users can save, discard, or cancel before backend guard errors occur.

## Contract

### Functional Requirements
**FR-1**: Vault switch actions (`Open Vault`, `Open Recent`) MUST check editor dirty state before invoking backend vault-open commands.

**FR-2**: When dirty state exists, user MUST be prompted with save-vs-discard choice.

**FR-3**: If user chooses save, current note content MUST be saved before vault switch attempt.

**FR-4**: If save fails, vault switch MUST be cancelled and an error toast shown.

**FR-5**: If user discards, local dirty state and backend unsaved flag MUST be cleared before vault switch attempt.

### Behavior
**Given** current note has unsaved edits
**When** user opens another vault
**Then** app prompts and only proceeds according to user decision.

**Given** user chose save and save operation fails
**When** vault switch is attempted
**Then** switch is blocked and current vault remains active.

## Design Decisions
| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Use shared helper for unsaved resolution in `App.tsx` | Keeps Open Vault and Open Recent behavior identical | Adds one abstraction layer |
| Reuse existing `confirm()` prompt style | Consistent with current note-switch UX and minimal UI scope | Limited prompt button semantics |
| Clear backend unsaved flag before switching on save/discard | Avoid race against backend vault guard | Requires extra API call |

## Concern Mapping
| Concern | Requirement | Implementation Strategy |
| --- | --- | --- |
| CONF | FR-2, FR-3, FR-5 | Explicit user choice before irreversible context switch |
| REL | FR-1, FR-4, FR-5 | Cancel on failures and preserve current vault state |

## Acceptance Criteria
- [ ] Open Vault and Open Recent both run unsaved-check flow before opening target vault.
- [ ] Save path triggers note save and then proceeds on success.
- [ ] Save failure blocks switch and shows error feedback.
- [ ] Discard path clears dirty state and proceeds.
- [ ] Unit tests cover save success, save failure, discard, and clean-state passthrough.

## Verification Strategy
- Add unit tests for helper logic and App integration points.
- Run targeted frontend tests and typecheck.

## Related
- Depends on: [`COMP-VAULT-UNSAVED-001`]
- Touchpoints: `src/App.tsx`, `src/lib/api.ts`, `src/lib/store.ts`
