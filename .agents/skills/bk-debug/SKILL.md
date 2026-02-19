---
name: bk-debug
description: Systematic debugging workflow. Investigate failures, identify root cause, propose fixes. Integrates with bk-design for fix specification.
triggers:
  - "debug"
  - "investigate failure"
  - "why is this failing"
  - "fix this bug"
  - "root cause"
---

# bk-debug: Systematic Debugging

## Purpose
Investigate failures systematically and identify root causes before fixing.

## When to Use
- Something is broken and you don't know why
- Production issues
- Test failures that don't make sense
- Intermittent failures

## When NOT to Use
- You already know the fix (just use `bk-implement-rust`)
- It's a known issue with documented solution

## Inputs
```yaml
symptom: string             # Required: What is failing
component: string           # Optional: Where the failure appears
reproduction: string        # Optional: Steps to reproduce
logs: path                  # Optional: Path to log files
```

## Debugging Tools (Rust)

### Compilation Errors
```bash
cargo check --all-targets
cargo build 2>&1 | head -50  # First 50 lines of errors
```

### Test Failures
```bash
cargo test <test_name> -- --nocapture  # Show println! output
RUST_BACKTRACE=1 cargo test <test_name>  # Stack traces
RUST_BACKTRACE=full cargo test <test_name>  # Full backtraces
```

### Runtime Debugging
```bash
RUST_LOG=debug cargo run  # Enable debug logging
RUST_LOG=trace,hyper=info cargo run  # Fine-grained control

# With debugger
rust-gdb target/debug/<binary>
rust-lldb target/debug/<binary>
```

### Performance Issues
```bash
cargo build --release
perf record target/release/<binary>
perf report
```

## Workflow

### Phase 1: Gather Information

1. **Understand the symptom**
   - What exactly is failing?
   - When does it fail? (always, intermittent, under load?)
   - Error message or panic output?

2. **Find reproduction**
   ```bash
   # Write a failing test
   cargo test <new_test_name>  # Should fail
   ```

3. **Collect evidence**
   ```bash
   # Recent changes
   git log --oneline -10
   git diff HEAD~5..HEAD  # Changes in last 5 commits

   # Logs (if applicable)
   tail -100 <log-file>

   # Stack traces
   RUST_BACKTRACE=1 cargo test <failing_test>
   ```

4. **Check compliance matrix** (if using bk-* process)
   ```bash
   bk-verify --scope=<component>
   # Look for "Missing" or "Untested" in the failing area
   ```

### Phase 2: Form Hypotheses

Common failure patterns:
- **Panic**: Logic error, unwrap on None/Err
- **Test failure**: Incorrect assertion, wrong test data
- **Compilation error**: Type mismatch, missing trait impl
- **Deadlock**: Lock ordering, circular dependency
- **Race condition**: Unsynchronized shared state
- **Resource exhaustion**: Memory leak, file handles
- **External dependency**: Network, filesystem, env vars

Use git to find suspects:
```bash
# What changed recently?
git blame <file>:<line>  # Who last touched this?
git log -p <file>  # File history with diffs
```

### Phase 3: Test Hypotheses

For each hypothesis, design a focused test:

**Hypothesis**: "Function panics on empty input"
```rust
#[test]
#[should_panic(expected = "empty")]
fn test_panics_on_empty() {
    function_under_test(vec![]);
}
```

**Hypothesis**: "Race condition in concurrent access"
```rust
#[test]
fn test_concurrent_access() {
    use std::sync::Arc;
    let shared = Arc::new(StructUnderTest::new());
    let handles: Vec<_> = (0..100)
        .map(|_| {
            let s = shared.clone();
            std::thread::spawn(move || s.method())
        })
        .collect();
    for h in handles { h.join().unwrap(); }
}
```

### Phase 4: Identify Root Cause

- Which hypothesis confirmed?
- Why did it happen?
- What is the minimal fix?

### Phase 5: Write Reproduction Test → Transition to Fix

```rust
// Before fixing, write test that reproduces the bug
#[test]
fn test_issue_<number>_<description>() {
    // Arrange: Set up the failing condition
    let input = ...;

    // Act: Trigger the bug
    let result = function(input);

    // Assert: What should happen (currently fails)
    assert_eq!(result, expected);
}
```

Then transition to fix:
- Simple fix → `bk-implement-rust` or `bk-tdd`
- Complex fix → `bk-design` (write spec for fix)

## Example

```
User: "The scheduler is deadlocking under load"

bk-debug:

1. Gather:
   Symptom: Deadlock under high concurrency
   Reproduction: cargo test test_scheduler_parallel -- --ignored
   Evidence:
     $ RUST_BACKTRACE=1 cargo test test_scheduler_parallel
     Thread 1: waiting at scheduler.rs:45 (Mutex::lock)
     Thread 2: waiting at scheduler.rs:67 (Mutex::lock)

2. Hypotheses:
   H1: Circular lock dependency
   H2: Thread pool exhaustion
   H3: Channel capacity exceeded

3. Test H1:
   $ git show HEAD:src/scheduler.rs | grep -A5 "lock()"
   Found: task A locks state, then locks queue
         task B locks queue, then locks state
   ✓ Confirmed: Lock ordering violation

4. Root Cause:
   - Circular dependency introduced in commit abc123
   - scheduler::submit() locks in wrong order

5. Reproduction test:
   #[test]
   fn test_no_deadlock_on_concurrent_submit() {
       let sched = Scheduler::new();
       let handles: Vec<_> = (0..100)
           .map(|_| {
               let s = sched.clone();
               thread::spawn(move || s.submit(task()))
           })
           .collect();
       for h in handles {
           h.join().expect("thread panicked - deadlock?");
       }
   }

6. Fix approach:
   → Simple fix: Consistent lock ordering
   → bk-implement-rust --task=fix-deadlock
```

## Output
- Root cause analysis
- Minimal reproduction test
- Proposed fix design
- Risk assessment

## Next Steps
- **bk-tdd**: Write failing test, implement fix
- **bk-implement-rust**: If fix is straightforward
- **bk-design**: If fix needs specification
- **bk-verify**: After fix, ensure no regression
