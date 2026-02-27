# Verification: Knotd Dev Lifecycle Scripts and Bridge Recovery

## Metadata
- Spec: `docs/specs/component/knotd-dev-lifecycle-011.md`
- Plan: `docs/plans/knotd-dev-lifecycle-011-plan.md`
- Date: `2026-02-27`
- Trace: `DESIGN-knotd-dev-lifecycle`

## Commands Run
- `npm run test -- src/tooling/knotdBridgeRuntime.test.ts`
- `bash scripts/dev-up.sh --check`
- `bash -n scripts/dev-up.sh && bash -n scripts/dev-down.sh`
- `node --check scripts/knotd-mcp-bridge.mjs && node --check scripts/knotd-mcp-bridge-runtime.mjs`
- `cargo check --manifest-path src-tauri/Cargo.toml --bin knotd`
- `npm run typecheck`

## Results
- Bridge reconnect tests: PASS (`4/4`)
- Dev lifecycle preflight check: PASS
- Shell syntax checks: PASS
- Bridge/runtime script syntax checks: PASS
- `cargo check --bin knotd`: PASS
- `npm run typecheck`: FAIL due pre-existing unrelated errors in:
  - `src/App.daemon-smoke.test.tsx`
  - `src/components/SearchBox/SearchBox.stories.tsx`
  - `src/components/Sidebar/index.tsx`

## Requirement Coverage
| Requirement | Evidence | Status |
| --- | --- | --- |
| FR-1 `dev-up` starts daemon + UI in daemon mode | `scripts/dev-up.sh`, `package.json` `dev:daemon:up` | ✅ Implemented |
| FR-2 `dev-down` aggressively stops repo-managed daemon + UI and clears socket | `scripts/dev-down.sh` | ✅ Implemented |
| FR-3 stale runtime/socket cleanup | `scripts/dev-up.sh` PID cleanup, socket removal, matching `knotd` kill path | ✅ Implemented |
| FR-4 signal running bridge with `SIGHUP` after daemon startup | `scripts/dev-up.sh` `signal_bridges` | ✅ Implemented |
| FR-5 actionable operator status output | `scripts/dev-up.sh`, `scripts/dev-down.sh` echo status lines | ✅ Implemented |
| FR-6 bounded reconnect backoff | `scripts/knotd-mcp-bridge-runtime.mjs`, tests | ✅ Implemented |
| FR-7 wait-for-signal mode after repeated failures | `scripts/knotd-mcp-bridge-runtime.mjs`, tests | ✅ Implemented |
| FR-8 bridge continues across disconnects and reconnects | `scripts/knotd-mcp-bridge.mjs` queued stdin + reconnect loop | ✅ Implemented |
| FR-9 automated coverage for reconnect policy | `src/tooling/knotdBridgeRuntime.test.ts` | ✅ Verified |

## Acceptance Criteria
| Acceptance Criterion | Status | Notes |
| --- | --- | --- |
| AC-1 `scripts/dev-up.sh` starts daemon + UI in daemon mode | ⚠️ Partial | Implemented and preflight-checked, but not exercised in a live Tauri session here |
| AC-2 `scripts/dev-down.sh` stops both and clears runtime files | ⚠️ Partial | Implemented and syntax-checked, but not exercised against a live launched pair here |
| AC-3 bridge survives daemon restart without manual bridge restart | ✅ | Reconnect loop + wait-for-signal policy implemented; `dev-up` sends `SIGHUP` |
| AC-4 bridge waits for signal after repeated failures | ✅ | Covered by targeted unit tests |
| AC-5 targeted automated tests cover reconnect behavior | ✅ | `4/4` tests passed |

## Gaps
- Live `dev-up`/`dev-down` integration was not executed in this session because Tauri desktop launch was not exercised here.
- Repo-wide TypeScript typecheck remains red from unrelated existing files.
