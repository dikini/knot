# Workflow Freshness Hardening

## Metadata
- ID: `COMP-WORKFLOW-FRESHNESS-021`
- Scope: `component`
- Status: `draft`
- Parent: `COMP-TRACE-LITE-001`, `COMP-DOC-REGISTRY-020`, `COMP-UI-QA-DX-001`
- Concerns: `[REL, COMP, CONF]`
- Trace: `DESIGN-workflow-freshness-hardening-021`
- Created: `2026-03-03`
- Updated: `2026-03-03`

## Purpose
Reduce stale workflow docs by moving more freshness policy into cheap executable gates, making hook installation automatic, and aligning skill guidance with the validators that actually enforce repository policy.

## Functional Requirements
- FR-1: Repository setup MUST auto-install `.githooks` through the normal npm install lifecycle so pre-commit and pre-push enforcement is not opt-in per clone.
- FR-2: A staged workflow validator MUST run in pre-commit and compose the existing staged traceability rules, staged UI doc-sync rules when relevant, and staged project-registry validation when registry-related docs are touched.
- FR-3: Pre-push MUST run a lightweight workflow-quality gate that verifies code quality and documentation freshness without invoking the full browser/native local CI stack.
- FR-4: Workflow skill docs under `.agents/skills/` that describe canonical registry or roadmap status behavior MUST align with the enforced repository policy and point to validators rather than duplicating contradictory prose.
- FR-5: Automated tests MUST cover the staged workflow validator decision logic for traceability, UI doc sync, and staged project-registry drift.
- FR-6: Verification artifacts for this workstream MUST record the staged and pre-push gates that now protect against stale docs.

## Behavior
**Given** a developer clones the repo and runs `npm install` or `npm ci`  
**When** they start committing changes  
**Then** the repository hooks are already installed without requiring a manual `hooks:install` step.

**Given** a staged change touches UI implementation without matching stories/evidence/docs  
**When** pre-commit runs  
**Then** the staged workflow validator fails before the commit is created.

**Given** a staged change touches component spec metadata, roadmap, or project-state registry files  
**When** pre-commit runs  
**Then** staged project-registry validation fails if the canonical docs are inconsistent.

**Given** a developer pushes a branch  
**When** pre-push runs  
**Then** lightweight quality and freshness checks run without blocking on full browser/native smoke workflows.

## Design Decisions
| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Compose one staged workflow gate from existing validators | Centralizes policy with minimal new logic | Adds one more wrapper script |
| Keep registry validation conditional on registry-relevant staged files | Avoids unrelated commits failing on non-doc work | Registry drift outside the staged set is caught later, not always at pre-commit |
| Make pre-push lighter than `ci:local` | Keeps freshness checks usable as a daily gate | Full runtime confidence remains CI/manual, not local pre-push |
| Align skills to validators instead of prose-only policy | Reduces future contradiction drift | Skill docs become less narrative and more operational |

## Concern Mapping
| Concern | Requirement | Implementation Strategy |
| --- | --- | --- |
| REL | FR-1, FR-2, FR-3, FR-5 | Cheap deterministic gates on staged and pre-push paths |
| COMP | FR-2, FR-4, FR-5 | Shared status vocabulary and validator-backed workflow instructions |
| CONF | FR-1, FR-3, FR-6 | Hook bootstrap via npm lifecycle and explicit verification artifacts |

## Acceptance Criteria
- [ ] `npm install` or `npm ci` invokes hook installation automatically via package scripts.
- [ ] `.githooks/pre-commit` runs a staged workflow validator rather than only the traceability validator.
- [ ] Staged workflow tests fail on missing UI docs/evidence and on staged project-registry drift, and pass on aligned input.
- [ ] `.githooks/pre-push` no longer shells out to the full `ci:local` workflow.
- [ ] Updated skill docs no longer describe `spec-map.md` as immutable-only metadata or roadmap status as `done`.
- [ ] A verification report records the commands used to validate the new gates.

## Verification Strategy
- Unit tests for staged workflow validation logic.
- `npm run test -- --run src/tooling/stagedWorkflow.test.ts`
- `npm run -s workflow:check-staged`
- `npm run -s workflow:check-prepush`
- `npm run typecheck`

## Related
- Depends on: `COMP-TRACE-LITE-001`, `COMP-DOC-REGISTRY-020`
- Used by: local development workflow, hook enforcement, workflow-skill guidance
