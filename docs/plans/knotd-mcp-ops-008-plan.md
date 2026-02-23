# Knotd MCP Operations Plan
Change-Type: design-update

## Metadata
- Plan ID: `PLAN-KNOTD-OPS-008`
- Spec: `docs/specs/component/knotd-mcp-ops-008.md`
- Trace: `DESIGN-knotd-mcp-ops`
- Created: `2026-02-23`
- Updated: `2026-02-23`

## Tasks
| ID | Task | Size | Depends | Refs |
| --- | --- | --- | --- | --- |
| KOP-001 | Add knotd launcher script with probe-json preflight and serve handoff | M | - | FR-1, FR-2 |
| KOP-002 | Add codex setup script for knotd MCP and npm scripts | S | KOP-001 | FR-1, FR-3 |
| KOP-003 | Add knotd ops smoke script and checks for help/version/probe/status/capabilities | M | KOP-001 | FR-4, FR-5 |
| KOP-004 | Update docs with operational playbooks and config instructions | S | KOP-002,KOP-003 | FR-6 |
| KOP-005 | Verification run and audit report | S | KOP-001,KOP-002,KOP-003,KOP-004 | FR-1, FR-2, FR-3, FR-4, FR-5, FR-6 |

## Verification Commands
- `npm run -s knotd:mcp:smoke`
- `cargo test --manifest-path src-tauri/Cargo.toml --bin knotd -- --nocapture`
- `cargo check --manifest-path src-tauri/Cargo.toml --bin knotd`
