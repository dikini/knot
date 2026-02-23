# Knotd Local IPC Socket Serve Mode

## Metadata
- ID: `COMP-KNOTD-IPC-009`
- Scope: `component`
- Status: `draft`
- Parent: `COMP-KNOTD-DAEMON-002`, `COMP-KNOTD-STATUS-003`
- Concerns: `[REL, CONF]`
- Trace: `DESIGN-knotd-local-ipc`
- Created: `2026-02-23`
- Updated: `2026-02-23`

## Purpose
Add a local IPC serving mode so `knotd` can run as a long-lived process over Unix domain sockets, decoupling runtime ownership from child stdio startup.

## Functional Requirements
- FR-1: `knotd` MUST accept `--listen-unix <socket-path>` and run MCP server over Unix socket transport.
- FR-2: `knotd` MUST preserve existing stdio serve mode when `--listen-unix` is not specified.
- FR-3: `knotd` MUST reject `--listen-unix` when value is missing.
- FR-4: On Unix, `knotd` MUST create socket with owner-only permissions (`0600`) and remove stale socket file before bind.
- FR-5: On non-Unix targets, `knotd` MUST fail fast with actionable error if `--listen-unix` is requested.
- FR-6: CLI parsing tests MUST cover socket mode selection and missing value failures.

## Acceptance Criteria
- AC-1: `cargo test --manifest-path src-tauri/Cargo.toml --bin knotd -- --nocapture` passes with new parser tests.
- AC-2: `cargo check --manifest-path src-tauri/Cargo.toml --bin knotd` passes on Linux.
- AC-3: `knotd --help` output includes `--listen-unix` usage.

## Non-Goals
- Windows named pipe listener in this slice.
- HTTP transport in this slice.
- Multi-client concurrency policy changes beyond sequential accept loop.

## Verification Strategy
- `cargo test --manifest-path src-tauri/Cargo.toml --bin knotd -- --nocapture`
- `cargo check --manifest-path src-tauri/Cargo.toml --bin knotd`
