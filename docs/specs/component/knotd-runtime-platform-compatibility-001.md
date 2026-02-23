# Knotd Runtime Platform Compatibility

## Metadata
- ID: `COMP-KNOTD-RUNTIME-001`
- Scope: `component`
- Status: `draft`
- Parent: `COMP-VAULT-001`, `COMP-MCP-SERVER-001`
- Concerns: `[REL, CONF, CAP]`
- Trace: `DESIGN-knotd-runtime-platform-compatibility`
- Created: `2026-02-23`
- Updated: `2026-02-23`

## Purpose
Introduce shared runtime infrastructure that enables a single vault-owner model for desktop and an Android-compatible embedded runtime model, without implementing an Android client in this phase.

## Current State
- Tauri app state owns `VaultManager` directly via `AppState`.
- MCP server owns a separate `VaultManager` instance.
- Lock contention can occur when multiple processes open the same vault/index.
- There is no explicit runtime contract for mobile lifecycle compatibility.

## Functional Requirements
- FR-1: The backend MUST provide a runtime host abstraction that owns vault session state (`VaultManager`), unsaved-change flags, and lifecycle metadata.
- FR-2: The runtime host MUST expose explicit runtime modes covering desktop daemon-capable and Android embedded compatibility.
- FR-3: `AppState` MUST delegate vault ownership to the runtime host while preserving existing command access patterns.
- FR-4: The runtime host MUST classify lock-contention startup failures into a stable machine-usable status.
- FR-5: MCP infrastructure MUST support construction from the shared runtime host for future single-owner integration.
- FR-6: The runtime host MUST expose compatibility lifecycle hooks for Android embedding (`foreground`, `background`, checkpoint timestamp) without requiring Android client code.
- FR-7: Repository documentation MUST define desktop operating procedures for single-owner startup, attach, reindex, and recovery.
- FR-8: Tests MUST validate runtime lifecycle behavior (no vault open, open/close transitions, unsaved flag, lock classification).

## Acceptance Criteria
- AC-1: New runtime module compiles and is exported from library root.
- AC-2: Runtime unit tests cover no-session errors, open/close semantics, unsaved flag semantics, and lock-contention classification.
- AC-3: `AppState` uses runtime host internally and existing command compilation remains intact.
- AC-4: MCP server can be instantiated using runtime host constructor while preserving existing constructor behavior.
- AC-5: Desktop runbook doc exists with startup/attach/reindex/recovery procedures.

## Design Decisions
| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Add `runtime` module as shared infrastructure | Creates portable ownership contract independent of UI/client | Adds one more abstraction layer |
| Preserve current Tauri command signatures | Minimize integration risk during foundational refactor | Full command migration to runtime API can be phased |
| Add MCP constructor from runtime host now | Enables incremental migration toward single-owner kernel model | Does not fully eliminate separate-process lock contention yet |
| Add Android lifecycle compatibility hooks as no-op/metadata | De-risks future embedding work without client scope creep | Hooks are preparatory rather than feature-complete |

## Non-Goals
- Implementing Android UI/client integration.
- Full daemonized `knotd` process and IPC protocol in this phase.
- Eliminating all lock contention scenarios across independent external processes.

## Verification Strategy
- Run targeted Rust tests for new runtime module and MCP/runtime integration.
- Run crate compile checks for backend binaries and library.
- Produce verification note summarizing FR/AC coverage.
