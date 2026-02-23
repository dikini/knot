# Knotd Desktop Runbook (Pre-daemon Phase)

Trace: `DESIGN-knotd-runtime-platform-compatibility`
Spec: `docs/specs/component/knotd-runtime-platform-compatibility-001.md`

## Purpose
Define operating procedures for single-owner vault lifecycle on desktop while runtime abstractions are introduced incrementally.

## Procedure: Open and Attach
1. Start the owner process for the target vault (currently Tauri app or dedicated MCP process, not both on same vault).
2. Confirm vault opens without lock contention.
3. Attach UI and/or MCP to the same ownership path where possible.

## Procedure: Lock Contention
Symptoms:
- startup fails with lock/LockBusy messages.

Actions:
1. Identify competing owner process.
2. Stop or detach the competing owner.
3. Retry open.
4. If contention persists, run full reindex after successful attach.

## Procedure: Manual Full Reindex
1. Trigger `Reindex vault` from settings.
2. Wait for completion feedback and tree refresh event.
3. Validate graph/search for known sample notes.

## Procedure: Recovery
1. If graph/search appears stale, run manual full reindex.
2. If still inconsistent, close vault owner and reopen.
3. Re-run reindex and validate again.

## Procedure: Runtime Lifecycle Markers
For Android-compatible infrastructure, runtime exposes lifecycle markers:
- `foreground`
- `background`
- last checkpoint timestamps

Desktop can use these markers for diagnostics, even when lifecycle transitions are mostly no-op.
