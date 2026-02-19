---
name: bk-finish-branch
description: Complete a development branch. Commit, verify, prepare PR, cleanup. Use when implementation is done and verified.
triggers:
  - "finish branch"
  - "complete work"
  - "prepare PR"
  - "wrap up"
  - "done with this"
---

# bk-finish-branch: Complete Development Branch

## Purpose
Cleanly finish feature work: commit, verify, prepare for merge, cleanup worktrees.

## When to Use
- Implementation is complete
- Tests pass (`bk-verify-completion` passed)
- Ready to create PR

## When NOT to Use
- Work isn't done yet (use `bk-implement-*`)
- Tests are failing (fix first)

## Inputs
```yaml
branch_name: string         # Optional: Branch to finish (default: current)
worktree_path: path         # Optional: If work was done in worktree
create_pr: bool             # Optional: Prepare PR description (default: true)
cleanup_worktree: bool      # Optional: Remove worktree after merge (default: false)
squash: bool                # Optional: Squash commits (default: false)
```

## Workflow

### 1. Final Verification
```bash
bk-verify-completion --scope=<module|crate>
```
Ensure all checks pass before proceeding.

### 2. Final Commit (if needed)
```bash
git add <files>
git commit -m "<descriptive message>"
```

### 3. Update from Base
```bash
git fetch origin
git rebase origin/main  # Or: git merge origin/main
```

**If conflicts**:
- Resolve preserving spec-compliant changes
- If complex, use `bk-debug --symptom="merge conflict"`
- Complete rebase: `git rebase --continue`

### 4. Push Branch
```bash
git push origin <branch-name>  # Or: git push -u origin <branch-name>
```

Wait for CI if configured. Fix if fails.

### 5. Prepare PR

Generate PR description linking to specs/tasks/verification:

```markdown
## Summary
<1-2 sentence overview>

## Implementation
- Spec: [COMP-CACHE-001](docs/specs/component/cache-001.md)
- Plan: [Cache Implementation](docs/plans/cache-implementation.md)
- Tasks: TS-001 through TS-005 (all complete)

## Changes
- Added: Cache trait with get/set/delete methods
- Added: MokaBackend implementation with TTL support
- Added: Memory limit enforcement
- Tests: 15 new tests, coverage 92%

## Verification
- `bk-verify-completion`: ✅ Passed
- `bk-verify --scope=component/cache`: ✅ 100% compliance
- Verification report: [link](docs/audit/cache-verification-2026-02-18.md)

## Testing
- Unit tests: All pass (15/15)
- Integration tests: All pass (3/3)
- Manual testing: Cache eviction under load

## Checklist
- [x] Tests pass
- [x] Spec compliance verified
- [x] Documentation updated
- [ ] Breaking changes: None
```

### 6. Worktree Workflow (if applicable)

If work was done in a worktree:
```bash
# From worktree directory
cd $PROJECT_ROOT  # Return to main workspace

# Merge branch
git merge <branch-name>

# Remove worktree
git worktree remove <worktree-path>

# Clean up branch (after PR merged)
git branch -d <branch-name>
```

### 7. Cleanup (optional)
```bash
# After PR is merged upstream
git worktree remove <worktree-path>  # If not done yet
git branch -d <branch-name>  # Delete local branch
git remote prune origin  # Clean stale remote branches
```

## Example

```bash
bk-finish-branch --worktree-path=../cache-impl/ --create-pr=true

Finishing Branch: feature/cache-implementation
===============================================

[From worktree: ../cache-impl/]

✅ bk-verify-completion passed
✅ No uncommitted changes
✅ Rebased on origin/main
✅ Pushed to origin/feature/cache-implementation
✅ CI: All checks passed

[Returning to main workspace]

✅ PR description generated

PR Ready:
  Title: Add caching support with TTL
  Branch: feature/cache-implementation
  Base: main
  Spec: COMP-CACHE-001
  Tasks: TS-001 to TS-005 (complete)
  Verification: 100% compliance

Next Steps:
1. Review PR description above
2. Create PR: gh pr create --title "..." --body "..."
3. After merge: bk-finish-branch --cleanup-worktree --worktree-path=../cache-impl/
```

## Output
- Push confirmation
- PR description (with spec/task/verification links)
- Cleanup status (if requested)

## Next Steps
- Create PR (manual or via `gh pr create`)
- Await review
- After merge: cleanup worktree, delete branch
- If releasing: `bk-ship`
