# Storybook DX Integration for UI Documentation and QA

## Metadata
- ID: `COMP-STORYBOOK-DX-001`
- Scope: `component`
- Status: `in progress`
- Parent: `COMP-UI-QA-DX-001`, `COMP-UI-AUTOMATION-DX-001`, `COMP-TOOLCHAIN-001`
- Concerns: `[CONF, REL, COMP, CAP]`
- Trace: `DESIGN-storybook-dx-001`
- Created: `2026-02-22`
- Updated: `2026-02-22`

## Purpose
Define how Knot adopts Storybook as a human- and agent-reviewable UI documentation and verification surface, with explicit DevOps automation and MCP integration expectations.

## Contract

### Functional Requirements
**FR-1**: The project MUST introduce a Storybook workspace for frontend UI components using the current Vite + React stack.

**FR-2**: Storybook setup MUST be automatable by an agent end-to-end (scaffold, scripts, baseline stories, verification commands) with no manual hand-edits required for bootstrap.

**FR-3**: DevOps documentation MUST define reproducible installation and execution procedures for:
- local setup,
- CI build/test,
- static Storybook artifact generation.

**FR-4**: Storybook MUST include baseline stories for core primitives and shell surfaces already present in implementation (for example: `IconButton`, tool rail/context panel patterns, editor mode controls, sidebar states).

**FR-5**: Storybook documentation MUST include interaction/state examples and review notes so humans can evaluate behavior and UX intent without code archeology.

**FR-6**: The project MUST define MCP configuration for Storybook-aware agent workflows, including:
- MCP server/addon setup location,
- expected config file shape and ownership,
- minimal smoke command to validate MCP availability.

**FR-7**: Agent workflows MUST be able to discover and use Storybook metadata/artifacts for UI archaeology and documentation refresh tasks.

**FR-8**: The project MUST define whether existing `bk-*` skills are sufficient; if not, it MUST specify required new skill(s) or skill augmentations for consistent, current Storybook docs.

**FR-9**: Documentation freshness policy MUST be explicit: changes to UI primitives or behavior contracts MUST require synchronized story/doc updates.

**FR-10**: This spec revision MUST exclude Penpot and Penpot MCP adoption from scope.

## Non-Goals
- Penpot integration or Penpot MCP setup.
- Full design-system rewrite in this cycle.
- Storybook as a replacement for browser-lane or native-lane QA.

## DevOps and Automation Design
### Installation Procedure (Target)
1. Add Storybook dependencies and scaffold config (agent-runnable command path).
2. Add npm scripts:
- `storybook` (local dev server),
- `storybook:build` (static build),
- `storybook:test` (story-level checks if enabled),
- optional `storybook:smoke` (quick sanity check).
3. Add CI steps for static build + artifact upload.
4. Add short runbook for local/CI troubleshooting.

### Agent Automation Requirements
- One command path for bootstrap and one for verification.
- Deterministic outputs (generated files + scripts) suitable for commit review.
- No hidden manual prerequisites beyond documented toolchain.

## MCP Integration Design
### Configuration Requirements
- Define canonical MCP config path for Storybook integration.
- Define connector/addon ownership and update process.
- Provide verification command and expected success signal.

### Intended Agent Use Cases
- Query component/story inventory for UI archaeology.
- Locate story coverage gaps from changed components.
- Link story docs to spec IDs and acceptance criteria.
- Generate/update review evidence references from story artifacts.

## Skills and Process Design
### Candidate Skill Updates
- `bk-design`: require Storybook impact section for UI-facing specs.
- `bk-plan`: require task entries for story/docs updates where UI changes exist.
- `bk-verify`: require Storybook coverage/doc freshness checks when UI code is touched.

### Candidate New Supporting Skill
- `bk-storybook-docs` (optional): create/update stories, docs pages, and coverage matrix from changed components.

### Freshness Policy
- Any PR changing UI primitives/behavior contracts must update relevant stories/docs in the same change.
- Verification must fail when mandatory story coverage or docs sync is missing.

## Milestones
- **M0**: Storybook scaffold + scripts + local runbook.
- **M1**: Baseline stories for core implemented primitives/surfaces.
- **M2**: CI static build + artifact publication.
- **M3**: Storybook MCP configuration + agent smoke checks.
- **M4**: Skill/process updates enforcing documentation freshness.

## Acceptance Criteria
- [x] Storybook is scaffolded and runnable locally with documented commands.
- [x] Storybook setup can be performed by an agent using documented automation commands.
- [x] CI can build Storybook and publish reviewable artifacts.
- [x] Baseline stories exist for core current UI primitives/surfaces.
- [x] Story docs include interaction/state guidance for human reviewers.
- [x] Storybook MCP configuration is documented and smoke-verifiable.
- [x] Skill updates/new skill decisions are documented with enforcement points.
- [x] Documentation freshness policy is defined and enforceable.
- [x] Penpot remains explicitly out of scope in this spec revision.

## Verification Strategy (Future)
- Execute Storybook local and build commands.
- Validate CI artifact generation and review accessibility.
- Run MCP smoke checks and verify discoverability from agent workflows.
- Audit a sample UI PR for required story/doc synchronization.
- Verify skill workflow includes Storybook documentation gates where applicable.

## Related
- Depends on: `COMP-UI-QA-DX-001`
- Complements: `COMP-UI-AUTOMATION-DX-001`
- Follow-up: planning and implementation intentionally deferred.
