# Implementation Plan: Workflow Freshness Hardening 021

## Metadata
- Trace: `DESIGN-workflow-freshness-hardening-021`
- Spec: `docs/specs/component/workflow-freshness-hardening-021.md`
- Change-Type: `design-update`
- Generated: `2026-03-03`
- Approach: `sequential`

## Summary
- Goal: harden local workflow freshness with cheap executable gates and align skill docs to the enforced repository policy
- Total tasks: 4
- Critical path: `tests -> staged validator/hook wiring -> skill doc alignment -> verification`

## Tasks

| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| WFH-021-001 | Add failing tests for staged workflow validation composition | S | - | FR-2, FR-5 |
| WFH-021-002 | Implement staged/pre-push workflow gates and auto hook installation | M | WFH-021-001 | FR-1, FR-2, FR-3 |
| WFH-021-003 | Align workflow skill docs to validator-backed registry and roadmap policy | S | WFH-021-002 | FR-4 |
| WFH-021-004 | Run verification and publish audit evidence | S | WFH-021-003 | FR-5, FR-6 |

## Verification Commands
- `npm run test -- --run src/tooling/stagedWorkflow.test.ts`
- `npm run -s workflow:check-staged`
- `npm run -s workflow:check-prepush`
- `npm run typecheck`
