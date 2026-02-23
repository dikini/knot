# Knotd Runtime Platform Compatibility Plan
Change-Type: design-update

## Metadata
- Plan ID: `PLAN-KNOTD-RUNTIME-001`
- Spec: `docs/specs/component/knotd-runtime-platform-compatibility-001.md`
- Trace: `DESIGN-knotd-runtime-platform-compatibility`
- Created: `2026-02-23`
- Updated: `2026-02-23`

## Summary
Deliver shared runtime infrastructure for desktop and Android compatibility (infrastructure only), keep current command behavior stable, and prepare MCP/runtime integration for single-owner evolution.

## Task Breakdown
| ID | Task | Size | Depends | Spec Refs |
| --- | --- | --- | --- | --- |
| KRT-001 | Add runtime host module with mode, lifecycle metadata, session ownership, lock classification | M | - | FR-1, FR-2, FR-4, FR-6 |
| KRT-002 | Add runtime unit tests first (no-vault, open/close, unsaved flags, lock status) | S | - | FR-8 |
| KRT-003 | Refactor `AppState` to embed runtime host while preserving existing access methods | M | KRT-001 | FR-3 |
| KRT-004 | Add MCP constructor from runtime host and coverage tests | M | KRT-001 | FR-5, FR-8 |
| KRT-005 | Add desktop operating procedures doc for single-owner lifecycle and recovery | S | - | FR-7 |
| KRT-006 | Verification run and audit note with FR/AC mapping | S | KRT-001,KRT-002,KRT-003,KRT-004,KRT-005 | FR-1,FR-2,FR-3,FR-4,FR-5,FR-6,FR-7,FR-8 |

## Dependency Order
1. KRT-002 (tests written first)
2. KRT-001 (implementation to satisfy tests)
3. KRT-003 and KRT-004
4. KRT-005
5. KRT-006

## Test Mapping
| Test | Purpose | Spec Refs |
| --- | --- | --- |
| `runtime::tests::runtime_with_manager_fails_when_closed` | No-session error contract | FR-8 |
| `runtime::tests::runtime_open_close_roundtrip` | Session lifecycle semantics | FR-1, FR-8 |
| `runtime::tests::runtime_unsaved_changes_roundtrip` | Unsaved flag ownership | FR-1, FR-8 |
| `runtime::tests::runtime_classifies_lock_contention` | Lock status classification | FR-4, FR-8 |
| `mcp::tests::runtime_backed_server_handles_tools` | MCP constructor via runtime | FR-5, FR-8 |

## Verification Commands
- `cargo test --manifest-path src-tauri/Cargo.toml runtime::tests::`
- `cargo test --manifest-path src-tauri/Cargo.toml mcp::tests::runtime_backed_server_handles_tools`
- `cargo check --manifest-path src-tauri/Cargo.toml --lib --bins`

## Risks
- Runtime refactor could break command assumptions around direct vault mutex access.
- MCP runtime constructor must avoid deadlocks if runtime and MCP locking patterns overlap.

## Mitigations
- Preserve compatibility accessors in `AppState` while introducing runtime host.
- Keep runtime lock scope narrow in helper methods.
- Add targeted tests before behavioral changes.
