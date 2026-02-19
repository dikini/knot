# Execution Modes Reference

Detailed guidance on sequential vs parallel execution strategies.

## Mode Selection Decision Tree

```
Tasks have dependencies or share files?
├── YES → SEQUENTIAL (safer, recommended)
└── NO  → Are they TRULY independent?
          ├── YES → PARALLEL possible (but sequential still safer)
          └── NO  → SEQUENTIAL (required)
```

## Sequential Mode Detail

**How it works**:
1. Create ONE worktree
2. Spawn subagents one at a time
3. Each subagent:
   - Receives targeted prompt (task + previous work summary)
   - Implements the task
   - Commits
   - Passes summary to next subagent
4. Result: Linear git history, no merge conflicts

**Example flow**:
```
Worktree: ../cache-impl/

[Subagent 1] Task TS-001: Define Cache trait
  Context: "Create Cache trait with get/set methods per spec"
  Output: src/cache/mod.rs (trait definition)
  Commit: "Add Cache trait"
  Summary: "Cache trait defined in src/cache/mod.rs"

[Subagent 2] Task TS-002: Implement moka backend
  Context: "Implement MokaBackend struct. Cache trait from previous task."
  Previous: "Cache trait defined in src/cache/mod.rs"
  Output: src/cache/backend.rs (implementation)
  Commit: "Add MokaBackend implementation"
  Summary: "MokaBackend implements Cache, supports get/set"

[Subagent 3] Task TS-003: Add TTL support
  Context: "Add TTL configuration and expiration logic"
  Previous: "MokaBackend implements Cache, supports get/set"
  Output: src/cache/backend.rs (enhanced with TTL)
  Commit: "Add TTL support to cache"
  Summary: "Cache now supports TTL-based expiration"

Git history:
  abc1234 Add Cache trait
  def5678 Add MokaBackend implementation
  9ab0cde Add TTL support to cache
```

## Parallel Mode Detail

**How it works**:
1. Create MULTIPLE worktrees (one per task or track)
2. Spawn subagents simultaneously
3. Each subagent works in isolation
4. You must merge branches after completion

**Example flow**:
```
Worktree 1: ../feature-module-a/
Worktree 2: ../feature-module-b/
Worktree 3: ../feature-module-c/

[Subagent 1] Task TS-001 in ../feature-module-a/
  Context: "Implement module A logging"
  Output: crates/gadulka/src/module_a/logging.rs
  Commit: "Add logging to module A"

[Subagent 2] Task TS-002 in ../feature-module-b/ (parallel)
  Context: "Implement module B metrics"
  Output: crates/gadulka/src/module_b/metrics.rs
  Commit: "Add metrics to module B"

[Subagent 3] Task TS-003 in ../feature-module-c/ (parallel)
  Context: "Implement module C tracing"
  Output: crates/gadulka/src/module_c/tracing.rs
  Commit: "Add tracing to module C"

Integration required:
  cd $PROJECT_ROOT
  git merge feature/module-a
  git merge feature/module-b  # May conflict if Cargo.toml touched
  git merge feature/module-c
```

## Interactive Prompt (when mode not specified)

```
Execution mode not specified.

Plan: Cache Implementation
Tasks: 3
  TS-001: Define Cache trait
  TS-002: Implement moka backend (depends on TS-001)
  TS-003: Add TTL support (modifies TS-002 output)

Analysis:
  - Tasks have dependencies (TS-002 needs TS-001, TS-003 needs TS-002)
  - All touch src/cache/ module (file overlap likely)

Recommendation: SEQUENTIAL execution
  - One worktree
  - Tasks execute in order
  - Each subagent sees previous work
  - No merge conflicts
  - Linear git history

Options:
[1] SEQUENTIAL - One worktree, tasks in order (RECOMMENDED)
    Pros: No conflicts, simple history, safer
    Cons: Slower (tasks run one at a time)

[2] PARALLEL - Multiple worktrees simultaneously
    Pros: Faster (if truly independent)
    Cons: Manual merge required, conflict risk
    ⚠️  WARNING: Use only if tasks touch different files

[3] Review plan first - Exit and revise plan

Your choice (1/2/3): _
```

## Targeted Prompting

Instead of passing full plan (which can be 500+ lines), extract targeted prompts per task.

