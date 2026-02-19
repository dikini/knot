---
name: bk-design
description: Architecture decisions, spec authoring, and cross-cutting concern integration. Use for new features, component design, or modifying architecture.
triggers:
  - "design a new"
  - "create spec for"
  - "architecture for"
  - "define interface"
  - "component design"
  - "update spec"
---

# bk-design: Architecture & Spec Authoring

## Purpose
Create specifications that serve as single source of truth for design, implementation, and verification.

## When to Use
- After `bk-explore` or `bk-ideate` clarifies direction
- Before `bk-plan` (specs drive plans)
- When formalizing architecture decisions
- When updating existing specs

## Inputs
```yaml
feature_name: string          # Required: Name of feature/component
scope: enum                   # Required: component | interface | concern | system
spec_path: path               # Optional: For updates, path to existing spec
parent_spec: path             # Optional: Inherit from existing spec
concerns: list[concern_id]    # Optional: Cross-cutting concerns [REL, SEC, OBS, ...]
description: string           # Required: 1-2 sentence purpose
```

## Workflow

### 1. Load Context

Read and cache:
- `docs/specs/system/spec-map.md` - System architecture map
- `docs/specs/concern-registry.yaml` - Cross-cutting concerns
- `parent_spec` if provided - Inheritance base

**If files don't exist** (new project):
Create minimal bootstraps:

**spec-map.md**:
```markdown
# System Architecture Map

## Components
- (none yet)

## Interfaces
- (none yet)

## Concerns
- See concern-registry.yaml
```

**concern-registry.yaml**:
```yaml
concerns:
  REL:
    name: Reliability
    requirements:
      - Bounded retries
      - Circuit breakers
  SEC:
    name: Security
    requirements:
      - Authentication
      - Authorization
  # ... (standard concerns)
```

### 2. Design Decisions (Interactive)

Prompt for:
- **Boundaries**: What is in/out of scope?
- **Interfaces**: What contracts does this expose?
- **Dependencies**: What does this depend on?
- **Concerns**: Which cross-cutting requirements apply?

### 3. Generate Spec

Template: See section below for full spec format.

Key sections:
- **Metadata**: ID, scope, status, concerns
- **Purpose**: Why this exists
- **Contract**: Functional requirements, interfaces, behavior
- **Design Decisions**: Choices made, rationale, trade-offs
- **Concern Mapping**: How concerns are addressed
- **Acceptance Criteria**: Verifiable outcomes

### 4. Iteration Support

Specs are living documents:
```bash
# Update existing spec
bk-design --spec-path=docs/specs/component/cache-001.md --update

# Adds:
## Revision History
- 2026-02-18: Added TTL configuration (discovered during implementation)
- 2026-02-15: Initial version
```

### 5. Design Review (Optional)

Before finalizing:
- Share spec with team/stakeholders
- Gather feedback on approach
- Revise based on input
- Mark status: `draft` → `review` → `approved`

## Spec Template

```markdown
# <Feature Name>

## Metadata
- ID: `<SCOPE>-<FEATURE>-<NNN>` (e.g., COMP-CACHE-001)
- Scope: `<component|interface|concern|system>`
- Status: `draft` (draft → review → approved → implemented)
- Parent: `<if inheriting>`
- Concerns: `[REL, CAP, OBS]`
- Created: `<date>`
- Updated: `<date>`

## Purpose
<1-2 sentence description of why this exists>

## Contract

### Functional Requirements
**FR-1**: <Requirement description>
**FR-2**: <Requirement description>

### Interface (if applicable)
```rust
pub trait Cache {
    fn get(&self, key: &str) -> Option<String>;
    fn set(&self, key: String, value: String);
}
```

### Behavior
**Given** <precondition>
**When** <action>
**Then** <outcome>

## Design Decisions
| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
| Use moka crate | Production-ready, TTL support | Adds dependency |
| In-memory only | Simpler, faster | Not persistent |

## Concern Mapping
| Concern | Requirement | Implementation Strategy |
|---------|-------------|------------------------|
| REL-001 | Bounded operations | O(1) get/set, capacity limits |
| CAP-001 | Backpressure | Reject writes when full |

## Acceptance Criteria
- [ ] Cache trait compiles
- [ ] Capacity limits enforced
- [ ] TTL eviction works
- [ ] Test coverage > 80%

## Verification Strategy
- Unit tests for all public methods
- Integration tests for TTL eviction
- bk-verify compliance check

## Related
- Depends on: []
- Used by: [COMP-PROVIDER-001]
```

## Concern Registry Reference

Common IDs (from `concern-registry.yaml`):
- `REL` - Reliability (retries, circuit breakers, bounded ops)
- `SEC` - Security (auth, audit, validation)
- `OBS` - Observability (metrics, tracing, logging)
- `CAP` - Capacity (backpressure, limits, quotas)
- `CONS` - Consistency (ordering, timing, idempotency)
- `COMP` - Compatibility (versioning, migration)
- `CONF` - Configuration (validation, rollout)

## Output

1. `docs/specs/<scope>/<feature-id>.md` - The specification
2. Updated `docs/specs/system/spec-map.md` (adds entry for new component/interface)
3. Updated `docs/specs/concern-registry.yaml` (if new concern defined)

## Example

```
User: Design a caching layer for the provider system

bk-design:

1. Context:
   - Loads spec-map.md → sees COMP-PROVIDER-001 exists
   - Loads concern-registry.yaml → REL, CAP, OBS available

2. Decisions:
   - Scope: component
   - Parent: COMP-PROVIDER-001 (inherits provider contracts)
   - Concerns: REL (bounded ops), CAP (limits), OBS (metrics)
   - Interface: Cache trait (get/set/delete)

3. Generates: docs/specs/component/cache-001.md
   - ID: COMP-CACHE-001
   - FR-1: Cache trait with get/set
   - FR-2: TTL support
   - FR-3: Capacity limits
   - Concern mapping:
     REL-001 → O(1) bounded operations
     CAP-001 → Reject when capacity exceeded
     OBS-001 → Cache hit/miss metrics

4. Updates spec-map.md:
   Adds: COMP-CACHE-001 under Components section
```

## Next Steps

- **bk-plan**: Convert spec to implementation plan
- **bk-design** (again): Iterate if implementation reveals gaps
- **bk-verify**: After implementation, check compliance

## Guardrails

- Keep specs < 150 lines (use parent specs for shared content)
- Reference concerns by ID, don't duplicate registry text
- Make acceptance criteria verifiable (testable, measurable)
- Update specs when implementation reveals new requirements
