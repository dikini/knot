# Pre-Release Cleanup 023

## Metadata
- ID: `COMP-PRE-RELEASE-CLEANUP-023`
- Scope: `component`
- Status: `implemented`
- Parent: `COMP-UI-QA-DX-001`, `COMP-STORYBOOK-DX-001`, `COMP-WORKFLOW-FRESHNESS-021`, `COMP-STORYBOOK-STABILITY-022`
- Concerns: `[REL, COMP, CONF, CAP]`
- Trace: `DESIGN-pre-release-cleanup-023`
- Created: `2026-03-03`
- Updated: `2026-03-03`

## Purpose
Drive the repository from mostly-green to a clean pre-release state by eliminating brittle CI gates, lint warnings, and avoidable test/stories warning noise while keeping workflow documentation synchronized with the resulting quality bar.

## Functional Requirements
- FR-1: The Storybook coverage matrix gate MUST tolerate harmless markdown table formatting differences in the coverage inventory note while preserving its semantic enforcement.
- FR-2: The frontend lint gate MUST pass with zero warnings.
- FR-3: The App test lane MUST pass without repeated React `act(...)` warning noise.
- FR-4: Editor-, render-, and Storybook-related tests MUST not emit avoidable KaTeX quirks-mode or expected-path console noise to the default verification output.
- FR-5: The local pre-release CI wrapper MUST complete successfully once the repository satisfies the intended quality bar.
- FR-6: Documentation for cleanup work MUST remain fresh: changed quality-gate behavior, verification strategy, and workstream status MUST be reflected in spec/plan/audit and registry docs.

## Behavior
**Given** a maintainer reformats the Storybook coverage inventory markdown  
**When** `npm run -s qa:storybook-matrix` runs  
**Then** the validator still checks story counts and coverage semantics instead of failing on table spacing alone.

**Given** the repository is ready for release-quality verification  
**When** the maintainer runs the documented pre-release command set  
**Then** lint, tests, Storybook tests, Rust checks, and the local CI wrapper complete without avoidable warnings or gate drift.

## Design Decisions
| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Track the cleanup pass as one workstream with ordered tasks | Keeps sequential blocker removal visible and auditable | Some task details live in task/audit docs rather than separate specs |
| Fix warning root causes rather than muting output globally | Preserves trust in the quality bar | Cleanup may require more targeted refactoring |
| Treat documentation freshness as part of the release bar | Prevents another stale-registry cycle during cleanup | Adds small documentation overhead to each fix |

## Concern Mapping
| Concern | Requirement | Implementation Strategy |
| --- | --- | --- |
| REL | FR-1, FR-3, FR-5 | Deterministic tooling, test stabilization, and end-to-end local CI verification |
| COMP | FR-1, FR-2, FR-6 | Stable gate parsing, zero-warning lint, and aligned registry docs |
| CONF | FR-5, FR-6 | Explicit release-quality command set and fresh audit artifacts |
| CAP | FR-4, FR-5 | Reduce noisy failure surfaces so CI signal remains actionable at scale |

## Acceptance Criteria
- [x] `npm run -s qa:storybook-matrix` passes even when the coverage inventory note is formatted with aligned markdown table spacing.
- [x] `npm run lint` passes with zero warnings.
- [x] `npm run test -- --run` passes without repeated React `act(...)` warnings.
- [x] Editor/render/Storybook verification output is materially free of avoidable warning noise.
- [x] `npm run -s ci:local -- --skip-install --skip-playwright-install` passes.
- [x] A final verification note records the clean pre-release command set and outputs.

## Verification Strategy
- `npm run -s qa:storybook-matrix`
- `npm run lint`
- `npm run test -- --run`
- `npm run -s storybook:test:vitest`
- `cargo check --manifest-path src-tauri/Cargo.toml`
- `cargo test --manifest-path src-tauri/Cargo.toml --lib --quiet`
- `npm run -s qa:project-registry`
- `npm run -s ci:local -- --skip-install --skip-playwright-install`

## Related
- Depends on: `COMP-UI-QA-DX-001`, `COMP-STORYBOOK-DX-001`
- Used by: pre-release verification, workflow freshness, local CI trustworthiness
