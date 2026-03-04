# Knot Tool CLI for Scripted MCP Calls

## Metadata
- ID: `COMP-KNOT-TOOL-CLI-025`
- Scope: `component`
- Status: `draft`
- Parent: `COMP-LINUX-PACKAGING-018`, `COMP-MCP-SERVER-001`, `COMP-KNOTD-OPS-008`
- Concerns: `[REL, CONF, COMP]`
- Trace: `DESIGN-knot-tool-cli-025`
- Created: `2026-03-04`
- Updated: `2026-03-04`

## Purpose
Add a launcher command surface `knot tool <command>` so operators can call exposed MCP tools from shell scripts without writing JSON-RPC envelopes manually, while keeping help output concise and discoverable.

## Contract

### Functional Requirements
- FR-1: Launcher CLI MUST accept `knot tool <command>` and execute the named MCP tool against the configured local daemon socket.
- FR-2: CLI MUST support argument passing for all valid MCP tools using a script-friendly format (`--json <payload>` and/or `--stdin-json`).
- FR-3: Top-level help output MUST show the general form for tool calls and a curated subset of example commands instead of listing all tools.
- FR-4: Curated help MUST include `list_*` commands and selected high-frequency read commands such as `get_note` and `search_notes`.
- FR-5: `knot tool <command> --help` MUST provide per-tool introspection with description and call format rendered by the CLI.
- FR-6: Per-tool introspection SHOULD source canonical tool metadata from MCP `tools/list` when daemon is reachable, with a local fallback summary when unavailable.
- FR-7: Command output MUST be script-stable: successful calls print machine-readable JSON to stdout; failures print actionable diagnostics and non-zero exit codes.
- FR-8: Unknown tool names and invalid argument payloads MUST fail fast before making a daemon request where possible.
- FR-9: Existing launcher commands (`ui`, `knotd`, `up`, `down`, `mcp`, `service`) MUST remain behavior-compatible.

### Design Decisions
| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Add `tool` as a first-class launcher namespace | Keeps operator flows under one binary and one config model | Increases launcher surface area |
| Use hybrid introspection (dynamic + fallback) | Gives accurate metadata with daemon, resilient help without daemon | Requires maintaining a fallback registry |
| Keep top-level help curated | Prevents noisy output because MCP tool count is large | Users need one extra command for full detail |
| Standardize JSON I/O for scripts | Predictable shell integration and composability | Less ergonomic for purely interactive use |

### Acceptance Criteria
- AC-1: `knot tool list_tags` executes and returns JSON output via stdout when daemon is reachable.
- AC-2: `knot tool get_note --json '{"path":"notes/a.md"}'` executes and returns tool result JSON or structured error.
- AC-3: `knot --help` and `knot tool --help` show general form plus curated examples including `list_*`.
- AC-4: `knot tool <command> --help` shows description and argument format for that command.
- AC-5: `knot tool does_not_exist` exits non-zero with explicit unknown-command guidance.
- AC-6: Invalid JSON passed via `--json` or `--stdin-json` exits non-zero with clear parse diagnostics.
- AC-7: Existing launcher command regression tests remain green.

## Verification Strategy
- Unit tests for argument parsing and mode dispatch for `tool` namespace.
- Tests for help rendering (top-level, `tool --help`, `tool <command> --help`).
- Tests for argument decoding and error handling for invalid/missing payloads.
- Integration-style tests for tool call transport mapping to MCP `tools/call` envelopes.
- Regression tests confirming existing launcher commands are unaffected.
