# Knotd MCP Operations Plan
Change-Type: design-update

## Metadata
- Plan ID: `PLAN-KNOTD-OPS-008`
- Spec: `docs/specs/component/knotd-mcp-ops-008.md`
- Trace: `DESIGN-knotd-mcp-ops`
- Created: `2026-02-23`
- Updated: `2026-03-03`

## Tasks
| ID | Task | Size | Depends | Refs |
| --- | --- | --- | --- | --- |
| KOP-001 | Add knotd launcher script with probe-json preflight and serve handoff | M | - | FR-1, FR-2 |
| KOP-002 | Add codex setup script for knotd MCP and npm scripts | S | KOP-001 | FR-1, FR-3 |
| KOP-003 | Add knotd ops smoke script and checks for help/version/probe/status/capabilities | M | KOP-001 | FR-4, FR-5 |
| KOP-004 | Update docs with operational playbooks and config instructions | S | KOP-002,KOP-003 | FR-6 |
| KOP-005 | Verification run and audit report | S | KOP-001,KOP-002,KOP-003,KOP-004 | FR-1, FR-2, FR-3, FR-4, FR-5, FR-6 |
| KOP-006 | Add targeted tooling test for repo-local MCP socket override and ignore policy | S | - | FR-7, FR-8 |
| KOP-007 | Add local `.mcp/knotd-mcp.json` override for dev daemon socket and ignore it in Git | S | KOP-006 | FR-7, FR-8 |
| KOP-008 | Run targeted verification and record audit for local MCP override workflow | S | KOP-007 | AC-4, AC-5 |
| KOP-009 | Extend ignore-policy verification to cover `.run/` dev-daemon artifacts | S | - | FR-9 |
| KOP-010 | Ignore `.run/`, stop the dev daemon, and remove stale runtime artifacts | S | KOP-009 | FR-9 |
| KOP-011 | Verify `.run/` ignore behavior and record cleanup audit | S | KOP-010 | AC-6 |
| KOP-012 | Add native Rust bridge regression coverage for JSON-RPC notifications and patch request/notification forwarding | S | - | FR-10 |
| KOP-013 | Re-run native bridge handshake verification against a live daemon-backed AppImage path | S | KOP-012 | AC-7 |

## Verification Commands
- `npm run -s knotd:mcp:smoke`
- `cargo test --manifest-path src-tauri/Cargo.toml --bin knotd -- --nocapture`
- `cargo check --manifest-path src-tauri/Cargo.toml --bin knotd`
- `npm test -- --run src/tooling/knotdMcpConfig.test.ts`
- `git check-ignore -v .mcp/knotd-mcp.json`
- `git check-ignore -v .run/knotd-dev/knotd.log`
- Native AppImage `mcp bridge` handshake against a reachable daemon socket
