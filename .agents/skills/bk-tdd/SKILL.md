---
name: bk-tdd
description: Test-driven development workflow. Write failing tests first, implement to pass, refactor. Integrates with bk-plan acceptance criteria.
triggers:
  - "tdd"
  - "test driven"
  - "write tests first"
  - "red green refactor"
---

# bk-tdd: Test-Driven Development

## Purpose
Implement features using TDD: Red (failing test) → Green (passing) → Refactor.

## When to Use
- Requirements are clear from `bk-plan`
- Acceptance criteria are well-defined
- You want confidence in implementation
- Regression prevention is important

## Inputs
```yaml
task_ref: string            # Required: Task ID
plan_path: path             # Required: Plan with acceptance criteria
scope: enum                 # Optional: new | modify (default: new)
```

## Workflow

### Phase 0: Validate Test Design
Before writing the test, verify it maps to an acceptance criterion from the plan:
- Read acceptance criterion
- Confirm test will verify the stated requirement
- Check for existing tests covering same ground

### Phase 1: Red (Failing Tests)
1. Write test that asserts expected behavior
2. Run: `cargo test <test_name>` → should FAIL with clear error
3. Commit: "Add failing test for <feature>"

**For external dependencies**: Use trait objects and mock implementations.

### Phase 2: Green (Minimum Implementation)
1. Write minimum code to pass test
2. Run: `cargo test <test_name>` → should PASS
3. Don't worry about elegance yet
4. Commit: "Make test pass for <feature>"

### Phase 3: Refactor
1. Improve code quality
2. Run: `cargo test` → all tests still PASS
3. Remove duplication
4. Commit: "Refactor <feature>"

### Phase 4: Verify Completion
Run `bk-verify-completion` to confirm spec compliance before moving to next task.

## Property-Based Testing

For invariants and edge cases, consider property-based tests alongside example-based TDD:
```rust
use proptest::prelude::*;

proptest! {
    #[test]
    fn cache_get_after_set(key in ".*", value in ".*") {
        let cache = Cache::new();
        cache.set(key.clone(), value.clone());
        prop_assert_eq!(cache.get(&key), Some(value));
    }
}
```

## Example

```
Task: "Implement cache get with TTL"

RED:
  #[test]
  fn test_cache_ttl_expires() {
      let cache = Cache::with_ttl(Duration::from_millis(10));
      cache.set("key", "value");
      sleep(Duration::from_millis(20));
      assert_eq!(cache.get("key"), None); // FAILS - not implemented
  }

GREEN:
  impl Cache {
      pub fn get(&self, key: &str) -> Option<String> {
          self.check_expired(key)?; // minimal impl
          self.inner.get(key)
      }
  }

REFACTOR:
  // Extract expiration logic
  // Better naming
  // Tests still pass
```

## Output
- Implementation that is tested
- Test coverage for acceptance criteria
- Clean commit history (red → green → refactor)

## Next Steps
- **bk-verify-completion**: After TDD cycle completes
- **bk-verify**: Ensure full spec compliance
- **bk-implement-rust**: Next task (if not using TDD for all)
