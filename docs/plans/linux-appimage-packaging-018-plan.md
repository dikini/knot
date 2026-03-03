# Linux AppImage Packaging Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a single-AppImage Linux launcher UX that supports UI-only, daemon-only, combined launch, daemon shutdown, and `systemd --user` service management with XDG-compliant configuration.

**Architecture:** Extend the existing `knot` Rust binary into a pre-Tauri porcelain launcher, bundle `knotd` as a Linux sidecar, and generate stable user-level wrapper/unit artifacts under XDG paths. Keep the UI binary as the default no-arg behavior while making `up`, `down`, and `service ...` first-class operator commands.

**Tech Stack:** Rust, Tauri 2 bundle config, systemd user units, XDG path resolution, targeted Rust tests.

---

## Metadata
- Spec: `docs/specs/component/linux-appimage-packaging-018.md`
- Design: `docs/plans/2026-03-03-linux-appimage-packaging-design.md`
- Generated: `2026-03-03`
- Approach: `sequential`

## Task Breakdown

| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| LAP-001 | Add failing Rust tests for launcher CLI parsing, XDG path resolution, generated wrapper/env/unit content, and stale AppImage diagnostics | M | - | FR-2, FR-7, FR-8, FR-9, FR-10, FR-11, FR-12 |
| LAP-002 | Implement launcher/config module for porcelain commands, XDG defaults, config loading, and artifact rendering | L | LAP-001 | FR-2 through FR-12 |
| LAP-003 | Refactor `src-tauri/src/main.rs` to route launcher subcommands before booting Tauri and preserve UI-default behavior | M | LAP-002 | FR-3, FR-4, FR-5, FR-6 |
| LAP-004 | Add runtime helpers for bundled `knotd` resolution, daemon readiness probing, and `up` reuse behavior | M | LAP-002 | FR-5, FR-6, FR-13 |
| LAP-005 | Wire AppImage bundling metadata and pre-bundle staging for the Linux `knotd` sidecar | M | LAP-004 | FR-1, FR-13 |
| LAP-006 | Add targeted verification/docs updates for launcher UX and packaging behavior | S | LAP-005 | FR-14 |
| LAP-007 | Add Codex MCP install regression coverage so wrapper selection wins over transient `APPIMAGE` paths when the stable launcher is installed | S | LAP-006 | FR-8a |

## Verification Commands
- `cargo test --manifest-path src-tauri/Cargo.toml launcher::tests -- --nocapture`
- `cargo check --manifest-path src-tauri/Cargo.toml`
- `npm run tauri-build -- --bundles appimage`

## Notes
- Prefer dry-run capable install/status helpers so unit tests can validate artifact content without mutating the developer machine.
- Keep `service uninstall` non-destructive by default; purge semantics can remain explicit and narrow.
- UX copy is part of the feature: errors should say what path failed and the next corrective command.
- Follow-up backlog:
  - add launcher behavior to create/initialize a missing configured vault, or clearly distinguish "missing path" from "existing but not a Knot vault"
  - add a checked-in sample `knot.toml` that documents the supported keys and daemon-backed Linux defaults
  - review app-owned dialogs and platform chrome for consistent theme behavior across AppImage and future Flatpak/Snap packaging targets
