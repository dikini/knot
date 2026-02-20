# Implementation Plan: MCP Server Core Tools + Note Resources

Change-Type: design-update
Trace: DESIGN-mcp-server-core-tools-resources
Spec: `docs/specs/component/mcp-server-001.md`
Generated: `2026-02-20`

## Tasks

| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| MCP-001 | Add MCP protocol module with request routing and JSON-RPC responses | M | - | FR-2, FR-10 |
| MCP-002 | Implement core tool exposure (`tools/list`, `tools/call`) for four tools | M | MCP-001 | FR-3, FR-4, FR-5, FR-6, FR-7 |
| MCP-003 | Implement note resources (`resources/list`, `resources/read`) with stable URI mapping | M | MCP-001 | FR-8, FR-9 |
| MCP-004 | Implement framed stdio server loop and standalone binary `knot-mcp` | M | MCP-001, MCP-002, MCP-003 | FR-1, FR-11 |
| MCP-005 | Add tests for handshake, tools, resources, and error paths | M | MCP-002, MCP-003 | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6 |
| MCP-006 | Verify with targeted test run and type checks | S | MCP-005 | AC-1..AC-6 |

## Verification Commands
```bash
cargo test mcp::tests --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
```
