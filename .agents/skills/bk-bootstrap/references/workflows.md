# bk-* Workflow Examples

Detailed workflow examples showing how bk-* skills work together.

## Example 1: New Feature (Full Flow)

```bash
User: "I want to add caching to the provider system"

→ bk-explore
  "What kind of caching?"
  "API response caching, exact match keys"

→ bk-research --topic="Rust caching libraries"
  Analyzes: moka, cached, dashmap
  Recommends: moka

→ bk-design --feature="provider-cache" --scope=component
  Creates: docs/specs/component/provider-cache-001.md
  Defines: trait Cache, TTL support

→ bk-plan --spec=docs/specs/component/provider-cache-001.md
  Creates: 5 tasks with dependencies
  TS-001: Define Cache trait
  TS-002: Implement moka backend (depends on TS-001)
  TS-003: Add TTL support (depends on TS-002)
  TS-004: Add configuration (depends on TS-003)
  TS-005: Integration tests

→ bk-execute --plan=docs/plans/provider-cache-implementation.md --mode=sequential
  Creates worktree: ../provider-cache-impl/

  [Subagent 1] TS-001: Define Cache trait
    Output: trait Cache defined
    Commit: "Add Cache trait definition"

  [Subagent 2] TS-002: Implement moka backend
    Context: Previous subagent summary
    Output: MokaBackend implementation
    Commit: "Add moka backend implementation"

  [Subagent 3] TS-003: Add TTL support
    Output: TTL configuration and eviction
    Commit: "Add TTL support"

  [Subagents 4-5] ...

  All tasks complete in single worktree
  Linear commit history, no merge conflicts

→ bk-verify --scope=component/provider-cache
  Checks: SPEC-COMP-PROVIDER-CACHE-001
  Reports: 100% compliance

→ bk-finish-branch --worktree=../provider-cache-impl/
  Prepares PR from worktree

→ bk-ship --version=0.5.0
  Updates: CHANGELOG.md
  Generates: docs/releases/0.5.0/
```

## Example 2: Quick Fix

```bash
User: "Add a config option for max cache size"

→ bk-explore
  "Which component?" → "Cache component, max_size field"
  Clear enough, skip research/ideate

→ bk-plan --feature="cache-max-size" --approach=sequential
  Single task: Add max_size config option

→ bk-implement-rust --task=add-max-size-config
  Adds: max_size field to CacheConfig
  Adds: validation, tests

→ bk-verify-completion --scope=file --path=src/cache/config.rs
  Checks: Implementation correct

→ bk-finish-branch
  Commits, prepares PR
```

## Example 3: Complex Architecture Decision

```bash
User: "Should we use actors or CSP for the scheduler?"

→ bk-explore
  "What are the requirements?"
  "High concurrency, backpressure, fairness"

→ bk-research --topic="Rust concurrency patterns" --time=deep
  Analyzes: Actors (actix), CSP (crossbeam), async channels
  Trade-offs documented

→ bk-ideate --problem="scheduler concurrency" --approaches=3
  Approach 1: Actor model (actix)
  Approach 2: CSP with channels ← SELECTED
  Approach 3: Async with work-stealing
  Evaluation matrix with scoring

→ bk-design --feature="scheduler-csp" --scope=component
  Creates spec with CSP architecture
  Defines: Channel interfaces, worker pool

→ bk-plan --spec=scheduler-csp
  Decomposes into tasks:
  TS-001: Define Channel trait
  TS-002: Implement bounded channel
  TS-003: Implement worker pool (depends on TS-002)
  TS-004: Add backpressure (depends on TS-003)
  TS-005: Integration tests

→ bk-execute --plan=scheduler-csp-implementation.md --mode=sequential
  Sequential subagent execution:
  Each subagent gets targeted context only
  Worktree has 5 clean commits

→ bk-verify --scope=full
  Cross-component verification

→ bk-ship --version=0.6.0
```

## Example 4: Debugging Production Issue

```bash
User: "The scheduler is deadlocking under load"

→ bk-debug --symptom="deadlock under load" --component=scheduler
  Systematic debugging process
  Reproduces: Channel capacity issue
  Root cause: Circular dependency

→ bk-explore
  "How do we fix the circular wait?"
  Options: Timeout, ordering, restructuring

→ bk-design --feature="scheduler-deadlock-fix" --scope=component
  Modifies: Existing scheduler spec
  Adds: Timeout on channel recv
  Changes: Lock ordering

→ bk-implement-rust --scope=modify
  Implements: Timeout logic
  Adds: Deadlock regression test

→ bk-verify --scope=component/scheduler
  Checks: Fix resolves issue
  Checks: No regressions

→ bk-ship --version=0.5.1 --scope=patch
```

## Common Patterns

### Pattern: Sequential Implementation (Recommended)

```bash
bk-plan --approach=sequential
# Creates task sequence

bk-execute --mode=sequential
# Creates ONE worktree
# Dispatches subagents sequentially
# Linear history, no conflicts
```

### Pattern: Test-Driven Implementation

```bash
bk-design --feature="X" --scope=component
bk-plan --feature="X"

bk-tdd --spec=component/X
# Writes failing tests first
# Implements to pass tests
# Refactors
```

### Pattern: Research-Spike-Implement

```bash
bk-research --topic="X" --scope=quick
# Proves feasibility

bk-explore
# "Should we proceed?"

bk-ideate
# "How to integrate?"

bk-design → bk-plan → bk-implement-rust
```

## Anti-Patterns

### ❌ "Let me just start coding"

```bash
# WRONG
bk-explore → bk-implement-rust
# Skipped: research, design, plan

# RIGHT
bk-explore → bk-research → bk-design → bk-plan → bk-implement-rust
```

### ❌ "I'll rewrite the spec as I go"

```bash
# WRONG
bk-design → bk-plan → bk-implement-rust
# During implement: "Actually, let's change the approach"
# Result: Spec and code diverge

# RIGHT
bk-design → bk-plan → bk-implement-rust (follows plan)
# OR: If approach must change:
bk-design (update) → bk-verify (impact) → bk-plan (adjust) → bk-implement-rust
```

### ❌ "I'll verify at the end"

```bash
# WRONG
bk-plan → [many tasks] → bk-implement-rust (all) → bk-verify
# Result: May accumulate issues

# RIGHT
bk-plan → bk-implement-rust --task=T1 → bk-verify-completion
        → bk-implement-rust --task=T2 → bk-verify-completion
        → bk-verify --scope=full
```
