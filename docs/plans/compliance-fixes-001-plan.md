# Implementation Plan: Frontend Compliance Fixes

## Metadata
- Spec: `docs/specs/component/compliance-fixes-001.md`
- Generated: `2026-02-20`
- Approach: `sequential`

## Summary
- Total tasks: `4`
- Sizes: `2 small`, `2 medium`
- Critical path: `CFX-001 -> CFX-002 -> CFX-003 -> CFX-004`

## Tasks

### Phase 1: Test-First Regression Coverage
| ID | Task | Size | Depends | Spec Ref |
|---|---|---|---|---|
| CFX-001 | Add failing App regression test for vault-switch hydration/write ordering | M | - | FR-1, FR-2 |

### Phase 2: Implementation Fixes
| ID | Task | Size | Depends | Spec Ref |
|---|---|---|---|---|
| CFX-002 | Implement vault-scoped view-mode hydration guard in app shell | M | CFX-001 | FR-1, FR-2 |
| CFX-003 | Remove explicit `any` usage from SearchBox test async mock | S | CFX-001 | FR-3 |
| CFX-004 | Correct SearchBox keyboard callback dependencies | S | CFX-001 | FR-4 |

## Dependency DAG
```text
CFX-001 -> CFX-002 -> CFX-003 -> CFX-004
```

## Test Mapping
| Requirement | Test Location | Notes |
|---|---|---|
| FR-1 | `src/App.test.tsx` | Assert no stale write to new vault key during switch |
| FR-2 | `src/App.test.tsx` | Assert mode resolves to target vault preference |
| FR-3 | `src/components/SearchBox/index.test.tsx` | Type-safe promise resolve path for loading-state test |
| FR-4 | `src/components/SearchBox/index.tsx` | Hook dependency correctness; exercised by existing keyboard tests |

## Verification Commands
```bash
npm run typecheck
npm test -- --run src/App.test.tsx src/components/SearchBox/index.test.tsx
npm run lint -- src/App.tsx src/App.test.tsx src/components/SearchBox/index.tsx src/components/SearchBox/index.test.tsx
```
