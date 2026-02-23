# Knotd MCP Operations

Trace: `DESIGN-knotd-mcp-ops`
Spec: `docs/specs/component/knotd-mcp-ops-008.md`

## Purpose
Document deterministic startup and recovery for `knot_vault` MCP using `knotd`.

## Config Paths
- Template: `.mcp/knotd-mcp.example.json`
- Local (ignored/user-managed): `.mcp/knotd-mcp.json`

## Launcher
- Script: `scripts/knotd-mcp-codex.mjs`
- Flow:
1. Resolve vault path from env/config.
2. Run `knotd --probe-json` preflight.
3. If probe `ok=true`, start `knotd --vault <path>` serve mode.

## Setup
1. Register MCP in Codex config:
```bash
npm run codex:mcp:setup:knotd
```
2. Optional combined setup (storybook + knotd):
```bash
npm run codex:mcp:setup:all
```

## Smoke Verification
```bash
npm run knotd:mcp:smoke
```

Smoke checks:
- `--print-capabilities`
- `--probe-json --create`
- `--check`
- `--status`
- `--help`
- `--version`

## Operator Workflows

### Success Path
1. Run launcher via Codex MCP registration.
2. Verify probe success and normal MCP startup.

### Lock Contention Path
1. Probe fails with `lock_status=contended`.
2. Stop competing owner process or attach to the active owner workflow.
3. Retry launcher.

### Recovery Path
1. Start MCP successfully.
2. If graph/search drift is suspected, run full reindex from settings.
3. Re-run `--status`/`--probe-json` checks for sanity.
