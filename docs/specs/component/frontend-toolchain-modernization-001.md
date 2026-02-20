# Frontend Toolchain Modernization

## Metadata
- ID: `COMP-TOOLCHAIN-001`
- Scope: `component`
- Status: `implemented`
- Parent: `COMP-FRONTEND-001`
- Concerns: [REL, CAP, COMP]
- Created: `2026-02-20`
- Updated: `2026-02-20`

## Purpose
Modernize the frontend JavaScript/TypeScript toolchain to current stable majors while preserving runtime behavior and test confidence.

## Contract

### Functional Requirements
**FR-1**: Upgrade core frontend runtime packages
- Upgrade `react` and `react-dom` to stable 19.x line.
- Keep runtime entrypoint and app behavior unchanged.

**FR-2**: Upgrade build and test tooling
- Upgrade `vite` and `@vitejs/plugin-react` to stable 7.x/5.x compatible line.
- Upgrade `vitest` and `@vitest/coverage-v8` to matching 4.x line.

**FR-3**: Upgrade compiler/tooling types
- Upgrade `typescript` to latest stable 5.x.
- Align `@types/react` and `@types/react-dom` with React 19.

**FR-4**: Preserve quality gates
- `npm install` completes without peer-resolution conflict.
- `npm run typecheck` passes.
- `npm test -- --run` passes.

**FR-5**: Add governance check for version drift
- Add an automated test that validates toolchain major versions expected by this modernization.

## Design Decisions
| Decision | Rationale | Trade-off |
|---|---|---|
| Upgrade in one coherent set | Avoid partial peer conflicts between Vite/Vitest/coverage/react types | Larger single change set |
| Keep linting stack unchanged in this pass | Reduce migration risk and isolate scope to runtime/build/test toolchain | Leaves lint modernization for follow-up |
| Add version-guard test | Prevent future accidental major mismatches | Adds one maintenance test tied to package policy |

## Concern Mapping
| Concern | Requirement | Strategy |
|---|---|---|
| REL | FR-4 | Re-run install, typecheck, and full tests after migration |
| CAP | FR-2 | Keep modern bundler/test runner versions for performance/security updates |
| COMP | FR-1, FR-2, FR-3 | Upgrade related package families together and validate peers |

## Acceptance Criteria
- [x] `package.json` reflects target modernized versions for FR-1..FR-3.
- [x] Version-governance test exists and passes (FR-5).
- [x] `npm install` succeeds without ERESOLVE conflicts (FR-4).
- [x] `npm run typecheck` passes (FR-4).
- [x] `npm test -- --run` passes (FR-4).
- [x] Spec registry and project state are updated with outcome.

## Verification Strategy
- Automated: toolchain-version test + full typecheck + full unit tests.
- Manual: optional `npm run tauri dev` smoke run after dependency upgrade.

## Related
- Depends on: `COMP-FRONTEND-001`
- Used by: frontend development workflow, CI quality gates
