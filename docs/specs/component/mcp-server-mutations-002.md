# MCP Server Mutations and Directory Tools

## Metadata
- ID: `COMP-MCP-SERVER-002`
- Scope: `component`
- Status: `designed`
- Parent: `COMP-MCP-SERVER-001`, `COMP-NOTE-001`, `COMP-EXPLORER-TREE-001`
- Concerns: `[REL, CONF]`
- Trace: `DESIGN-mcp-server-mutations-directory-tools`
- Created: `2026-02-20`
- Updated: `2026-02-20`

## Purpose
Extend MCP tooling with note mutation and directory management operations needed for agent-driven vault editing.

## Functional Requirements
- FR-1: `create_note` tool MUST create a new note at `path` with optional `content` and fail if note exists.
- FR-2: `delete_note` tool MUST delete a note by `path`.
- FR-3: `replace_note` tool MUST replace/save note content at `path`.
- FR-4: `create_directory` tool MUST create a directory path inside vault.
- FR-5: `remove_directory` tool MUST remove a directory, defaulting `recursive=true` when omitted.
- FR-6: `rename_directory` tool MUST rename/move a directory from `old_path` to `new_path`.
- FR-7: `list_directory` tool MUST list direct entries for a vault-relative directory path.
- FR-8: Directory paths for `list_directory` MUST reject absolute paths and traversal segments (`..`).

## Acceptance Criteria
- AC-1: `tools/list` includes all seven new tools.
- AC-2: Test verifies note create/replace/delete workflow via MCP.
- AC-3: Test verifies directory create/list/rename/remove workflow via MCP.
- AC-4: Invalid directory path for `list_directory` returns JSON-RPC invalid params style error.

## Verification Strategy
- Rust unit tests in `src-tauri/src/mcp.rs` for new tool behavior.
- Targeted compile/test verification via cargo.
