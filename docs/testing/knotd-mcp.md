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
2. Determine startup probe mode (`startupProbe`: `auto`/`always`/`never`).
3. In `auto`, run probe for direct binary launches; skip probe for `cargo run` fallback to avoid cold-start timeout.
4. Start `knotd --vault <path>` serve mode.

Probe mode overrides:
- Config key: `startupProbe` in `.mcp/knotd-mcp.json`
- Env override: `KNOTD_MCP_STARTUP_PROBE` (`always`, `never`, or `auto`)

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

### Local IPC Daemon Mode (Unix)
Run `knotd` as a socket daemon (for decoupled runtime ownership):
```bash
/home/dikini/Projects/knot/src-tauri/target/debug/knotd \
  --listen-unix /tmp/knotd.sock \
  --vault /home/dikini/Projects/knot/test-vault/canonical
```

This mode keeps MCP runtime alive independent of parent stdio process lifetimes.

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
