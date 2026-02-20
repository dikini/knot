# Implementation Plan: MCP Mutation and Directory Tools

Change-Type: design-update
Trace: DESIGN-mcp-server-mutations-directory-tools
Spec: `docs/specs/component/mcp-server-mutations-002.md`
Generated: `2026-02-20`

## Tasks

| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| MCP2-001 | Extend `tools/list` schemas with mutation and directory tool definitions | S | - | FR-1..FR-7 |
| MCP2-002 | Implement tool handlers for note create/delete/replace | M | MCP2-001 | FR-1, FR-2, FR-3 |
| MCP2-003 | Implement tool handlers for directory create/remove/rename/list | M | MCP2-001 | FR-4, FR-5, FR-6, FR-7 |
| MCP2-004 | Add list-directory path guard for absolute/traversal inputs | S | MCP2-003 | FR-8 |
| MCP2-005 | Add/extend MCP tests for new tools and error path | M | MCP2-002, MCP2-003, MCP2-004 | AC-1, AC-2, AC-3, AC-4 |
| MCP2-006 | Run verification and record audit | S | MCP2-005 | AC-1..AC-4 |

## Verification Commands
```bash
cargo test --lib mcp::tests --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml --bin knot-mcp
```
