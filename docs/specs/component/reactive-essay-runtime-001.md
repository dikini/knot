# Reactive Essay Runtime (Speculative)

## Metadata
- ID: `COMP-REACTIVE-ESSAY-001`
- Scope: `component`
- Status: `draft`
- Parent: none
- Concerns: `[REL, CONS, CAP, OBS, CONF]`
- Trace: `DESIGN-reactive-essay-runtime-speculative`
- Created: `2026-02-23`
- Updated: `2026-02-23`

## Purpose
Define a speculative architecture for "reactive essays": deterministic documents produced from typed sensor streams, equations/transforms, and fixed-point reconciliation, with LLMs used inside bounded transform/render steps.

## Boundaries
In scope:
- Per-essay runtime model with typed sensors, variables, transforms, and section renderers.
- Incremental fixed-point evaluation with convergence safeguards.
- Deterministic materialized state from append-only event logs.
- Configurable non-convergence policy (`hard_error` or `soft_warning`).

Out of scope (this spec slice):
- UX/editor surface for authoring equation graphs.
- Specific model provider integrations and prompt libraries.
- Scheduling/distributed execution across machines.

## Functional Requirements
- FR-1: Runtime MUST model each essay as a typed dependency graph where sensor inputs are exogenous nodes and computed variables are derived nodes.
- FR-2: Variables MUST use single-writer semantics at graph level: each variable has exactly one defining transform/equation.
- FR-3: Runtime MUST ingest sensor data as append-only typed events and MUST derive current materialized state deterministically from that log.
- FR-4: Reconciliation MUST run as incremental fixed-point evaluation over dependency closure seeded by changed inputs.
- FR-5: Dependency closure MAY expand during reconciliation if intermediate updates activate additional downstream dependencies.
- FR-6: Variable equality MUST be configurable per variable via equality contracts (for example structural equality, interval tolerance, semantic similarity).
- FR-7: Runtime MUST detect and surface non-convergence using safeguards: iteration cap, oscillation detection, and divergence diagnostics.
- FR-8: Runtime MUST preserve last stable checkpoints for each variable and use checkpoints in fallback behavior.
- FR-9: Non-convergence handling MUST be configurable per essay/run as `hard_error` (block publish) or `soft_warning` (publish last stable with diagnostics).
- FR-10: Section outputs MUST be deterministic functions of resolved variable state and renderer inputs for a specific run configuration.
- FR-11: LLM-backed transforms/renderers MUST declare typed input/output schemas and be isolated as bounded steps within deterministic orchestration.
- FR-12: Runtime MUST emit observability records for each reconciliation cycle: trigger set, affected closure, iteration count, stop reason, and policy outcome.
- FR-13: Runtime MUST support replay from the event log to reconstruct prior states for audit/debug and branch simulation.

## Interface (Conceptual)
```ts
type SensorEvent<T> = {
  stream: string;
  ts: string; // ISO8601
  seq: number;
  payload: T;
};

type EqualityContract<T> = (a: T, b: T) => boolean;

type VariableDef<T> = {
  id: string;
  deps: string[];
  evaluate: (ctx: EvalContext) => Promise<T> | T;
  equals: EqualityContract<T>;
};

type ReconcilePolicy = {
  maxIterations: number;
  onNonConvergence: "hard_error" | "soft_warning";
};

type ReconcileResult = {
  converged: boolean;
  iterations: number;
  changed: string[];
  warnings: string[];
  stopReason: "fixed_point" | "iteration_cap" | "oscillation" | "divergence";
};
```

## Behavior
Given sensor events are appended for an essay run,
When reconciliation starts,
Then runtime computes dependency closure from changed inputs and iterates evaluation until fixed-point or stop condition.

Given any variable changes during iteration,
When downstream dependencies become newly reachable,
Then runtime expands the active frontier and continues iteration within the same cycle.

Given reconciliation stops without convergence,
When policy is `hard_error`,
Then publish is blocked and diagnostics are returned.

Given reconciliation stops without convergence,
When policy is `soft_warning`,
Then runtime publishes the last stable materialized state and includes warnings.

## Design Decisions
| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Append-only log as source of truth | Replayability, auditability, deterministic reconstruction | Additional storage and projection complexity |
| Single-writer variables | Eliminates direct multi-sensor write conflicts by construction | Requires explicit composition transforms |
| Incremental fixed-point solver | Efficient recomputation for local changes | More complex scheduler/frontier bookkeeping |
| Per-variable equality contracts | Supports mixed domains (exact, numeric tolerance, semantic) | Equality definitions can be misconfigured |
| General transforms + safeguards in v1 | Preserves expressiveness for novel workflows | No compile-time convergence guarantee |
| LLM as bounded transform/renderer | Uses model strength while preserving deterministic orchestration | Model variance still needs strong schemas/prompts |

## Concern Mapping
| Concern | Requirement | Implementation Strategy |
| --- | --- | --- |
| REL | FR-7, FR-8, FR-9 | Iteration caps, oscillation detection, stable checkpoints, explicit failure policy |
| CONS | FR-2, FR-3, FR-10 | Single-writer equations, deterministic projections, run-scoped renderer inputs |
| CAP | FR-4, FR-5 | Incremental closure and frontier expansion instead of full-graph recompute |
| OBS | FR-12, FR-13 | Structured reconciliation traces and replayable event log |
| CONF | FR-9, FR-10 | User-selectable policy and predictable published state semantics |

## Acceptance Criteria
- [ ] AC-1: Runtime graph schema supports typed sensors, single-writer variables, and section renderers.
- [ ] AC-2: Incremental fixed-point loop converges on representative acyclic and cyclic fixture graphs where convergence exists.
- [ ] AC-3: Non-convergent fixtures trigger configured policy with correct stop reason and diagnostics.
- [ ] AC-4: Per-variable equality contracts change convergence behavior as configured in tests.
- [ ] AC-5: Replay from event log reproduces identical materialized state for the same run configuration.
- [ ] AC-6: Reconciliation telemetry records trigger set, closure size, iteration count, and outcome.
- [ ] AC-7: `soft_warning` publishes last stable state while `hard_error` blocks publish on same failing fixture.

## Verification Strategy
- Unit tests for dependency closure expansion, equality contracts, oscillation detection, and fallback semantics.
- Property tests for deterministic replay under identical event sequences.
- Integration tests with mixed deterministic and LLM-backed mock transforms using strict schemas.
- bk-verify audit after implementation to compute FR/AC compliance percentage.

## Open Questions
- Should runtime provide optional static checks for monotonicity/idempotence classes to pre-score convergence risk?
- How should semantic-equality contracts be calibrated and versioned for reproducible behavior?
- What UX should expose convergence diagnostics to users authoring reactive essays?

## Related
- Depends on: none
- Used by: (future) reactive document authoring and AI-assisted publishing workflows
