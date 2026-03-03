# Linux AppImage Packaging and Porcelain Launcher

## Metadata
- ID: `COMP-LINUX-PACKAGING-018`
- Scope: `component`
- Status: `draft`
- Parent: `COMP-KNOTD-DEV-LIFECYCLE-011`, `COMP-KNOTD-UI-010`
- Concerns: `[REL, CONF, COMP]`
- Trace: `DESIGN-linux-appimage-packaging`
- Created: `2026-03-03`
- Updated: `2026-03-03`

## Purpose
Package the Linux desktop UI, `knotd`, and operator tooling into a single AppImage with a porcelain launcher that supports daemon-only, UI-only, combined launch, daemon shutdown, and `systemd --user` service management with XDG-compliant configuration and state paths.

## Contract

### Functional Requirements
- FR-1: Linux distribution MUST support a single AppImage artifact that contains the desktop UI, `knotd`, and a launcher entrypoint.
- FR-2: The launcher MUST provide porcelain subcommands for `ui`, `knotd`, `up`, `down`, and `service <install|uninstall|start|stop|restart|status>`.
- FR-3: Launcher default behavior with no subcommand MUST prioritize the most ergonomic interactive UX and open the UI.
- FR-4: `ui` mode MUST launch only the desktop UI and honor configured runtime mode defaults.
- FR-5: `knotd` mode MUST launch only the daemon and support explicit foreground/service execution flows.
- FR-6: `up` mode MUST start both surfaces in one command, reusing an already-running user service when reachable instead of spawning a second daemon.
- FR-7: `service install` MUST create or update a `systemd --user` unit in `~/.config/systemd/user/` plus a stable launcher entrypoint in `~/.local/bin/knot`.
- FR-8: Generated service wiring MUST never depend on transient mounted AppImage paths; it MUST execute through a stable wrapper or launcher path.
- FR-8a: `mcp codex install` MUST prefer the stable `~/.local/bin/knot` wrapper for `~/.codex/config.toml` whenever that wrapper exists, even when the installer itself is launched from an AppImage path.
- FR-9: Launcher configuration MUST follow XDG directories: config in `~/.config/knot/`, persistent state/logs in `~/.local/state/knot/`, and runtime socket paths in `$XDG_RUNTIME_DIR/knot/` when available.
- FR-10: Launcher MUST generate and consume a stable config file for operator defaults, including AppImage path, vault path, socket path, runtime mode, and log path.
- FR-11: `service uninstall` MUST remove generated service artifacts while preserving user configuration by default; `--purge` MAY remove generated config/state.
- FR-12: Service/status UX MUST detect stale AppImage references and emit actionable remediation instructions.
- FR-13: AppImage packaging MUST bundle `knotd` and launcher assets so installed and direct-execution paths use the same codepaths.
- FR-14: Verification MUST cover config resolution, generated unit/wrapper content, `up` reuse behavior, and bundling metadata.

### Design Decisions
| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Use one porcelain launcher as the operator entrypoint | Keeps all launch modes discoverable and consistent | Adds one more surface to maintain |
| Manage only `knotd` as a user service | UI remains an interactive desktop process | Requires `up` logic to coordinate with service state |
| Generate stable wrapper in `~/.local/bin/knot` | Avoids AppImage mount-path instability for `systemd --user` | Wrapper must be refreshed when AppImage moves |
| Follow XDG strictly | Predictable integration with Linux desktop tooling | Slightly more path logic than a single config dir |

### Acceptance Criteria
- AC-1: Running `Knot.AppImage` launches the UI without requiring extra arguments.
- AC-2: Running `Knot.AppImage knotd` starts daemon-only mode from the bundled payload.
- AC-3: Running `Knot.AppImage up` starts a daemon-backed UI session or reuses a reachable user service.
- AC-3a: Running `Knot.AppImage down` stops a managed `knotd` user service when installed and otherwise emits a clear explanation for ad hoc daemon sessions.
- AC-4: Running `Knot.AppImage service install` writes a valid user unit and stable `~/.local/bin/knot` launcher.
- AC-4a: Running `Knot.AppImage mcp codex install` after `service install` writes `command = "~/.local/bin/knot"` into the managed `knot_vault` block instead of the direct AppImage path.
- AC-5: `systemctl --user start knotd` starts the bundled daemon through stable installed wiring.
- AC-6: Generated config/state/service paths follow XDG locations.
- AC-7: Moving the AppImage after installation yields a clear, actionable status/start error rather than silent failure.
- AC-8: Bundling configuration includes the daemon and launcher assets required by the AppImage runtime.

## Verification Strategy
- Unit tests for launcher config resolution and generated artifact content.
- Targeted tests for `up` daemon reuse decisions and stale AppImage detection.
- Bundle metadata verification for included launcher and `knotd` payloads.
- Targeted runtime smoke for direct AppImage and service-managed daemon flows where feasible.

## Follow-up Todo
- Launcher/service startup should be able to create and initialize the configured vault path when it does not exist yet, or fail with a more explicit remediation path when the target exists but is not a valid Knot vault.
- Packaging/operator docs should include a checked-in sample `knot.toml` that matches the currently supported config keys and Linux daemon-backed defaults.
- Desktop packaging work should include a review of native/system dialogs and platform chrome so AppImage, future Flatpak, and future Snap builds preserve a consistent Knot-themed experience wherever app-owned UI is expected.
