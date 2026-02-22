# Local CI Gate Run Report

Date: `2026-02-22`
Trace: `DESIGN-local-ci-gate-run-2026-02-22`
Scope: local execution parity for `.github/workflows/ui-quality.yml`, `.github/workflows/storybook.yml`, `.github/workflows/native-smoke.yml`

## Summary
- Status: **PASS (non-interactive mode)** with documented environment constraints.
- Command that completed end-to-end in this environment:
  - `BASE_REF=main npm run -s ci:local -- --skip-install --skip-playwright-install --skip-native-launch`

## Attempt Log

1. Full default local CI run
- Command:
  - `npm run -s ci:local`
- Result: **FAILED**
- Failure:
  - Playwright browser dependency install requested `sudo` and failed authentication.

2. Full run with Playwright install skipped
- Command:
  - `npm run -s ci:local -- --skip-playwright-install`
- Result: **FAILED**
- Failure:
  - `qa:docsync` defaulted to `origin/main...HEAD`, but `origin/main` ref was not available in local clone.

3. Full run with explicit local base ref
- Command:
  - `BASE_REF=main npm run -s ci:local -- --skip-install --skip-playwright-install`
- Result: **PARTIAL / INTERACTIVE**
- Behavior:
  - UI quality checks, browser lane, Storybook build, and native preflight succeeded.
  - Native launch smoke started `tauri dev` and app remained running (interactive/manual by nature in this environment), so process was terminated manually.

4. Final deterministic non-interactive run
- Command:
  - `BASE_REF=main npm run -s ci:local -- --skip-install --skip-playwright-install --skip-native-launch`
- Result: **PASS**
- Evidence:
  - `qa:docsync`: passed
  - `qa:storybook-matrix`: passed (`14` files, `68` story exports, `26` UI specs covered)
  - `qa:ci`: passed (`typecheck`, `lint`, `vitest`, browser Playwright suite)
  - `storybook:build`: passed
  - `test:e2e:tauri -- --check`: passed

## Notes
- React `act(...)` warnings appeared in existing test output but did not fail gates.
- Browser lane emitted `NO_COLOR` warnings due to env flag interaction; non-blocking.
- Storybook build emitted chunk-size warnings; non-blocking.

## Recommended Local Gate Commands
- Deterministic local gate:
  - `BASE_REF=main npm run -s ci:local -- --skip-install --skip-playwright-install --skip-native-launch`
- Optional interactive native launch check:
  - `BASE_REF=main npm run -s ci:local -- --skip-install --skip-playwright-install --skip-ui --skip-storybook`
