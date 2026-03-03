# Linux AppImage Packaging Design

- Date: `2026-03-03`
- Status: `approved-for-implementation`
- Related spec: `docs/specs/component/linux-appimage-packaging-018.md`

## Goal
Ship a single Linux AppImage that behaves like an operator-friendly Knot launcher rather than just a raw UI binary.

## Chosen Approach
Use the existing `knot` Rust binary as the porcelain entrypoint before it boots Tauri.

This binary will:
- open the UI by default when run with no subcommand
- route `knotd` requests to the bundled daemon binary
- implement `up` by coordinating daemon readiness and UI launch
- manage `systemd --user` installation through generated XDG-compliant artifacts

This avoids fragile AppImage entrypoint hacks and keeps direct execution and installed flows on the same codepath.

## UX
- `Knot.AppImage`: open the UI
- `Knot.AppImage ui`: open only the UI
- `Knot.AppImage knotd`: run daemon only
- `Knot.AppImage up`: start daemon-backed UI, reusing user service when available
- `Knot.AppImage service install`: install/update user service and `~/.local/bin/knot`
- `Knot.AppImage service status`: report daemon reachability, installed paths, and stale AppImage drift

The launcher must emit short, actionable output. When installation is stale, it should tell the user to rerun `knot service install`.

## Filesystem Model
- Config: `~/.config/knot/knot.toml`
- Generated systemd env: `~/.config/knot/knotd.env`
- User unit: `~/.config/systemd/user/knotd.service`
- Stable command: `~/.local/bin/knot`
- State/logs: `~/.local/state/knot/`
- Runtime socket: `$XDG_RUNTIME_DIR/knot/knotd.sock`, falling back to `~/.local/state/knot/run/knotd.sock`

## Runtime Model
- `knotd` is the only service-managed process.
- The Tauri UI remains interactive and is never run as a user service.
- `up` first probes the configured socket. If a daemon is already available, it launches only the UI in `daemon_ipc` mode.
- Otherwise `up` starts an ad hoc `knotd`, waits for socket readiness, then launches the UI with the same socket path.
- `mcp bridge` must treat JSON-RPC notifications as fire-and-forget frames. In particular, it must forward `initialized` without waiting for a daemon response before processing the next request.

## Packaging Model
- Bundle `knotd` as a Tauri sidecar via `externalBin`.
- Add bundle resources for launcher metadata/templates when needed.
- Add a pre-bundle step to stage the Linux sidecar binary using Tauri’s target-triple naming convention.

## Risks
- AppImage relocation can break installed wrapper paths.
- Sidecar path resolution differs between dev and bundled execution.
- `systemd --user` behavior varies slightly across distros, so generated units need conservative defaults and clear diagnostics.

## Validation
The first successful slice is:
1. unit tests for config and generated install artifacts pass
2. `cargo check` passes for launcher and daemon wiring
3. bundle config includes the staged `knotd` sidecar
4. direct `knot up` and `knot service install --dry-run` flows behave predictably in tests
5. native `knot mcp bridge` completes `initialize` -> `initialized` -> `tools/list` against a reachable daemon socket
