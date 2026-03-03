# Documentation Registry Alignment Plan

Change-Type: design-update
Trace: DESIGN-doc-registry-alignment-020
Spec: `docs/specs/component/documentation-registry-alignment-020.md`
Generated: `2026-03-03`
Approach: `sequential`

## Summary
- Total tasks: 4
- Goal: make project-wide status trustworthy by reducing duplicated status prose and validating registry docs against component spec metadata

## Tasks

| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| DRA-020-001 | Add failing tests for project-registry parsing and drift detection | S | - | FR-5 |
| DRA-020-002 | Implement `qa:project-registry` validator and wire package script | M | DRA-020-001 | FR-5 |
| DRA-020-003 | Refresh `PROJECT_STATE.md`, `spec-map.md`, and `roadmap-index.md` to align to the canonical chain | M | DRA-020-002 | FR-1, FR-2, FR-3, FR-4, FR-6 |
| DRA-020-004 | Verify registry alignment and publish audit evidence | S | DRA-020-003 | FR-5, FR-6 |

## Verification Commands
```bash
npm run test -- --run src/tooling/projectRegistry.test.ts
npm run -s qa:project-registry
npm run typecheck
```
