# Knot

AI-native knowledge base with distraction-free editing.

## Overview

Knot is a privacy-focused, cross-platform note-taking application built with Tauri 2.0. It features semantic markdown editing where syntax is hidden on inactive lines, creating a distraction-free writing experience.

## Architecture

- **Frontend:** React + TypeScript + ProseMirror
- **Backend:** Rust (reuses core logic from botpane/libvault)
- **Platforms:** Linux, macOS, Windows, Android

## Project Structure

```
knot/
├── src/                    # Web frontend (React + ProseMirror)
│   ├── components/         # React components
│   ├── editor/            # ProseMirror editor configuration
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utilities and store
│   ├── styles/            # CSS files
│   └── types/             # TypeScript type definitions
├── src-tauri/             # Rust backend
│   ├── src/               # Rust source (copied from botpane/libvault)
│   ├── capabilities/      # Tauri permissions
│   ├── icons/             # App icons
│   ├── Cargo.toml         # Rust dependencies
│   └── tauri.conf.json    # Tauri configuration
└── docs/                  # Documentation
    └── REFACTORING_LIBVAULT.md  # Migration guide
```

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [Rust](https://rustup.rs/) (latest stable)
- [Tauri CLI](https://tauri.app/v2/guides/prerequisites/)

### Setup

```bash
# Install dependencies
npm install

# Run development server (desktop)
npm run tauri-dev

# Run development server (Android)
npm run tauri android dev
```

### Building

```bash
# Build for production
cd src-tauri
cargo tauri build

# Build for Android
cargo tauri android build
```

## Key Features

### Distraction-Free Editing

Knot's editor hides markdown syntax when your cursor is not on that line:

- `# Heading` appears as **Heading** (no # visible)
- `**bold**` appears as **bold** (no ** visible)
- Only the active line shows raw markdown

### Media Embedding

Native support for images and videos embedded in notes.

### AI-Native

Built-in MCP (Model Context Protocol) server for AI agent integration.

### Cross-Platform

Single codebase runs on desktop (Linux, macOS, Windows) and Android.

### Privacy-First

- Local-first storage
- P2P sync (no cloud dependency)
- End-to-end encryption for sync

## Migration from BotPane

The Rust core (`src-tauri/src/`) was copied from `botpane/libvault` and needs refactoring:

1. **FFI → Tauri Commands:** Replace FFI bindings with `#[tauri::command]` functions
2. **Global State → Managed State:** Use Tauri's state management
3. **Async:** Add async where appropriate

See [docs/REFACTORING_LIBVAULT.md](docs/REFACTORING_LIBVAULT.md) for detailed migration plan.

## Tech Stack

### Frontend
- React 18
- TypeScript (strict mode)
- ProseMirror (rich text editing)
- Zustand (state management)
- Vite (build tool)

### Backend
- Tauri 2.0
- Tokio (async runtime)
- Rusqlite (SQLite)
- Tantivy (search)

## License

MIT OR Apache-2.0
