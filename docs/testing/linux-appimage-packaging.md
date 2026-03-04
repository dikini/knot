# Linux AppImage Packaging

This note captures the current Linux desktop packaging flow for the single-file AppImage build.

## Build Host Requirements

Linux AppImage bundling currently requires these host tools/packages:

- `patchelf`
- `pkg-config`
- `librsvg2-dev` or equivalent package that provides `librsvg-2.0.pc`

On Debian/Ubuntu systems:

```bash
sudo apt install patchelf pkg-config librsvg2-dev
```

## Build Command

Use the repo wrapper rather than calling `tauri build` directly:

```bash
npm run tauri-build -- --bundles appimage
```

The wrapper in `scripts/tauri-build.mjs` does three Linux-specific things:

- fails early with a clear message if `patchelf` is missing
- fails early with a clear message if `pkg-config` cannot resolve `librsvg-2.0`
- sets `APPIMAGE_EXTRACT_AND_RUN=1` for AppImage builds to avoid nested helper-AppImage mount failures in `linuxdeploy`

## Output Artifact

Successful builds currently produce:

```text
src-tauri/target/release/bundle/appimage/knot_0.1.0_amd64.AppImage
```

## Launcher Modes

The AppImage launcher supports:

```bash
./knot_0.1.0_amd64.AppImage
./knot_0.1.0_amd64.AppImage ui
./knot_0.1.0_amd64.AppImage knotd
./knot_0.1.0_amd64.AppImage up
./knot_0.1.0_amd64.AppImage down
./knot_0.1.0_amd64.AppImage tool list_tags
./knot_0.1.0_amd64.AppImage tool list
./knot_0.1.0_amd64.AppImage tool get_note --json '{"path":"notes/roadmap.md"}'
./knot_0.1.0_amd64.AppImage tool search_notes --json '{"query":"graph","limit":10}'
./knot_0.1.0_amd64.AppImage tool get_note --help
./knot_0.1.0_amd64.AppImage mcp bridge
./knot_0.1.0_amd64.AppImage mcp status
./knot_0.1.0_amd64.AppImage mcp socket-path
./knot_0.1.0_amd64.AppImage mcp codex install
./knot_0.1.0_amd64.AppImage mcp codex uninstall
./knot_0.1.0_amd64.AppImage service install
./knot_0.1.0_amd64.AppImage service uninstall
./knot_0.1.0_amd64.AppImage service start
./knot_0.1.0_amd64.AppImage service stop
./knot_0.1.0_amd64.AppImage service restart
./knot_0.1.0_amd64.AppImage service status
```

Linux desktop defaults to daemon-backed UI mode. `ui` and the default entrypoint both ensure `knotd` is reachable before opening the Tauri application.

`tool` is a shell-oriented command surface for MCP tools:
- Use `knot tool --help` for curated command examples (`list_*` and common read commands).
- Use `knot tool list` to print the full available MCP tool inventory.
- Use `knot tool <command> --help` for per-command format details.
- Use `--json '<payload>'` or `--stdin-json` to pass arguments for tools that require input.

## Notes

- The generated user-service flow writes into XDG paths under `~/.config/knot`, `~/.local/state/knot`, and `~/.config/systemd/user/`.
- `service install` requires a configured vault path via `~/.config/knot/knot.toml` or `KNOT_VAULT_PATH`.
- `mcp codex install` writes or replaces the managed `knot_vault` block in `~/.codex/config.toml`, preferring `~/.local/bin/knot` when present and otherwise using the current AppImage path.
- The build may still depend on additional GTK/runtime libraries from the local distro environment because AppImage assembly is delegated to `linuxdeploy`.
