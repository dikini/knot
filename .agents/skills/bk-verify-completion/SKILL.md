---
name: bk-verify-completion
description: Pre-completion verification checklist. Run before claiming work is done, before commit, or before PR. Ensures quality gates are met.
triggers:
  - "verify completion"
  - "ready to commit"
  - "check before commit"
  - "am I done"
  - "pre-commit check"
---

# bk-verify-completion: Pre-Completion Verification

## Purpose
Run quality checks before claiming work is complete or committing.

**Scope**: Code quality and test coverage.
**For spec compliance**, use `bk-verify` after bk-verify-completion passes.

## When to Use
- Before committing code
- Before creating PR
- Before claiming task is done
- As a sanity check

## When NOT to Use
- Initial development (use `bk-implement-*`)
- Spec verification (use `bk-verify`)

## Inputs
```yaml
scope: enum                 # Required: file | module | crate | task
task_ref: string            # Optional: Task ID if verifying task
fast: bool                  # Optional: Skip slow checks (default: false)
auto_fix: bool              # Optional: Auto-fix formatting/clippy (default: false)
```

## Verification Checklist & Commands

### Code Quality
```bash
# Compile check
cargo check --all-targets

# Clippy (no warnings)
cargo clippy --all-targets -- -D warnings

# Format check
cargo fmt --check

# TODO/FIXME scan
rg "TODO|FIXME" --type rust
```

- [ ] Code compiles without warnings
- [ ] Clippy passes (or has explicit allows)
- [ ] Formatting correct
- [ ] No TODO/FIXME left (or documented)

### Tests
```bash
# Run all tests
cargo test

# Run with coverage (if tarpaulin installed)
cargo tarpaulin --out Stdout
```

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] New code has test coverage
- [ ] Doc tests pass

### Documentation
```bash
# Doc tests
cargo test --doc

# Doc build
cargo doc --no-deps
```

- [ ] Public API has rustdoc
- [ ] Complex logic has comments
- [ ] Examples compile

### Traceability (if using bk-* process)
```bash
# Check for markers
rg "SPEC-|CONCERN-|TASK-" --type rust
```

- [ ] Implementation markers present
- [ ] Tests link to acceptance criteria

### Git
```bash
# Commit check
git log --oneline -5

# Rebase check
git fetch origin && git status
```

- [ ] Commits are logical units
- [ ] Commit messages are clear
- [ ] Branch is up to date with base

## Auto-Fix Mode

If `auto_fix: true`, attempt to fix common issues:
```bash
# Auto-fix formatting
cargo fmt

# Auto-fix clippy lints (where possible)
cargo clippy --fix --allow-dirty
```

Then re-run verification.

## Workflow

1. **Run Checks** - Execute commands from checklist above
2. **Report Results**
   - ✅ All pass → "Ready to commit"
   - ⚠️ Warnings → List, suggest fixes
   - ❌ Failures → List, must fix
3. **Fix or Auto-Fix** - Address issues, re-run
4. **Verify Compliance** - Run `bk-verify` for spec compliance

## Example

```bash
bk-verify-completion --scope=module --task=TS-001

Pre-Completion Verification: TS-001
====================================

Code Quality:
  ✅ cargo check (0 warnings)
  ✅ cargo clippy (0 issues)
  ✅ cargo fmt --check (formatted)
  ⚠️  TODO found: "// TODO: optimize this" (src/cache.rs:45)

Tests:
  ✅ cargo test (5/5 unit, 2/2 integration)
  ✅ Coverage: 87%

Documentation:
  ✅ Public API documented
  ✅ cargo test --doc (examples compile)

Traceability:
  ✅ SPEC markers present
  ✅ Test links present

Git:
  ✅ Commits logical
  ⚠️  Branch 2 commits behind main

Summary: 2 warnings, 0 failures
Recommendation:
  1. Address TODO or add issue reference
  2. Rebase: git rebase origin/main

Next: bk-verify --scope=component/cache (spec compliance check)
```

## Output
- Checklist results with exact commands run
- Pass/warn/fail status
- Specific fix commands

## Next Steps
- Fix issues → Re-run verification
- All pass → `bk-verify` (spec compliance)
- Both pass → `git commit` or `bk-finish-branch`
