# UI Uses Knotd Runtime (No In-Process Vault Owner)

## Metadata
- ID: `COMP-KNOTD-UI-010`
- Scope: `component`
- Status: `draft`
- Parent: `COMP-KNOTD-IPC-009`, `COMP-KNOTD-RUNTIME-001`, `COMP-VAULT-UI-001`
- Concerns: `[REL, CONF, CAP]`
- Trace: `DESIGN-knotd-ui-daemon-integration`
- Created: `2026-02-23`
- Updated: `2026-02-23`

## Purpose
Move desktop UI backend operations from in-process `VaultManager` ownership to a local `knotd` runtime owner over Unix socket IPC, so UI and MCP attach to one authoritative vault session.

## Current State
- Tauri commands in `src-tauri/src/commands/*` currently operate on in-process `AppState` runtime/vault state.
- `knotd` can serve MCP over `--listen-unix` and own the vault/index lock.
- MCP bridge path is operational for Codex-to-knotd traffic.

## Functional Requirements
- FR-1: UI backend command layer MUST support a daemon-backed execution mode that routes vault/note/search operations through a local `knotd` IPC client instead of direct in-process `VaultManager` access.
- FR-2: Daemon-backed mode MUST be configurable (enabled/disabled) without recompilation, with deterministic fallback behavior when disabled.
- FR-3: When daemon-backed mode is enabled and `knotd` is unreachable, commands MUST fail with actionable, user-facing errors (no silent in-process fallback).
- FR-4: A typed IPC client MUST expose operations needed by current UI flows: vault status/open/close intent handling, note CRUD, directory ops, search, tags, graph neighbors.
- FR-5: Command responses in daemon-backed mode MUST preserve existing Tauri command DTO shapes used by frontend components.
- FR-6: UI startup path MUST include a non-blocking readiness probe for daemon connectivity and expose status for settings/diagnostics UX.
- FR-7: Observability MUST include structured logs identifying execution mode (`in_process` vs `daemon_ipc`), command name, and transport failure class.
- FR-8: Resources enumeration MUST remain disabled for UI/MCP startup efficiency; tool-based retrieval remains primary interface.
- FR-9: Test coverage MUST include daemon mode success paths, daemon unreachable errors, and DTO compatibility for selected critical commands.

## Acceptance Criteria
- AC-1: A feature/config switch exists and is documented for daemon-backed mode.
- AC-2: With daemon mode enabled and `knotd` running, key UI command smoke flows complete without opening a second vault owner in-process.
- AC-3: With daemon mode enabled and `knotd` down, representative commands fail fast with actionable errors.
- AC-4: Existing frontend contracts remain unchanged (`npm run typecheck` passes without frontend API edits for command response shapes).
- AC-5: Backend tests for daemon client adapter and command-level mapping pass.
- AC-6: `resources/list` remains unavailable while tool calls continue working in MCP path.

## Design Decisions
| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Add daemon IPC adapter behind command boundary | Minimizes frontend churn and preserves existing Tauri invoke API | Adds backend abstraction complexity |
| Fail fast when daemon mode enabled but daemon unavailable | Avoids hidden dual-owner lock contention behavior | Reduced resilience if daemon not managed correctly |
| Preserve DTO contract at command layer | Decouples frontend rollout from backend transport migration | Adapter mapping code must be maintained |
| Keep tools-first data access and disable resource list | Reduces startup payload/context overhead | Less resource browsing convenience |

## Non-Goals
- Android client migration in this slice.
- Remote network transport beyond local Unix socket IPC.
- Removing existing in-process path in same iteration.

## Verification Strategy
- `cargo test --manifest-path src-tauri/Cargo.toml --lib commands`
- `cargo test --manifest-path src-tauri/Cargo.toml --lib mcp::tests`
- `cargo check --manifest-path src-tauri/Cargo.toml`
- `npm run typecheck`
