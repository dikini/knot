# UI Quality Assurance DX Maturity

## Metadata
- ID: `COMP-UI-QA-DX-001`
- Scope: `component`
- Status: `in progress`
- Parent: `COMP-UI-AUTOMATION-DX-001`, `COMP-EDITOR-MODES-001`, `COMP-MERMAID-001`
- Concerns: `[REL, CONF, COMP, CAP]`
- Trace: `DESIGN-ui-qa-dx-001`
- Created: `2026-02-22`
- Updated: `2026-02-22`

## Purpose
Raise Knot's UI verification from baseline automation to a reviewable, repeatable quality standard that covers behavior, visual integrity, native-runtime confidence, and human-readable review artifacts.

## Contract

### Functional Requirements
**FR-1**: Browser-first Playwright coverage MUST expand from smoke checks to a critical user-journey suite covering:
- vault open/create flow,
- note create/edit/save/reload,
- source/edit/view markdown round-trip (including Mermaid),
- graph/editor mode switching,
- unsaved-changes guard behavior.

**FR-2**: UI verification MUST include deterministic visual review artifacts for key states (screenshots and/or traces) suitable for human review.

**FR-3**: Tauri-native verification MUST include at least one automated runtime smoke flow beyond dependency preflight, focused on startup + basic interaction + clean shutdown.

**FR-4**: CI quality gates MUST define required checks for PR merge:
- `typecheck`,
- `lint`,
- unit/component tests,
- browser-lane Playwright suite.

**FR-5**: Native-runtime smoke verification MAY run on separate cadence (nightly or labeled workflow), but MUST be tracked with explicit pass/fail visibility.

**FR-6**: UI documentation MUST provide a human-reviewable state catalog with:
- key surfaces and states,
- expected interactions and outcomes,
- linked verification evidence (test names, screenshots, traces).

**FR-7**: Design-system extraction MUST be based on current implementation facts:
- token inventory from existing CSS variables,
- primitive component inventory,
- mapping from implemented screens to primitives.

**FR-8**: Design-system documentation MUST define usage contracts for primitives (variants, states, accessibility expectations, do/don't examples).

**FR-9**: This spec revision MUST remain framework-neutral for styling system choices and MUST NOT require migration to third-party UI kits.

## Non-Goals
- Full visual redesign of current UI.
- Forced migration to Tailwind or third-party component systems.
- Expanding protocol-attach R&D (kept deferred under `COMP-UI-AUTOMATION-DX-001`).

## Design Decisions
| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Prioritize journey-based browser E2E expansion first | Highest ROI for day-to-day regression detection | Native runtime edge cases still need separate coverage |
| Keep native lane narrow but automated | Preserves shell/runtime confidence without duplicating browser suite | Limited breadth on platform-specific behavior |
| Require human-reviewable artifact outputs | Improves design/UX review quality and auditability | More CI storage and artifact management |
| Derive design system from existing implementation | Low-risk path that preserves current product identity | Slower than greenfield system replacement |
| Defer framework migration decisions | Avoids churn while quality process is being stabilized | Some tooling conveniences postponed |

## Milestones
- **M0 Baseline Hardening**: lock CI gates and stabilize existing browser lane.
- **M1 Journey Coverage**: add critical Playwright user-journey scenarios.
- **M2 Native Automation**: add automated tauri smoke execution in CI cadence.
- **M3 Reviewability**: ship UI state catalog with linked artifacts.
- **M4 Systemization**: publish token + primitive inventory and usage contracts.

## Acceptance Criteria
- [x] Browser Playwright suite covers all FR-1 journeys.
- [x] Visual artifacts for key UI states are generated and reviewable.
- [x] At least one automated native runtime smoke test executes and reports status.
- [x] PR CI enforces required UI quality gates.
- [x] Human-reviewable UI state catalog exists and is kept current.
- [ ] Token and primitive inventories are documented from current implementation.
- [ ] Primitive usage contracts are documented and traceable to implemented components.
- [ ] No mandatory external UI framework migration is introduced.

## Verification Strategy (Future)
- Run expanded browser-lane Playwright suite and confirm deterministic pass rate.
- Validate CI gate behavior with failing and passing control cases.
- Run native smoke automation in scheduled or labeled CI.
- Review generated artifacts and state catalog for completeness and traceability.
- Verify token/primitive documentation against source files and implemented screens.

## Related
- Depends on: `COMP-UI-AUTOMATION-DX-001`
- Complements: `COMP-MERMAID-001`, `COMP-MERMAID-INLINE-SPLIT-001`
- Follow-up: planning and phased implementation are intentionally deferred.
