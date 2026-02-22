# MCP Server for Knot

## Metadata
- ID: `COMP-MCP-SERVER-001`
- Scope: `component`
- Status: `implemented`
- Parent: `COMP-FRONTEND-001`, `COMP-VAULT-001`, `COMP-NOTE-001`, `COMP-SEARCH-001`, `COMP-GRAPH-001`
- Concerns: `[REL, CONF]`
- Trace: `DESIGN-mcp-server-core-tools-resources`
- Created: `2026-02-20`
- Updated: `2026-02-22`

## Purpose
Provide a local MCP (Model Context Protocol) server for AI agents, exposing core vault operations as tools and notes as MCP resources.

## Functional Requirements
- FR-1: A standalone stdio MCP server binary MUST start with a vault path and open that vault read-only for MCP operations.
- FR-2: The MCP server MUST support `initialize` and `initialized` handshake messages.
- FR-3: The MCP server MUST expose tools: `search_notes`, `get_note`, `list_tags`, `graph_neighbors` via `tools/list` and `tools/call`.
- FR-4: `search_notes` MUST accept `query` and optional `limit` and return textual results with path/title/snippet/score.
- FR-5: `get_note` MUST accept `path` and return full markdown content plus key metadata.
- FR-6: `list_tags` MUST return all tags in sorted order.
- FR-7: `graph_neighbors` MUST accept `path` and optional `depth` and return nodes and edges.
- FR-8: MCP resources MUST expose notes as markdown resources via `resources/list` and `resources/read`.
- FR-9: Note resource URIs MUST be stable and reversible to note paths.
- FR-10: Unknown methods and invalid params MUST return JSON-RPC errors without crashing server loop.
- FR-11: Server transport MUST use framed stdio (`Content-Length`) JSON-RPC messages.

## Acceptance Criteria
- AC-1: Integration-style unit tests verify `initialize` response shape and capabilities.
- AC-2: Tests verify `tools/list` includes all four required tools.
- AC-3: Tests verify `tools/call` works for each required tool over a temporary vault.
- AC-4: Tests verify `resources/list` returns markdown note resources.
- AC-5: Tests verify `resources/read` returns note markdown text for a listed URI.
- AC-6: Tests verify invalid method/params return structured JSON-RPC errors.

## Design Decisions
| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Separate binary (`knot-mcp`) | Keeps MCP lifecycle independent from Tauri UI process | Requires vault path to be provided explicitly |
| Reuse `VaultManager` APIs | Avoids duplicate business logic and preserves behavior consistency | MCP currently read-only for core commands |
| Hex-encoded note path in URI | Stable URI and reversible mapping without extra dependencies | URIs are less human-readable |

## Non-Goals
- In-process MCP server hosted directly inside Tauri runtime.
- MCP prompts/sampling support.
- Write/mutation MCP tools (save/create/delete) in this phase.

## Verification Strategy
- Rust unit tests for MCP request handling over a temporary vault fixture.
- Validation of tool/resource payloads and JSON-RPC error semantics.
