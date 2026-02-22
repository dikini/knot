# Storybook MCP Configuration

Trace: `DESIGN-storybook-dx-001`
Spec: `docs/specs/component/storybook-dx-001.md`

## Purpose
Define the project-local configuration pattern for Storybook MCP integration.

## Configuration Path
- Template: `.mcp/storybook-mcp.example.json`
- Local (ignored/user-managed): `.mcp/storybook-mcp.json`

## Quick Start
1. Copy template:
```bash
mkdir -p .mcp
cp .mcp/storybook-mcp.example.json .mcp/storybook-mcp.json
```
2. Ensure Storybook is running:
```bash
npm run storybook
```
3. Run config smoke check:
```bash
npm run storybook:mcp:smoke
```
4. Register project-persistent Codex MCP launcher (one-time per machine):
```bash
npm run codex:mcp:setup
```

## Codex Persistence Model
- Codex MCP server registrations live in user config (`~/.codex/config.toml`).
- This project provides `scripts/setup-codex-storybook-mcp.mjs` to inject an idempotent managed block for `storybook_knot`.
- The managed entry runs `scripts/storybook-mcp-codex.mjs`, which reads `.mcp/storybook-mcp.json` (or the example template fallback) and proxies to Storybook MCP via `mcp-remote`.
- Result: no per-session MCP editing when starting Codex in this repository.

## Endpoint Notes
- Storybook MCP endpoint defaults to `http://127.0.0.1:6006/mcp`.
- The project launcher resolves endpoint in this order:
1. `.mcp/storybook-mcp.json` field `url`.
2. `.mcp/storybook-mcp.json` fields `baseUrl` + `mcpPath` (default `/mcp`).
3. `.mcp/storybook-mcp.example.json` same fields.
4. Hard default `http://127.0.0.1:6006/mcp`.

## Ownership
- Tooling owner updates template and smoke script.
- Agent workflows consume local `.mcp/storybook-mcp.json`.
- Any connector-specific secrets or environment details remain local.

## Agent Use Cases
- Discover story inventory for changed components.
- Correlate UI changes with Storybook docs coverage.
- Link review evidence to specific stories.
