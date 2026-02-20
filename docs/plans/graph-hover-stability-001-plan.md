# Implementation Plan: Graph Hover Stability

Change-Type: bug-fix
Trace: BUG-graph-hover-node-stability
Spec: `docs/specs/component/graph-hover-stability-001.md`
Generated: `2026-02-20`

## Tasks

| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| GHS-001 | Add failing regression test for forbidden hover transform on graph nodes | S | - | FR-3 |
| GHS-002 | Remove positional hover transform and keep non-positional hover emphasis | S | GHS-001 | FR-1, FR-2 |
| GHS-003 | Verify graph tests, typecheck, lint and publish audit | S | GHS-002 | FR-1..FR-3 |

## Verification Commands
```bash
npm test -- --run src/components/GraphView/GraphView.styles.test.ts src/components/GraphView/index.test.tsx
npm run -s typecheck
npx eslint src/components/GraphView/index.tsx src/components/GraphView/GraphView.css src/components/GraphView/GraphView.styles.test.ts
```
