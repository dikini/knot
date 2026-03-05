# Knot

## Overview

Knot is a local-first note app built with Tauri.

The main focus is writing in markdown without a lot of UI noise. The editor hides markdown syntax on inactive lines, and the project also includes a local MCP server and daemon tooling for AI workflows around a vault.

If you want to run it from source:

```bash
npm install
npm run tauri-dev
```

If you want local release artifacts (tarball + self-extracting installer + deb + deb-src):

```bash
npm run release:local -- --version 0.1.0
```

## Architecture

Knot is split into a web frontend and a Rust backend.

- Frontend: React, TypeScript, and ProseMirror in [`src/`](/home/dikini/Projects/knot/src)
- Backend: Tauri and Rust in [`src-tauri/`](/home/dikini/Projects/knot/src-tauri)
- Shared app shape: desktop-first, with Android support planned through Tauri's mobile stack

The Linux desktop build has a launcher layer and daemon-based flows, so the UI, `knotd`, and MCP commands can be run from the same artifact.

## Features

- Distraction-first markdown editing with hidden syntax on inactive lines
- Local note storage and search
- Embedded media support, including image and PDF handling in the app
- Local MCP access to vault data and operations
- Linux launcher commands for UI, daemon, MCP, and service management

Example MCP usage from the launcher:

```bash
knot mcp bridge
knot mcp codex install
```

## Stack

- Tauri 2
- Rust
- React
- TypeScript
- ProseMirror
- SQLite via `rusqlite`
- Tantivy
- Tokio

## License

This project is available under either MIT or Apache-2.0.

See [LICENSING.md](/home/dikini/Projects/knot/LICENSING.md), [LICENSE-MIT](/home/dikini/Projects/knot/LICENSE-MIT), and [LICENSE-APACHE](/home/dikini/Projects/knot/LICENSE-APACHE).