**Full plan** (not given to subagent):
```yaml
tasks:
  - id: TS-001
    title: Define Cache trait
    description: |
      Create a Cache trait with get/set methods.
      Should support generic key/value types.
      Must be async-compatible.
    acceptance:
      - Trait compiles
      - Has get and set methods
      - Works with String keys and values
    spec_refs: [SPEC-FR-1]
    concerns: [OBS]

  - id: TS-002
    title: Implement backend
    description: |
      Implement MokaBackend struct that implements Cache trait.
      Use moka crate for underlying storage.
      Support configurable capacity.
    acceptance:
      - MokaBackend implements Cache
      - Capacity limits enforced
      - All Cache trait tests pass
    spec_refs: [SPEC-FR-2]
    concerns: [CAP, PERF]
    depends_on: [TS-001]

  # ... (50 more lines of other tasks)
```

**Targeted prompt for TS-002** (given to subagent):
```
Task: Implement moka backend for Cache trait

Previous Work (TS-001):
  - Cache trait defined in src/cache/mod.rs
  - Trait has: async fn get(&self, key: &str) -> Option<String>
  - Trait has: async fn set(&self, key: String, value: String)

Your Task:
  - Create src/cache/backend.rs
  - Implement MokaBackend struct
  - Implement Cache trait for MokaBackend
  - Use moka crate for storage
  - Add capacity configuration

Acceptance Criteria:
  - MokaBackend implements Cache
  - Capacity limits enforced
  - Tests: test_backend_implements_cache, test_capacity_limit

Files to Create/Modify:
  - src/cache/backend.rs (new)
  - src/cache/mod.rs (add pub use backend::MokaBackend)
  - Cargo.toml (add moka dependency if needed)

Don't Worry About:
  - Other backends
  - Serialization
  - TTL support (next task)
  - Metrics (later)

Spec References: SPEC-FR-2
Concerns: CAP (capacity limits), PERF (O(1) operations)
```

**Benefits**:
- Subagent context: ~200 tokens vs 2,000+
- Focused scope reduces hallucination
- Clear boundaries prevent scope creep

## Error Handling Examples

### Task Failure (Sequential)
```
[Task 2/5] TS-002: Implement backend
  Subagent executed: bk-implement-rust --task=TS-002
  ❌ FAILED: cargo check failed (type mismatch)

Error: Expected Result<String, CacheError>, found Option<String>

Options:
  1. Fix and retry - Adjust implementation, re-run subagent for TS-002
  2. Revise task - Update plan if requirements were wrong
  3. Stop and debug - Investigate with bk-debug

Worktree preserved at: ../cache-impl/ (inspect state)

> Choosing option 1...
> Fixing type signature in backend.rs...
> Re-running subagent for TS-002...
```

### Task Failure (Parallel)
```
[All 3 subagents dispatched]
  Subagent 1 (TS-001): ✅ Completed (3 min)
  Subagent 2 (TS-002): ❌ Failed (test failure)
  Subagent 3 (TS-003): ✅ Completed (4 min)

Failed Tasks: TS-002
  Worktree: ../feature-work-2/
  Error: test_capacity_limit failed (assertion)
  Logs: <path to logs>

Options:
  1. Fix TS-002 - Debug in worktree, re-run
  2. Continue without TS-002 - Integrate TS-001 and TS-003
  3. Stop all - Don't integrate any work yet

> Choosing option 1...
> cd ../feature-work-2/
> bk-debug --symptom="test failure" --component=cache
```

### Verification Failure
```
[All tasks completed]
  TS-001 ✅
  TS-002 ✅
  TS-003 ✅

Running final verification: bk-verify --scope=component/cache
❌ VERIFICATION FAILED

Gaps:
  - SPEC-FR-2.3 not implemented (missing error handling)
  - Test coverage: 65% (requirement: 80%)

Options:
  1. Address gaps - Create additional tasks for missing work
  2. Accept gaps - Document as known limitations
  3. Revise spec - If requirements changed

Worktree: ../cache-impl/ (work preserved for fixes)
```

## Resume/Retry Semantics

### Resume from specific task
```bash
# Initial run failed at task 3
bk-execute --plan=cache-plan.md --mode=sequential
# ... tasks 1-2 complete, task 3 fails

# After fixing the issue
bk-execute --plan=cache-plan.md --mode=sequential --resume-from=TS-003
# Skips TS-001, TS-002 (already committed), runs TS-003 onward
```

### Retry failed tasks only
```bash
# Parallel run had 2 failures
bk-execute --plan=plan.md --mode=parallel
# ... TS-001 ✅, TS-002 ❌, TS-003 ✅, TS-004 ❌

bk-execute --plan=plan.md --mode=parallel --retry-failed
# Only re-runs TS-002 and TS-004 in their existing worktrees
```
