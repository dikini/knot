# UI Automation DX (Playwright + Tauri)

Trace: `DESIGN-ui-automation-dx-001`
Spec: `docs/specs/component/ui-automation-dx-001.md`

## Approach 1 (Implemented): Browser-First Playwright Lane
- Goal: fast design/behavior verification with deterministic results.
- Runtime: Vite app in Chromium via Playwright.
- Tauri dependency handling: uses an init-script mock of `window.__TAURI_INTERNALS__`.
- Command:
```bash
npm run test:e2e:browser
```
- Current browser journey coverage:
  - app shell startup and recent vaults
  - Mermaid insertion/rendering + source fence fidelity
  - note edit/save/switch/reload persistence
  - editor <-> graph mode switching
  - unsaved-changes switch prompt with confirmed save

## Approach 2 (Implemented): Tauri-Native Smoke Lane
- Goal: narrow shell/runtime confidence checks.
- Runtime: native Tauri development runtime plus checklist.
- Command:
```bash
npm run test:e2e:tauri
```
- Optional bounded launch smoke:
```bash
npm run test:e2e:tauri -- --launch-smoke --timeout=300
```
- Follow-up checklist:
  - `docs/testing/tauri-native-smoke.md`

## CI Gate
- PR/UI gate workflow:
  - `.github/workflows/ui-quality.yml`
- Native cadence workflow:
  - `.github/workflows/native-smoke.yml`
- Artifact review guide:
  - `docs/testing/ui-review-artifacts.md`

## Approach 3 (Future R&D, Deferred)
- Goal: protocol-level attach/automation against embedded WebKitGTK runtime.
- Current status: explicitly deferred to an unidentified future stage.
- Scope note: this is not required for current CI/local delivery and has no implementation commitments in this cycle.
