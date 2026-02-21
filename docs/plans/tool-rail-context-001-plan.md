# Implementation Plan: Tool Rail and Context Panel Interaction Policy

Change-Type: design-update
Trace: DESIGN-tool-rail-context-policy
Spec: `docs/specs/component/tool-rail-context-policy-001.md`
Generated: `2026-02-21`

## Summary
- Total tasks: 7
- Approach: sequential
- Size: 5 small, 2 medium, 0 large
- Goal: implement hybrid tool activation policy, zero-trace context fold, and full-height rail border continuity.

## Tasks

| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| TRC-001 | Add failing tests for tool-activation policy transitions (active click toggle, inactive click behavior by tool class) | M | - | FR-4, FR-5, FR-6, FR-7 |
| TRC-002 | Add failing tests for context panel folded zero-trace behavior and removal of panel collapse control | S | TRC-001 | FR-2, FR-3 |
| TRC-003 | Add failing style/layout checks for narrower rail width and full-height vertical border continuity | S | TRC-002 | FR-1, FR-8 |
| TRC-004 | Implement tool activation policy model in shell state/actions, including per-tool optional-visibility memory for graph | M | TRC-003 | FR-4, FR-5, FR-6, FR-7 |
| TRC-005 | Refactor ToolRail and ContextPanel wiring: active-tool toggle only, remove in-panel fold control, enforce folded zero-width rendering | S | TRC-004 | FR-2, FR-3, FR-4, FR-5 |
| TRC-006 | Apply shell CSS updates for narrower rail and guaranteed full-height border visuals | S | TRC-005 | FR-1, FR-8 |
| TRC-007 | Verify tests/typecheck/lint and publish compliance audit | S | TRC-006 | FR-1..FR-8 |

## Dependency DAG
```text
TRC-001 -> TRC-002 -> TRC-003 -> TRC-004 -> TRC-005 -> TRC-006 -> TRC-007
```

## Concern Coverage
| Concern | Tasks | Verification |
| --- | --- | --- |
| CONF | TRC-004, TRC-005, TRC-006 | Component + app tests for deterministic interaction states |
| REL | TRC-001, TRC-004, TRC-007 | Regression tests for state transition correctness |
| CAP | TRC-006, TRC-007 | No additional runtime overhead beyond lightweight state branching |

## Verification Commands
```bash
npm test -- --run src/components/Shell/ToolRail.test.tsx src/components/Shell/ContextPanel.test.tsx src/App.test.tsx
npm run -s typecheck
npx eslint src/App.tsx src/App.test.tsx src/components/Shell/ToolRail.tsx src/components/Shell/ToolRail.css src/components/Shell/ContextPanel.tsx src/components/Shell/ContextPanel.css src/lib/store.ts
```
