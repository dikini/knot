---
name: bk-worktree
description: Create and manage isolated git worktrees for parallel development. Use when starting feature work that needs isolation from current workspace.
triggers:
  - "create worktree"
  - "isolated workspace"
  - "parallel work"
  - "new worktree"
---

# bk-worktree: Isolated Development Workspaces

## Purpose
Create isolated git worktrees for feature development, keeping main workspace clean.

## When to Use
- Starting feature work that needs isolation
- Working on multiple features simultaneously
- Long-running experiments
- Avoiding conflicts with current work

## Inputs
```yaml
feature_name: string        # Required: Name of feature/branch
task_ref: string            # Optional: Task ID from plan
base_branch: string         # Optional: Branch to base from (default: main)
```

## Naming Convention

Standard pattern: `../<feature-name>/` and branch `feature/<feature-name>`

Examples:
- Feature: `cache-impl` → Directory: `../cache-impl/`, Branch: `feature/cache-impl`
- Bugfix: `fix-timeout` → Directory: `../fix-timeout/`, Branch: `fix/timeout`

## Workflow

### 1. Create Worktree Directory
```bash
git worktree add ../<feature-name> -b feature/<feature-name>
```

**Error handling**:
- **Branch exists**: `git worktree add ../<feature-name> <existing-branch>`
- **Disk full**: Clean stale worktrees first (see Cleanup section)
- **Path exists**: Choose different `<feature-name>` or remove existing directory

### 2. Initialize Environment

Copy/link configuration files:
```bash
cd ../<feature-name>/

# Link cargo config (if not in repo)
ln -s ../botkestra/.cargo .cargo

# Copy .env if needed
cp ../botkestra/.env.example .env
```

Files typically shared:
- `.cargo/config.toml` (build settings)
- `.env` (environment vars - don't commit secrets!)
- IDE workspace settings (optional)

### 3. Record Context

Create a note file for reference:
```bash
echo "Task: $task_ref" > .worktree-context
echo "Plan: docs/plans/<feature>-implementation.md" >> .worktree-context
```

## Output
- New worktree at `../<feature-name>/`
- New branch `feature/<feature-name>`
- Environment configured
- Clean slate for `bk-implement-*`

## Example

```bash
bk-worktree --feature="cache-implementation" --task=TS-001

# Creates:
# - Directory: ../cache-implementation/
# - Branch: feature/cache-implementation
# - Links: .cargo/, copies .env
# - Context: .worktree-context with task ref
```

## Cleanup / Teardown

### 1. Return to Main Worktree
```bash
cd $PROJECT_ROOT  # Back to main repo
```

### 2. Remove Worktree (when work is merged/abandoned)
```bash
# Remove worktree
git worktree remove ../<feature-name>/

# If worktree has uncommitted changes:
git worktree remove --force ../<feature-name>/

# Clean up branch if merged
git branch -d feature/<feature-name>  # Fails if not merged (safe)
git branch -D feature/<feature-name>  # Force delete (if abandoned)
```

### 3. List Active Worktrees
```bash
git worktree list
```

### 4. Prune Stale Entries
```bash
# Remove worktree entries for directories that no longer exist
git worktree prune
```

### When NOT to Clean Up

Keep worktree if:
- Work is in progress
- Waiting for code review
- Need to reference implementation later
- Multiple related PRs in flight

### Stale Worktree Detection

```bash
# Find worktrees older than 30 days (adjust path pattern for your project)
find .. -maxdepth 1 -type d -name "*impl*" -o -name "*fix*" -mtime +30
```

## Next Steps
- **bk-execute** or **bk-implement-rust**: Start implementation in worktree
- **bk-plan**: Continue planning in isolated space
- **bk-finish-branch**: When done, helps with cleanup
