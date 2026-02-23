# Tauri Native Smoke Checklist

Trace: `DESIGN-ui-automation-dx-001`
Related trace: `DESIGN-daemon-ui-ipc-cutover`

## Purpose
Provide a minimal native-runtime smoke flow for Tauri integration confidence without duplicating full browser-lane UI coverage.

## Preflight
```bash
npm run test:e2e:tauri
```

## Automated Launch Smoke (Optional)
Run a bounded native launch check:
```bash
npm run test:e2e:tauri -- --launch-smoke --timeout=300
```

## Automated Daemon-IPC Launch Smoke (Optional)
Run a bounded native launch where UI is forced to `knotd` IPC mode:
```bash
npm run test:e2e:tauri:daemon -- --launch-smoke --timeout=300
```

Headless Linux example:
```bash
TAURI_DAEMON_SMOKE_CMD="xvfb-run -a npm run tauri dev -- --no-watch" npm run -s test:e2e:tauri:daemon -- --launch-smoke --timeout=420
```

CI cadence workflow:
- `.github/workflows/native-smoke.yml`

## Manual Smoke Steps
1. Start native runtime:
```bash
npm run tauri dev
```
2. Verify startup shell appears (welcome screen when no vault is open).
3. Open or create a vault and ensure the editor surface loads.
4. Toggle graph/editor mode once and confirm no runtime crash.
5. Save a note and confirm no IPC/runtime errors in console logs.

## Exit Criteria
- App starts in native runtime.
- Basic open/create/save and mode-toggle behavior is functional.
- No fatal runtime errors in the terminal session.
