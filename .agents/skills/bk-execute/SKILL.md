---
name: bk-execute
description: Execute implementation plans or tasks using subagents in worktrees. Supports sequential (one worktree, tasks in order) or parallel (multiple worktrees, independent tasks) execution.
triggers:
  - "execute plan"
  - "run plan"
  - "implement plan"
  - "start plan"
  - "run tasks"
  - "dispatch subagent"
  - "execute tasks"
---

# bk-execute: Plan and Task Execution via Subagents

## Purpose
Execute implementation work using subagents in isolated worktrees. Manages context, sequencing, and verification.

## Key Principle

**All implementation goes through subagents in worktrees** - never implement directly in main workspace.

**Modes**:
- **Sequential** (default, recommended): One worktree, tasks in order, no conflicts
- **Parallel** (use cautiously): Multiple worktrees for truly independent tasks

## When to Use
- Executing a plan from `bk-plan`
- Delegating tasks to subagents
- Implementing features in isolation

## Inputs

### From plan
```yaml
plan_path: path             # Required if executing plan
mode: enum                  # Optional: sequential | parallel (prompts if not specified)
stop_on_failure: bool       # Optional: Halt on first failure (default: true)
verify_each: bool           # Optional: Verify after each task (default: true)
worktree_base: string       # Optional: Worktree name (default: plan name)
auto_confirm: bool          # Optional: Skip prompts (default: false)
```

### Direct task delegation
```yaml
tasks: list[task_id]        # Required: List of task IDs
plan_path: path             # Required: Path to plan with task definitions
mode: enum                  # Optional: sequential | parallel
worktree_base: string       # Optional: Base name for worktree(s)
```

### Parameter Details

**stop_on_failure**:
- `true` (default): Stop at first failure, preserve worktree for debugging
- `false`: Continue through failures, report all at end

**verify_each**:
- `true` (default): Run `bk-verify-completion` after each task
- `false`: Verify only at end (faster, riskier)

**auto_confirm**:
- `false` (default): Interactive mode selection and confirmations
- `true`: Use recommended mode (sequential) without prompting

## Workflow

### Phase 1: Load Plan
- Parse plan file
- Extract tasks, dependencies
- Analyze for mode recommendation

### Phase 2: Determine Mode

**If mode specified** (`--mode=sequential` or `--mode=parallel`):
- Use specified mode, skip prompt

**If mode NOT specified**:
- Analyze tasks (dependencies, file overlap)
- Make recommendation
- **Prompt user for choice** (unless `auto_confirm=true`)

See [references/execution-modes.md](references/execution-modes.md) for detailed prompt format.

### Phase 3: Create Worktree(s)

**Sequential**:
```bash
bk-worktree --feature=<worktree-base>
# Creates: ../<worktree-base>/
```

**Parallel**:
```bash
# One worktree per task (or per independent track)
git worktree add ../<worktree-base>-1/ -b <branch>-1
git worktree add ../<worktree-base>-2/ -b <branch>-2
# ...
```

### Phase 4: Execute via Subagents

**Sequential**:
```
For each task in order:
  1. Generate targeted prompt (see Targeted Prompting section)
  2. Spawn subagent in worktree
  3. Subagent: bk-implement-rust → bk-verify-completion → commit
  4. Pass summary to next subagent
  5. If failure and stop_on_failure=true: halt, preserve state
```

**Parallel**:
```
For each task:
  1. Spawn subagent in dedicated worktree
  2. Subagents work simultaneously
Wait for all, then:
  3. Report completion status
  4. Manual merge required
```

### Phase 5: Verify

**Sequential**:
```bash
bk-verify --scope=<feature>  # Single verification
```

**Parallel**:
```bash
# After manual merge:
bk-verify --scope=full
```

## Targeted Prompting

Extract minimal context for each subagent instead of passing full plan.

**Structure**:
```
Task: <title>

Previous Work (if sequential):
  - Task <prev-id>: <summary from previous subagent>

Your Task:
  - <specific requirements>
  - <files to touch>

Acceptance Criteria:
  - <criterion 1>
  - <criterion 2>

Don't Worry About:
  - <out of scope items>

Spec References: <spec-ids>
Concerns: <concern-ids>
```

**Benefit**: Subagent sees ~200 tokens vs full plan (~2,000+ tokens). Reduces context overhead and improves focus.

See [references/execution-modes.md](references/execution-modes.md) for detailed examples.

## Execution Modes Compared

| Aspect | Sequential | Parallel |
|--------|------------|----------|
| Worktrees | 1 | Multiple |
| Conflicts | None (linear history) | Risk (manual merge) |
| Speed | Slower (one at a time) | Faster (concurrent) |
| Context | Previous task summary | Full isolation |
| Recommend | Default, safe | Only for independent tasks |

## When is Parallel Safe?

Use this checklist before choosing parallel mode:

