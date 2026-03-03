# Documentation Registry Alignment

## Metadata
- ID: `COMP-DOC-REGISTRY-020`
- Scope: `component`
- Status: `draft`
- Parent: `COMP-TRACE-LITE-001`, `COMP-UI-QA-DX-001`, `COMP-STORYBOOK-DX-001`
- Concerns: `[REL, COMP, CONF]`
- Trace: `DESIGN-doc-registry-alignment-020`
- Created: `2026-03-03`
- Updated: `2026-03-03`

## Purpose
Restore one trustworthy project-wide status registry by reducing duplicated status prose, aligning summary docs to component spec metadata, and adding an automated validator that catches future drift.

## Functional Requirements
- FR-1: `docs/PROJECT_STATE.md` MUST identify `docs/specs/system/spec-map.md` as the canonical component registry and MUST stop duplicating a full per-component status matrix.
- FR-2: Every component spec with metadata (`ID`, `Status`) under `docs/specs/component/` MUST have a corresponding row in `docs/specs/system/spec-map.md`.
- FR-3: For designed component specs, the `Status` column in `docs/specs/system/spec-map.md` MUST match the status declared in the component spec metadata exactly.
- FR-4: `docs/planning/roadmap-index.md` MUST describe itself as a planning board, not the canonical component registry, and any listed workstream row MUST not contradict the referenced component spec status.
- FR-5: An automated validation command MUST parse component specs, `spec-map.md`, `roadmap-index.md`, and `PROJECT_STATE.md`, and fail when the registry docs drift from these rules.
- FR-6: Verification-facing docs for this workstream MUST document the canonical chain as `component spec -> plan/tasks -> implementation -> audit`, with `spec-map.md` acting as the project-wide component registry view.

## Behavior
**Given** a component spec is still marked `draft`  
**When** a maintainer updates `docs/specs/system/spec-map.md` or `docs/planning/roadmap-index.md`  
**Then** the registry docs continue to show that workstream as draft/planned instead of claiming full implementation.

**Given** a maintainer forgets to add a new component spec to `docs/specs/system/spec-map.md`  
**When** the project registry validator runs  
**Then** it fails with a missing-row error.

**Given** the team updates feature status in component specs  
**When** `docs/PROJECT_STATE.md` is read  
**Then** it points readers to the canonical registry instead of re-stating potentially stale component rows.

## Design Decisions
| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Make `spec-map.md` the only canonical project-wide component registry | Reduces duplicated status surfaces | Requires maintainers to follow the registry discipline |
| Demote `PROJECT_STATE.md` to a policy/index document | Avoids a second manual status table | Loses the old “all-in-one” narrative summary |
| Validate `roadmap-index.md` only for listed rows, not for total completeness | Keeps the roadmap usable as a planning board | The roadmap remains a subset view, not a full registry |
| Match `spec-map.md` status text exactly to component spec metadata | Removes ambiguous editorial phrasing | Gives up some convenience prose in the table |

## Concern Mapping
| Concern | Requirement | Implementation Strategy |
| --- | --- | --- |
| REL | FR-1, FR-2, FR-3, FR-5 | One canonical registry, automated drift validation, and reduced duplicate status text |
| COMP | FR-3, FR-4, FR-6 | Consistent status vocabulary across specs, roadmap, and verification-facing docs |
| CONF | FR-1, FR-4, FR-6 | Explicitly documented source-of-truth chain and planning-vs-registry distinction |

## Acceptance Criteria
- [ ] `docs/PROJECT_STATE.md` no longer contains the old duplicated component status matrix.
- [ ] `docs/specs/system/spec-map.md` contains rows for every current component spec with exact metadata status matching.
- [ ] `docs/planning/roadmap-index.md` no longer contradicts listed component spec statuses.
- [ ] `npm run -s qa:project-registry` fails on synthetic registry drift fixtures and passes on the repository after updates.
- [ ] A verification report documents the new canonical chain and the commands used to validate it.

## Verification Strategy
- Unit tests for project-registry parsing and drift detection.
- `npm run -s qa:project-registry`
- `npm run typecheck`

## Related
- Depends on: `COMP-TRACE-LITE-001`
- Used by: project status reporting, roadmap hygiene, future audit trustworthiness
