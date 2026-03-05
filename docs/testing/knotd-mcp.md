# Knotd MCP Operations

Trace: `DESIGN-knotd-mcp-ops`
Spec: `docs/specs/component/knotd-mcp-ops-008.md`
Related trace: `BUG-knotd-mcp-startup-handshake-timeout`

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

## Deprecation Note

The repository Node bridge setup path is deprecated for installed Linux desktop usage.

Preferred operator flow:

```bash
knot mcp codex install
```

The legacy `npm run codex:mcp:setup:knotd` script now delegates to the native Knot launcher path rather than installing the old repo-local Node bridge block.

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

## Startup Handshake Trace
Use timestamped traces to identify the exact stage where startup hangs/fails.

Direct socket path:
```bash
npm run -s knotd:mcp:startup-trace
```

Bridge/stdin-stdout path (Codex-like):
```bash
npm run -s knotd:mcp:startup-trace:bridge
```

Both commands report:
- `transport_connected`
- `initialize:send/ok`
- `tools/list:send/ok`
- `tools/call:first:send/ok`

If a run fails, use the final timeline step as the failure stage.

## One-Command Triage
Run all diagnostics in sequence:
```bash
npm run -s knotd:triage
```

Matrix includes:
- daemon open/new/close smoke
- startup trace over socket
- startup trace over bridge

Socket override:
```bash
KNOTD_SOCKET_PATH=/tmp/knotd.sock KNOTD_MCP_SOCKET_PATH=/tmp/knotd.sock npm run -s knotd:triage
```

## CI Coverage
GitHub workflow for daemon diagnostics:
- `.github/workflows/knotd-daemon-diagnostics.yml`

This workflow runs:
- `ui:daemon:smoke`
- `knotd:triage` against a background daemon socket

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

### Aggressive Local Dev Cycle
Use the repo-managed lifecycle helpers when repeatedly restarting daemon + UI during development:

```bash
npm run dev:daemon:up
```

This creates repo-local runtime state in `.run/knotd-dev/`, starts `knotd`, starts the Tauri UI in daemon mode, and sends `SIGHUP` to any running `scripts/knotd-mcp-bridge.mjs` process so it reconnects to the refreshed socket.

Stop the repo-managed daemon + UI pair:

```bash
npm run dev:daemon:down
```

Restart cycle:

```bash
npm run dev:daemon:restart
```

Runtime defaults:
- socket: `.run/knotd-dev/knotd.sock`
- vault: `test-vault/canonical`
- logs: `.run/knotd-dev/knotd.log`, `.run/knotd-dev/ui.log`

Override vault or runtime dir:

```bash
KNOT_DEV_VAULT_PATH=/absolute/path/to/vault npm run dev:daemon:up
KNOT_DEV_RUN_DIR=/tmp/knot-dev-run npm run dev:daemon:up
```

Bridge recovery behavior:
- The bridge no longer exits immediately when `knotd` disconnects.
- It retries with bounded backoff.
- After repeated failures it waits for `SIGHUP` instead of spinning.
- `dev:daemon:up` sends that signal automatically when the bridge is already running.

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