### ✅ Safe for Parallel (Independent Tasks)
- **Different crates**: `crates/gadulka/` vs `crates/botkestra/`
- **Different modules**: `src/cache/` vs `src/scheduler/`
- **Different files entirely**: No overlap in touched files
- **No shared dependencies**: Tasks don't both modify `Cargo.toml` dependencies
- **Example**: Add logging to module A, metrics to module B, tracing to module C

### ❌ Unsafe for Parallel (Dependent/Overlapping)
- **Same files**: Both tasks modify `src/cache/backend.rs`
- **Sequential dependencies**: Task B needs Task A's output
- **Shared configs**: Both modify `Cargo.toml`, `config.toml`
- **Build-up pattern**: Task 2 extends Task 1's work
- **Example**: Define trait (Task 1), implement trait (Task 2), add methods (Task 3)

### Decision Heuristic
```
Do tasks touch the same files?
├── YES → SEQUENTIAL (will conflict)
└── NO → Check: Does Task B need Task A's code?
          ├── YES → SEQUENTIAL (dependency)
          └── NO → PARALLEL possible (but sequential still safer)
```

**When in doubt, use sequential.** The time saved with parallel is rarely worth the merge conflict risk.

## Error Handling

### Task Failure
```
[Task 3/5] TS-003: Add TTL support
  → Subagent executed
  ❌ FAILED: Test test_ttl_expiration failed

Worktree preserved: ../cache-impl/

Options:
  1. Fix and retry
  2. Skip and continue (if stop_on_failure=false)
  3. Debug with bk-debug
```

### Verification Failure
```
[All tasks completed]
→ Running bk-verify --scope=component/cache
❌ VERIFICATION FAILED

Gaps:
  - SPEC-FR-2.3 not implemented
  - Test coverage: 65% (requirement: 80%)

Action: Address gaps or document as known limitations
```

## Example: Sequential Execution

```bash
bk-execute --plan=docs/plans/cache-implementation.md --mode=sequential

[Analyzing plan]
  Tasks: 5
  Dependencies: TS-002→TS-001, TS-003→TS-002
  Recommendation: SEQUENTIAL (dependencies exist)

[Creating worktree]
  Location: ../cache-impl/
  Branch: feature/cache-impl

[Executing tasks sequentially]
  [Task 1/5] TS-001: Define Cache trait
    Subagent: bk-implement-rust --task=TS-001
    ✅ Complete (2 min)
    Commit: abc1234 "Add Cache trait"
    Summary: "Cache trait defined in src/cache/mod.rs"

  [Task 2/5] TS-002: Implement backend
    Context: Previous task summary
    Subagent: bk-implement-rust --task=TS-002
    ✅ Complete (5 min)
    Commit: def5678 "Add MokaBackend implementation"
    Summary: "MokaBackend implements Cache trait"

  [Task 3/5] TS-003: Add TTL support
    Context: Previous task summary
    Subagent: bk-implement-rust --task=TS-003
    ✅ Complete (4 min)
    Commit: 9ab0cde "Add TTL support"
    Summary: "Cache supports TTL-based expiration"

  ... (tasks 4-5)

[Verifying]
  → bk-verify --scope=component/cache
  ✅ All acceptance criteria met
  ✅ Spec compliance: 100%

[Complete]
  Worktree: ../cache-impl/
  Commits: 5
  Status: Ready for PR

Next: bk-finish-branch --worktree=../cache-impl/
```

## Example: Parallel Execution

```bash
bk-execute --plan=docs/plans/multi-module.md --mode=parallel

⚠️  PARALLEL MODE
⚠️  Ensure tasks are independent. Manual merge required.

[Creating worktrees]
  ../multi-work-1/ (TS-001: Module A)
  ../multi-work-2/ (TS-002: Module B)
  ../multi-work-3/ (TS-003: Module C)

[Dispatching subagents in parallel]
  Subagent 1 → TS-001 in ../multi-work-1/
  Subagent 2 → TS-002 in ../multi-work-2/
  Subagent 3 → TS-003 in ../multi-work-3/

[Waiting for completion]
  Subagent 1: ✅ (3 min)
  Subagent 2: ✅ (5 min)
  Subagent 3: ✅ (4 min)

[Integration required]
  Manual merge:
    cd $PROJECT_ROOT
    git merge feature/multi-work-1
    git merge feature/multi-work-2
    git merge feature/multi-work-3

  Then: bk-verify --scope=full
```

## Output

- Worktree location(s)
- Task completion status
- Verification report
- Next steps

## Anti-Patterns

❌ Execute in main workspace (bypassing worktree isolation)
❌ Parallel mode for dependent tasks (causes merge conflicts)
❌ Passing full plan context to each subagent (context bloat)

## Next Steps

**Sequential**:
- `bk-finish-branch` → PR

**Parallel**:
- Manual merge → `bk-verify` → `bk-finish-branch`

## References

- [execution-modes.md](references/execution-modes.md) - Detailed mode comparison, examples, error handling
