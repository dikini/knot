# Deferred DX Execution Plan

Change-Type: design-update
Trace: PLAN-deferred-dx-execution-001
Trace: DESIGN-deferred-dx-execution-001
Generated: `2026-02-22`

## Scope
Execution queue and phased plan for currently deferred DX specs:
- `COMP-MERMAID-INLINE-SPLIT-001`
- `COMP-UI-QA-DX-001`
- `COMP-STORYBOOK-DX-001`

## Dependency-Ordered Queue
1. **Q1** `mermaid-inline-split-001` (`COMP-MERMAID-INLINE-SPLIT-001`)
   - Depends on implemented `COMP-MERMAID-001` + editor modes
   - Unblocks stable behavioral contract for Mermaid insertion
2. **Q2** `ui-qa-dx-001` (`COMP-UI-QA-DX-001`)
   - Depends on stable Mermaid/editor behavior and existing automation lanes
   - Defines quality bars, review artifacts, and CI gate expectations
3. **Q3** `storybook-dx-001` (`COMP-STORYBOOK-DX-001`)
   - Depends on QA DX framework from Q2
   - Adds Storybook + MCP/process integrations for documentation/systemization

## Phase Plans

### Phase 1: Mermaid Inline Split Fix (Q1)
Goal: remove inline-mark fragmentation when inserting Mermaid blocks from edit mode.

Tasks:
1. Convert current reproducer assertions to expected non-splitting behavior.
2. Add focused editor insertion test for block-boundary normalization.
3. Implement insertion-position normalization in editor Mermaid insertion path.
4. Verify browser lane, unit tests, typecheck, lint.

Exit Criteria:
- Existing inline insertion reproducer passes with no split behavior.
- Mermaid insertion remains functional for standard cursor positions.

### Phase 2: UI QA DX Hardening (Q2)
Goal: raise automated + human-reviewable UI quality standards.

Tasks:
1. Expand browser journey suite per `COMP-UI-QA-DX-001`.
2. Define and enforce PR quality gates.
3. Add visual artifact runbook and evidence linkage.
4. Add minimal automated native-runtime smoke step in CI cadence.

Exit Criteria:
- Journey coverage + artifact policy + CI gate policy documented and enforced.

### Phase 3: Storybook DX (Q3)
Goal: establish Storybook-backed UI documentation and agent reviewability.

Tasks:
1. Scaffold Storybook with agent-runnable setup scripts.
2. Add baseline stories for current primitives/surfaces.
3. Add Storybook CI build + artifacts.
4. Define Storybook MCP config and smoke verification path.
5. Update skill/process docs for story/docs freshness enforcement.

Exit Criteria:
- Storybook and docs are runnable, reviewable, and process-integrated.

## Execution Status
- Current phase: **Completed**
- Completed: Phase 1, Phase 2, Phase 3
- In progress: none
