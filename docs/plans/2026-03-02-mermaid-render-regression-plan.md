# Implementation Plan: Mermaid View-Mode Render Regression

## Metadata
- Spec: `docs/specs/component/mermaid-diagrams-001.md`
- Generated: `2026-03-02`
- Approach: `sequential`

## Summary
- Root cause hypothesis: Mermaid view-mode hydration invokes `mermaid.render()` without the diagram wrapper as an explicit render container, causing runtime render failure in the current Mermaid/browser environment.
- Scope: restore `COMP-MERMAID-001` FR-3 and FR-8 without changing markdown representation or edit-mode behavior.

## Tasks

### Phase 1: Regression Reproduction
| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| MRM-REG-001 | Confirm Mermaid fences still exist in note content and isolate failure to runtime hydration rather than markdown parsing | S | - | FR-1, FR-3 |

### Phase 2: Fix
| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| MRM-REG-002 | Update Mermaid adapter to render against the target wrapper container and preserve successful rendered state markers | S | MRM-REG-001 | FR-3, FR-4, FR-8 |

### Phase 3: Regression Coverage
| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| MRM-REG-003 | Add focused renderer test asserting the explicit container contract for Mermaid runtime rendering | S | MRM-REG-002 | FR-3, FR-8 |
| MRM-REG-004 | Re-run focused markdown/editor suites and typecheck | S | MRM-REG-003 | FR-3, FR-8, FR-9 |

## Verification Commands
```bash
npm test -- --run src/editor/render.test.ts src/editor/markdown.test.ts src/components/Editor/index.test.tsx
npm run -s typecheck
```

## Exit Criteria
- Mermaid view mode produces rendered SVG output again through the existing wrapper path.
- A focused unit regression test fails if the render adapter stops passing the explicit container.
- Markdown/editor suites and typecheck pass after the change.
