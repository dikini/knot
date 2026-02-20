# Implementation Plan: Frontend Toolchain Modernization

## Metadata
- Spec: `docs/specs/component/frontend-toolchain-modernization-001.md`
- Generated: `2026-02-20`
- Approach: `sequential`

## Summary
- Total tasks: `6`
- Sizes: `2 small`, `3 medium`, `1 small`
- Critical path: `TC-001 -> TC-002 -> TC-003 -> TC-004 -> TC-005 -> TC-006`

## Tasks

### Phase 1: TDD Guardrail
| ID | Task | Size | Depends | Spec Ref |
|---|---|---|---|---|
| TC-001 | Add failing version-governance test for target majors | S | - | FR-5 |

### Phase 2: Dependency Modernization
| ID | Task | Size | Depends | Spec Ref |
|---|---|---|---|---|
| TC-002 | Upgrade React + React DOM + React type packages | M | TC-001 | FR-1, FR-3 |
| TC-003 | Upgrade Vite + plugin-react and align config if needed | M | TC-002 | FR-2 |
| TC-004 | Upgrade Vitest + coverage plugin and align test config | M | TC-003 | FR-2 |
| TC-005 | Upgrade TypeScript and resolve compile/test regressions | M | TC-004 | FR-3, FR-4 |

### Phase 3: Verify + Status
| ID | Task | Size | Depends | Spec Ref |
|---|---|---|---|---|
| TC-006 | Run install/typecheck/tests and update project docs | S | TC-005 | FR-4 |

## Dependency DAG
```text
TC-001 -> TC-002 -> TC-003 -> TC-004 -> TC-005 -> TC-006
```

## Verification Commands
```bash
npm install
npm run typecheck
npm test -- --run
```
