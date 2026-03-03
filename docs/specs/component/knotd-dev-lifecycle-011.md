# Knotd Dev Lifecycle Scripts and Bridge Recovery

## Metadata
- ID: `COMP-KNOTD-DEV-LIFECYCLE-011`
- Scope: `component`
- Status: `draft`
- Parent: `COMP-KNOTD-IPC-009`, `COMP-KNOTD-OPS-008`, `COMP-KNOTD-UI-010`
- Concerns: `[REL, CONF, CAP]`
- Trace: `DESIGN-knotd-dev-lifecycle`
- Created: `2026-02-27`
- Updated: `2026-03-03`

## Purpose
Provide repeatable local development lifecycle scripts for `knotd` and the Tauri UI, and make the MCP bridge resilient to daemon restarts during frequent stop/start cycles.

## Functional Requirements
- FR-1: Repository MUST provide a `dev-up` operator script that starts `knotd` in Unix-socket mode and starts the Tauri UI in daemon IPC mode using a shared repo-local runtime state directory.
- FR-2: Repository MUST provide a `dev-down` operator script that aggressively stops the repo-managed `knotd` and Tauri UI processes, removes stale runtime state, and leaves the Unix socket path reusable for the next cycle.
- FR-3: `dev-up` MUST tolerate stale runtime files from earlier crashes or interrupted sessions and re-establish a usable daemon socket without requiring manual cleanup.
- FR-4: `dev-up` MUST signal a running MCP bridge with `SIGHUP` after daemon startup so the bridge can reconnect to the refreshed `knotd` socket.
- FR-5: `dev-up` and `dev-down` MUST emit actionable status output describing started/stopped PIDs, socket path, vault path, and log file locations.
- FR-6: MCP bridge MUST retry socket reconnect with bounded backoff after disconnect or startup failure instead of exiting immediately.
- FR-7: After a configurable number of consecutive reconnect failures, MCP bridge MUST enter an idle wait state and reconnect only when explicitly signaled with `SIGHUP` or when stdin ends.
- FR-8: MCP bridge reconnect behavior MUST preserve framed stdio input/output handling and continue forwarding requests once the daemon is available again.
- FR-9: Test coverage MUST cover bridge reconnect scheduling, idle-after-failures behavior, and `SIGHUP`-driven reconnect wakeup.
- FR-10: `scripts/run-ci-local.sh` MUST use the same repo-local daemon runtime defaults as `scripts/dev-up.sh` and `scripts/dev-down.sh`, including the effective `KNOTD_SOCKET_PATH`.
- FR-11: When daemon smoke is enabled, `scripts/run-ci-local.sh` MUST self-provision the repo-managed daemon lifecycle before `knotd` triage instead of depending on a pre-existing ambient socket.
- FR-12: Default pre-release local CI flow MUST fail if daemon lifecycle bootstrap fails or if `npm run -s knotd:triage` fails.
- FR-13: `scripts/run-ci-local.sh` MUST preserve an explicit `--skip-daemon-smoke` escape hatch and label that path as non-release verification output.
- FR-14: Repo-managed daemon smoke bootstrap in `scripts/run-ci-local.sh` MUST guarantee teardown of repo-managed daemon/UI processes and stale socket state on both success and failure paths.

## Acceptance Criteria
- AC-1: Running `scripts/dev-up.sh` starts `knotd` and launches the UI with `KNOT_UI_RUNTIME_MODE=daemon_ipc`.
- AC-2: Running `scripts/dev-down.sh` after `dev-up` stops both processes and removes repo-managed runtime files, including stale socket files.
- AC-3: Restarting `knotd` during an active MCP bridge session no longer requires restarting the bridge process manually.
- AC-4: After repeated reconnect failures, the bridge remains alive and reconnects only after `SIGHUP` or fresh process start conditions.
- AC-5: Targeted automated tests cover reconnect backoff and signal-driven recovery behavior.
- AC-6: `npm run -s ci:local -- --skip-install --skip-playwright-install` provisions repo-managed daemon smoke automatically and no longer silently skips `knotd` triage because of a mismatched default socket path.
- AC-7: `npm run -s ci:local -- --skip-install --skip-playwright-install --skip-daemon-smoke` completes while clearly marking daemon smoke as an explicit non-release skip.

## Design Decisions
| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Use repo-local `.run/knotd-dev/` state for PID/log/socket files | Makes repeated dev cycles observable and self-cleaning | Adds local runtime artifact management |
| Make `dev-down` aggressive for repo-managed processes only | Supports fast restart cycles without guessing about unrelated processes | Still assumes the runtime dir is authoritative |
| Keep bridge process alive across disconnects | Avoids restarting tooling after each daemon restart | More bridge state management |
| Enter signal-wait mode after repeated failures | Prevents tight reconnect loops against a missing daemon | Requires explicit `SIGHUP` from operator tooling |
| Make `ci:local` provision daemon smoke itself | Removes ambient-machine-state drift from the release bar | Local CI script takes on lifecycle orchestration responsibility |

## Non-Goals
- Managing unrelated external daemons or MCP clients outside repo-managed runtime files.
- Adding bidirectional daemon-to-client reconnect semantics over the Unix socket.
- Cross-platform service supervision beyond Unix-like local development flows.

## Verification Strategy
- `npm run test -- src/scripts/knotd-mcp-bridge.test.ts`
- `bash scripts/dev-up.sh --check`
- `cargo check --manifest-path src-tauri/Cargo.toml --bin knotd`
- `npm run test -- --run src/tooling/localCiDaemonSmoke.test.ts`
- `npm run -s ci:local -- --skip-install --skip-playwright-install`
