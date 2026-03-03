# Verification: Pre-Release Cleanup 023

## Metadata
- Trace: `DESIGN-pre-release-cleanup-023`
- Spec: `docs/specs/component/pre-release-cleanup-023.md`
- Plan: `docs/plans/pre-release-cleanup-023-plan.md`
- Date: `2026-03-03`
- Status: `passed`

## Scope
- Storybook coverage-matrix parser hardening
- App lint and `act(...)` warning cleanup
- Editor/KaTeX/story warning-noise cleanup
- Browser E2E mock bridge stabilization
- Rust `clippy -D warnings` closure for the touched pre-release lane

## Implemented Changes
- Hardened `scripts/validate-storybook-coverage-matrix.mjs` and added `src/tooling/storybookMatrix.test.ts`.
- Stabilized `src/App.tsx` hook dependencies and quieted `src/App.test.tsx` mount/update warning noise.
- Eliminated avoidable editor/test noise via `src/test/setup.ts`, `src/components/Editor/index.tsx`, `src/components/Editor/index.test.tsx`, and `src/components/Editor/Editor.stories.tsx`.
- Updated `e2e/browser/mock-tauri-bridge.ts` to cover current app-config and UI automation commands.
- Added `scripts/run-playwright-browser.mjs` so browser E2E runs do not emit the `NO_COLOR`/`FORCE_COLOR` Node warning.
- Cleared touched Rust lint debt in `src-tauri/src/app_config.rs`, `src-tauri/src/knotd_client.rs`, `src-tauri/src/youtube.rs`, `src-tauri/src/commands/notes.rs`, and `src-tauri/src/mcp.rs`.

## Verification
- `npm run typecheck`
- `npm run lint`
- `npm run test -- --run`
- `npm run -s storybook:test:vitest`
- `cargo check --manifest-path src-tauri/Cargo.toml`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`
- `cargo test --manifest-path src-tauri/Cargo.toml --lib --quiet`
- `npm run -s qa:project-registry`
- `npm run -s qa:storybook-matrix`
- `npm run -s test:e2e:browser -- --project=chromium e2e/browser/markdown-mermaid.spec.ts e2e/browser/ui-journeys.spec.ts`
- `npm run -s ci:local -- --skip-install --skip-playwright-install`

## Results
- All listed commands passed.
- `ci:local` completed through Storybook build, browser E2E, native smoke preflight, native launch smoke, and daemon-mode smoke.
- The daemon socket triage step was intentionally skipped because `/tmp/knotd.sock` was absent and `--require-daemon-smoke` was not set.

## Residual Notes
- During one parallel verification pass, Storybook Vitest selected an alternate ephemeral port because another local run was already active. That was caused by overlapping local commands during this cleanup session, not by repo instability.
