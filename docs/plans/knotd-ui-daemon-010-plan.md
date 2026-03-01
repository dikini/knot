# Knotd UI Daemon Integration Plan
Change-Type: design-update

## Metadata
- Plan ID: `PLAN-KNOTD-UI-010`
- Spec: `docs/specs/component/knotd-ui-daemon-010.md`
- Trace: `DESIGN-knotd-ui-daemon-integration`
- Created: `2026-02-23`
- Updated: `2026-02-23`

## Task Breakdown
| ID | Task | Size | Depends | Refs |
| --- | --- | --- | --- | --- |
| KUI-001 | Define daemon mode config contract (env/config key, default mode, diagnostics surface) | S | - | FR-2, FR-6 |
| KUI-002 | Add typed local IPC client module for knotd tool calls and standardized transport errors | M | KUI-001 | FR-3, FR-4, FR-7 |
| KUI-003 | Add command-layer adapter that routes selected vault/note/search commands to daemon client when mode enabled | L | KUI-002 | FR-1, FR-4, FR-5 |
| KUI-004 | Preserve DTO compatibility and add mapping tests for critical commands | M | KUI-003 | FR-5, FR-9 |
| KUI-005 | Add startup/readiness probe wiring and settings diagnostics exposure | M | KUI-002 | FR-6, FR-7 |
| KUI-006 | Ensure MCP behavior remains tools-first and resources/list disabled in integrated path | S | KUI-003 | FR-8 |
| KUI-007 | Add verification tests and runbook updates (daemon up/down scenarios) | M | KUI-003,KUI-004,KUI-005,KUI-006 | FR-1, FR-3, FR-6, FR-9 |
| KUI-008 | Normalize void mutation tool payloads to JSON values and cover daemon decode compatibility | S | KUI-004 | FR-5, FR-5.1, FR-9 |

## Milestones
- M1: Daemon mode contract + IPC client scaffold (`KUI-001`, `KUI-002`)
- M2: Command routing for core flows with DTO parity (`KUI-003`, `KUI-004`)
- M3: Startup diagnostics + verification hardening (`KUI-005`, `KUI-006`, `KUI-007`)

## Risk Assessment
| Risk | Impact | Mitigation |
| --- | --- | --- |
| Command contract drift between in-process and daemon paths | Frontend regressions | Golden tests for command DTOs and strict type checks |
| Daemon unavailable during UI usage | User-facing failures | Explicit fail-fast errors + readiness status visibility |
| Performance overhead for IPC round-trips | Perceived UI latency | Batch where feasible and keep payload minimal/tool-scoped |
| Dual-owner lock contention during migration | Reliability issues | No implicit fallback when daemon mode enabled; clear operator workflow |

## FR → Task Traceability
| FR | Tasks |
| --- | --- |
| FR-1 | KUI-003, KUI-007 |
| FR-2 | KUI-001 |
| FR-3 | KUI-002, KUI-007 |
| FR-4 | KUI-002, KUI-003 |
| FR-5 | KUI-003, KUI-004, KUI-008 |
| FR-5.1 | KUI-008 |
| FR-6 | KUI-001, KUI-005, KUI-007 |
| FR-7 | KUI-002, KUI-005 |
| FR-8 | KUI-006 |
| FR-9 | KUI-004, KUI-007 |

## Verification Commands
- `cargo test --manifest-path src-tauri/Cargo.toml --lib commands`
- `cargo test --manifest-path src-tauri/Cargo.toml --lib mcp::tests`
- `cargo check --manifest-path src-tauri/Cargo.toml`
- `npm run typecheck`
