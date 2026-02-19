---
name: bk-plan
description: Convert specifications to implementation plans with task decomposition and dependency mapping. Use after spec is drafted and before implementation.
triggers:
  - "plan implementation"
  - "create workstream"
  - "decompose feature"
  - "task breakdown"
  - "implementation plan"
  - "write plan"
  - "create implementation plan"
  - "plan this out"
  - "detailed plan"
---

# bk-plan: Planning & Decomposition

## Purpose
Transform specifications into actionable, trackable implementation plans.

## When to Use
- After `bk-design` creates a spec
- Before `bk-execute` or implementation
- When you need to break down work into steps

## Inputs
```yaml
spec_path: path              # Required: Path to spec file
approach: enum               # Optional: sequential | parallel | milestone-driven
constraints: list            # Optional: ["max_parallel:3"]
```

## Workflow

### 1. Load Spec
Parse:
- Functional requirements → tasks
- Interface definitions → API tasks
- Acceptance criteria → test tasks
- Concern mappings → compliance tasks
- Dependencies → ordering constraints

### 2. Decompose into Tasks

Create tasks for:
- **Foundation**: Types, traits, basic structure
- **Core Logic**: Main implementation
- **Interfaces**: API implementation
- **Testing**: Unit, integration, property tests
- **Integration**: Wiring into system

Task format:
```yaml
id: <feature>-<NNN>
title: <actionable description>
spec_refs: [FR-1, FR-2]  # Links to spec requirements
concerns: [REL, SEC]      # Cross-cutting requirements
size: S | M | L           # T-shirt sizing (not hour estimates)
dependencies: [<task-id>]
acceptance: <verifiable outcome>
```

### 3. Size Tasks

Use T-shirt sizing instead of hour estimates:
- **S** (Small): Can complete in single session, < 100 lines
- **M** (Medium): 1-2 sessions, 100-300 lines
- **L** (Large): Multiple sessions, 300+ lines - consider breaking down

### 4. Sequence & Parallelize
- Order by dependencies
- Identify critical path
- Group parallelizable work
- Respect constraints

### 5. Generate Plan

**Human-readable**: `docs/plans/<feature>-implementation.md`
**Machine-readable**: `docs/plans/<feature>-tasks.yaml`

See below for format examples.

### 6. Update Roadmap

If `docs/planning/roadmap-index.md` exists, add entry:
```markdown
| <feature-id> | <scope> | planned | <owner> | [<deps>] | [<target-specs>] |
```

If roadmap doesn't exist, create with:
```markdown
# Roadmap Index

| Workstream | Scope | Status | Owner | Dependencies | Target Specs |
|------------|-------|--------|-------|--------------|--------------|
| <feature-id> | component | planned | - | [] | [SPEC-001] |
```

## Plan Format

### Human-Readable
```markdown
# Implementation Plan: <Feature Name>

## Metadata
- Spec: `<spec_path>`
- Generated: `<date>`
- Approach: `<approach>`

## Summary
- Total tasks: `<count>`
- Size: `<S-count> small, <M-count> medium, <L-count> large`
- Critical path: `<S/M/L>`

## Tasks

### Phase 1: Foundation
| ID | Task | Size | Depends | Spec Ref |
|----|------|------|---------|----------|
| TS-001 | Define types | S | - | FR-1 |
| TS-002 | Trait definition | S | TS-001 | IF-1 |

### Phase 2: Core
| ID | Task | Size | Depends | Concerns |
|----|------|------|---------|----------|
| TS-003 | Scheduler logic | M | TS-002 | REL, CAP |

## Dependency DAG
```
TS-001 → TS-002 → TS-003 → TS-005
              ↘ TS-004 ↗
```

## Concern Coverage
| Concern | Tasks | Verification |
|---------|-------|--------------|
| REL-001 | TS-003, TS-005 | Test: test_retry_bounds |
```

### Machine-Readable
```yaml
# docs/plans/<feature>-tasks.yaml
tasks:
  - id: TS-001
    title: "Define core types"
    status: planned
    size: S
    spec_refs: [FR-1]
    dependencies: []
    acceptance: "Types compile, basic tests pass"

  - id: TS-002
    title: "Implement trait"
    status: planned
    size: M
    spec_refs: [IF-1]
    dependencies: [TS-001]
    acceptance: "Trait compiles, doc tests pass"
```

## Plan Revision

If implementation reveals the plan needs updating:
```yaml
# In tasks.yaml, update task:
- id: TS-003
  status: blocked  # Was: planned
  notes: "Discovered dependency on external library, needs research"

# Add new task:
- id: TS-003a
  title: "Research library options"
  size: S
  dependencies: [TS-002]
  blocks: [TS-003]
```

Then re-sequence and notify (or re-run bk-plan on updated spec).

## Output
1. `docs/plans/<feature>-implementation.md` - Human-readable plan
2. `docs/plans/<feature>-tasks.yaml` - Machine-readable tasks
3. Updated `docs/planning/roadmap-index.md` (if exists, or created if needed)

## Example

```
User: Plan implementation for cache layer spec

bk-plan:
1. Loads: docs/specs/component/cache-001.md
2. Extracts:
   - FR-1: Cache trait (get, set, delete)
   - FR-2: TTL support
   - FR-3: Memory limits
   - REL-001: Bounded ops
   - CAP-001: Backpressure
3. Creates tasks:
   - CA-001: Define Cache trait (S)
   - CA-002: In-memory implementation (M)
   - CA-003: TTL eviction logic (M)
   - CA-004: Memory limit enforcement (M) [CAP]
   - CA-005: Retry wrapper (S) [REL]
   - CA-006: Integration tests (M)
4. Sequences:
   CA-001 → CA-002 → [CA-003, CA-004, CA-005] → CA-006
5. Generates:
   - docs/plans/cache-layer-implementation.md
   - docs/plans/cache-layer-tasks.yaml
6. Updates: docs/planning/roadmap-index.md
```

## Next Steps
- **bk-execute**: Execute the plan
- **bk-implement-rust**: Manual implementation (one task at a time)
- **bk-design**: Refine spec if tasks unclear

## Guardrails
- Break down L tasks further if possible (aim for S/M)
- Every task must link to spec requirement
- Every task must have acceptance criteria
- Respect concern requirements in task breakdown
