# Implementation Plan: Mermaid Diagrams in Markdown and Editor

Change-Type: design-update
Trace: DESIGN-mermaid-diagrams-001
Spec: `docs/specs/component/mermaid-diagrams-001.md`
Generated: `2026-02-22`

## Metadata
- Spec: `docs/specs/component/mermaid-diagrams-001.md`
- Generated: `2026-02-22`
- Approach: `sequential with bounded parallel test authoring`

## Summary
- Total tasks: `8`
- Size mix: `3 small, 5 medium`
- Critical path: `MRM-001 → MRM-002 → MRM-003 → MRM-004 → MRM-007 → MRM-008`

## Tasks

### Phase 1: Foundation
| ID | Task | Size | Depends | Spec Ref |
|----|------|------|---------|----------|
| MRM-001 | Add Mermaid dependency and rendering adapter boundary in frontend markdown render pipeline | M | - | FR-3, FR-7, FR-8 |
| MRM-002 | Define Mermaid rendering policy (safe config + fallback contract) in renderer utilities | S | MRM-001 | FR-4, FR-7 |

### Phase 2: View Rendering
| ID | Task | Size | Depends | Spec Ref |
|----|------|------|---------|----------|
| MRM-003 | Implement view-mode Mermaid detection and SVG rendering for `code_block.language=mermaid` | M | MRM-001, MRM-002 | FR-1, FR-3, FR-8 |
| MRM-004 | Implement deterministic fallback state for Mermaid parse/render failures | S | MRM-003 | FR-4 |
| MRM-005 | Add view-surface Mermaid styling consistent with editor reading surface | S | MRM-003 | FR-3, FR-4, FR-8 |

### Phase 3: Edit Insertion UX
| ID | Task | Size | Depends | Spec Ref |
|----|------|------|---------|----------|
| MRM-006 | Add `Mermaid diagram` block-menu action inserting starter fenced snippet | M | MRM-001 | FR-5, FR-6 |

### Phase 4: Verification
| ID | Task | Size | Depends | Spec Ref |
|----|------|------|---------|----------|
| MRM-007 | Add markdown parser/serializer regression tests for Mermaid fence round-trip and non-Mermaid parity | M | MRM-003, MRM-004 | FR-1, FR-2, FR-9 |
| MRM-008 | Add editor component tests for view rendering, fallback, and insertion flow; run typecheck + focused suites | M | MRM-005, MRM-006, MRM-007 | FR-2, FR-3, FR-4, FR-5, FR-6, FR-9 |

## Dependency DAG
`MRM-001 → MRM-002 → MRM-003 → MRM-004 → MRM-007 → MRM-008`

`MRM-003 → MRM-005 → MRM-008`

`MRM-001 → MRM-006 → MRM-008`

## Concern Coverage
| Concern | Tasks | Verification |
|---------|-------|--------------|
| REL | MRM-003, MRM-004, MRM-008 | View rendering tests for valid/invalid Mermaid blocks |
| SEC | MRM-002, MRM-003, MRM-008 | Safe Mermaid config assertions and no-crash render behavior |
| CAP | MRM-001, MRM-003, MRM-005, MRM-008 | Bounded rerender behavior in view-mode-only flow |
| COMP | MRM-006, MRM-007, MRM-008 | Round-trip and parity regression tests |
| CONF | MRM-004, MRM-005, MRM-006, MRM-008 | UX tests for insertion discoverability and fallback clarity |

## Verification Commands
```bash
npm test -- --run src/editor/markdown.test.ts src/components/Editor/index.test.tsx
npm run -s typecheck
```

## Exit Criteria
- Mermaid-fenced markdown round-trips without loss.
- View mode renders valid Mermaid and gracefully falls back on invalid Mermaid.
- Edit mode insertion exposes Mermaid action and produces expected fence template.
- Existing non-Mermaid markdown behavior remains regression-safe.

## Execution Complete
- Date: `2026-02-22`
- Status: `implemented`
- Verification: `docs/audit/mermaid-diagrams-001-verification-2026-02-22.md`
