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

### Stdio Transport Tap (Codex ⇄ bridge)
Use a tap shim to prove end-to-end stdio piping and inspect framed MCP traffic.

1. In `~/.codex/config.toml`, point `knot_vault` to the tap script:
```toml
[mcp_servers.knot_vault]
command = "/home/dikini/.nvm/versions/node/v24.0.1/bin/node"
args = ["/home/dikini/Projects/knot/scripts/mcp-stdio-tap.mjs"]
startup_timeout_sec = 60
```

2. Optional tap env tuning (set in shell before starting Codex):
```bash
export KNOTD_MCP_TAP_LOG=/tmp/knot-mcp-stdio-tap.log
export KNOTD_MCP_TAP_PREVIEW_BYTES=1024
export KNOTD_MCP_TAP_PARSE_FRAMES=1
```

3. Read the log:
```bash
tail -f /tmp/knot-mcp-stdio-tap.log
```

Log includes:
- process lifecycle (`tap_start`, `child_spawn`, `child_exit`)
- byte-level chunk flow (`codex.stdin->bridge.stdin`, `bridge.stdout->codex.stdout`, `bridge.stderr->codex.stderr`)
- MCP frame parsing with method/id/content-length for both request and response paths

### Local IPC Daemon Mode (Unix)
Run `knotd` as a socket daemon (for decoupled runtime ownership):
```bash
/home/dikini/Projects/knot/src-tauri/target/debug/knotd \
  --listen-unix /tmp/knotd.sock \
  --vault /home/dikini/Projects/knot/test-vault/canonical
```

This mode keeps MCP runtime alive independent of parent stdio process lifetimes.

Codex then uses a stdio bridge:
- Script: `scripts/knotd-mcp-bridge.mjs`
- Codex config entry: `mcp_servers.knot_vault` points to node + bridge script
- Bridge target socket: `.mcp/knotd-mcp.json` `socketPath` or default `/tmp/knotd.sock`

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
