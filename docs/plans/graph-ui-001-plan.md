# Implementation Plan: Graph Visualization UI
Change-Type: design-update
Trace: DESIGN-graph-ui-001

## Metadata
- Spec: `docs/specs/component/graph-ui-001.md`
- Generated: `2026-03-01`
- Approach: `sequential`

## Summary
- Total tasks: `12`
- Sizes: `8 small`, `4 medium`
- Critical path: `GUI-001 -> GUI-002 -> GUI-003 -> GUI-004 -> GUI-006 -> GUI-007 -> GUI-008 -> GUI-009 -> GUI-010 -> GUI-011 -> GUI-012 -> GUI-005`

## Tasks

### Phase 1: Spec + Parent Integration
| ID | Task | Size | Depends | Spec Ref |
|---|---|---|---|---|
| GUI-001 | Finalize Graph UI spec and acceptance criteria | S | - | FR-1..FR-5 |
| GUI-002 | Add App-level graph/editor toggle with per-vault persistence | M | GUI-001 | FR-4 |

### Phase 2: Graph Interaction Completeness
| ID | Task | Size | Depends | Spec Ref | Concerns |
|---|---|---|---|---|---|
| GUI-003 | Add connected-edge highlighting on node hover | M | GUI-002 | FR-2, FR-5 | CAP, REL |
| GUI-004 | Ensure graph node click loads note and returns to editor | M | GUI-002 | FR-2, FR-4 | REL |

### Phase 3: Label Readability
| ID | Task | Size | Depends | Spec Ref |
|---|---|---|---|---|
| GUI-006 | Add failing tests for dense-cluster label staggering and edge-aware label anchoring | S | GUI-003, GUI-004 | FR-6 |
| GUI-007 | Implement density-aware label placement, compact crowded labels, and edge clipping avoidance | S | GUI-006 | FR-6 |

### Phase 4: Verification + Status
| ID | Task | Size | Depends | Spec Ref |
|---|---|---|---|---|
| GUI-005 | Update verification report and project status artifacts | S | GUI-003, GUI-004, GUI-007 | FR-1..FR-6 |

### Phase 4: Text-First Node Rendering
| ID | Task | Size | Depends | Spec Ref |
|---|---|---|---|---|
| GUI-008 | Add failing tests for text-first graph nodes, rectangular hit targets, and debug-visible active states | S | GUI-007 | FR-1, FR-5 |
| GUI-009 | Replace circle nodes with text-first rectangular node targets and update stories/styles | M | GUI-008 | FR-1, FR-5 |

### Phase 5: Verification + Status
| ID | Task | Size | Depends | Spec Ref |
|---|---|---|---|---|
| GUI-005 | Update verification report and project status artifacts | S | GUI-003, GUI-004, GUI-007, GUI-009 | FR-1..FR-6 |

### Phase 5: Fit Floor and Overflow
| ID | Task | Size | Depends | Spec Ref |
|---|---|---|---|---|
| GUI-010 | Add failing tests for readability-floor fit, scrollable overflow cues, and collision-safe pill placement | M | GUI-009 | FR-7 |
| GUI-011 | Implement canonical-scale graph framing, collision-safe pill spacing, and scrollable overflow viewport | M | GUI-010 | FR-7 |
| GUI-012 | Ensure reset uses the latest persisted readability floor while active manual view state remains unchanged until reset/open | S | GUI-011 | FR-7 |

## Dependency DAG
```text
GUI-001 -> GUI-002 -> GUI-003 -> GUI-004 -> GUI-006 -> GUI-007 -> GUI-008 -> GUI-009 -> GUI-010 -> GUI-011 -> GUI-012 -> GUI-005
```

## Test Mapping
| Requirement | Test Location | Notes |
|---|---|---|
| FR-1 | `src/components/GraphView/index.test.tsx` | Render, loading, empty, error |
| FR-2 | `src/components/GraphView/index.test.tsx` | Pan, zoom, click, hover highlight |
| FR-3 | `src/components/GraphView/index.test.tsx` | Backend fetch and dimension updates |
| FR-4 | `src/App.test.tsx` | Toggle visibility, mode switching, note-open flow |
| FR-5 | `src/components/GraphView/index.test.tsx` | Selected/hovered styling states |
| FR-6 | `src/components/GraphView/index.test.tsx` | Dense label readability, edge-aware label placement, and full-identity tooltip coverage |
| FR-1, FR-5 | `src/components/GraphView/index.test.tsx`, `src/components/GraphView/GraphView.stories.tsx` | Text-first node target rendering, active-state backgrounds, and interaction coverage |
| FR-7 | `src/components/GraphView/index.test.tsx` | Readability-floor fit, no-overlap pill placement, overflow cues, and reset/no-surprise framing |

## Verification Commands
```bash
npm run typecheck
npm test -- --run
```
