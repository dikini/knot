# Verification: Knotd Dev Lifecycle Scripts and Bridge Recovery

## Metadata
- Spec: `docs/specs/component/knotd-dev-lifecycle-011.md`
- Plan: `docs/plans/knotd-dev-lifecycle-011-plan.md`
- Date: `2026-03-03`
- Trace: `DESIGN-knotd-dev-lifecycle`
- Status: `passed`

## Scope
- `ci:local` daemon smoke defaults and lifecycle alignment
- repo-managed daemon bootstrap/teardown orchestration for local pre-release verification
- regression coverage for socket-path resolution, required triage flow, and teardown on failure

## Commands Run
- `npm run test -- --run src/tooling/localCiDaemonSmoke.test.ts`
- `npm run -s qa:project-registry`
- `npm run -s ci:local -- --skip-install --skip-playwright-install`
- `test ! -S .run/knotd-dev/knotd.sock`
- `pgrep -af '/home/dikini/Projects/knot/.run/knotd-dev/knotd.sock|KNOT_UI_RUNTIME_MODE=daemon_ipc|src-tauri/target/debug/knotd --listen-unix /home/dikini/Projects/knot/.run/knotd-dev/knotd.sock' || true`

## Results
- Targeted daemon smoke orchestration tests: PASS (`4/4`)
- Project registry validation: PASS
- Full `ci:local` run: PASS
- Repo-managed daemon smoke now bootstraps from `.run/knotd-dev/knotd.sock`, runs `knotd:triage`, and tears down successfully in the default path
- Post-run socket cleanup check: PASS (`.run/knotd-dev/knotd.sock` absent)
- Post-run process cleanup check: PASS (no repo-managed daemon/UI process remained; `pgrep` only matched the verification command itself)

## Requirement Coverage
| Requirement | Evidence | Status |
| --- | --- | --- |
| FR-10 `run-ci-local.sh` shares repo-local daemon defaults with `dev-up`/`dev-down` | `scripts/run-knotd-daemon-smoke.mjs`, `scripts/run-ci-local.sh` | ✅ Verified |
| FR-11 `ci:local` self-provisions daemon smoke before triage | `scripts/run-knotd-daemon-smoke.mjs`, `ci:local` output | ✅ Verified |
| FR-12 default local pre-release flow fails when bootstrap/triage fails | `src/tooling/localCiDaemonSmoke.test.ts` failure-path assertion, helper error propagation | ✅ Verified |
| FR-13 explicit `--skip-daemon-smoke` remains available and non-release | `scripts/run-ci-local.sh` skip messaging | ✅ Implemented |
| FR-14 daemon smoke teardown runs on success and failure paths | `src/tooling/localCiDaemonSmoke.test.ts`, `ci:local` output, socket/process cleanup checks | ✅ Verified |

## Acceptance Criteria
| Acceptance Criterion | Status | Notes |
| --- | --- | --- |
| AC-6 default `ci:local` provisions daemon smoke and does not silently skip triage due to socket drift | ✅ | Full run used repo-local `.run/knotd-dev/knotd.sock` and executed triage |
| AC-7 `--skip-daemon-smoke` remains an explicit non-release path | ✅ | Script prints explicit non-release skip messaging |

## Residual Notes
- `--require-daemon-smoke` is retained as a compatibility flag but is now a no-op because daemon smoke is required by default.
- `scripts/dev-up.sh` still recompiles `knotd` during daemon smoke bootstrap unless `KNOT_DEV_SKIP_BUILD=1` is set; this preserves correctness but keeps the local CI daemon stage heavier than a prebuilt binary path.
