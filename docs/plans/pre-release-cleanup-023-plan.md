# Implementation Plan: Pre-Release Cleanup 023

## Metadata
- Trace: `DESIGN-pre-release-cleanup-023`
- Spec: `docs/specs/component/pre-release-cleanup-023.md`
- Change-Type: `design-update`
- Generated: `2026-03-03`
- Approach: `sequential`

## Summary
- Goal: remove the known blockers that keep the repository from a clean pre-release quality bar
- Total tasks: 5
- Critical path: `matrix gate -> lint cleanup -> App warning cleanup -> editor noise cleanup -> final CI closure`

## Tasks

| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| PRC-023-001 | Harden the Storybook matrix parser against harmless markdown formatting drift | S | - | FR-1 |
| PRC-023-002 | Remove App hook dependency lint warnings without changing shell behavior | S | PRC-023-001 | FR-2 |
| PRC-023-003 | Eliminate repeated React `act(...)` warnings from App tests | M | PRC-023-002 | FR-3 |
| PRC-023-004 | Quiet avoidable editor, KaTeX, and Storybook warning noise | M | PRC-023-003 | FR-4 |
| PRC-023-005 | Run full pre-release verification, fix remaining blockers, and publish closure audit | M | PRC-023-004 | FR-5, FR-6 |

## Verification Commands
- `npm run -s qa:storybook-matrix`
- `npm run lint`
- `npm run test -- --run`
- `npm run -s storybook:test:vitest`
- `cargo check --manifest-path src-tauri/Cargo.toml`
- `cargo test --manifest-path src-tauri/Cargo.toml --lib --quiet`
- `npm run -s qa:project-registry`
- `npm run -s ci:local -- --skip-install --skip-playwright-install`
