---
name: bk-implement-rust
description: Generate idiomatic Rust code from implementation plans with spec traceability. Creates modules, types, traits, functions, and tests following Rust best practices.
triggers:
  - "implement in rust"
  - "implement"
  - "write rust code"
  - "code this"
  - "build feature"
  - "rust implementation"
  - "write tests"
---

# bk-implement-rust: Rust Implementation with Traceability

## Purpose
Write idiomatic Rust code from implementation plans. Generates code, tests, and traceability markers for spec compliance.

## When to Use
- Implementing a task from `bk-plan`
- Writing new Rust modules/features
- Refactoring existing Rust code
- Building features from specs

## When NOT to Use
- Planning or design (use `bk-plan` or `bk-design` first)
- Other languages (create `bk-implement-<lang>` skill)
- High-level architecture decisions (use `bk-design`)

## Inputs
```yaml
task_ref: string            # Required: Task ID from plan (e.g., "TS-001")
plan_path: path             # Optional: Path to implementation plan
spec_path: path             # Optional: Spec to implement against
scope: enum                 # Optional: new | modify | refactor (default: new)
test_strategy: enum         # Optional: unit | integration | both (default: both)
```

## Workflow

### 1. Load Context
- Read plan/spec
- Extract task details, acceptance criteria
- Identify spec requirements (for markers)

### 2. Determine Structure

**Scope-appropriate structure**:
- **Small** (< 100 lines): Single file with inline tests
- **Medium** (100-300 lines): mod.rs + implementation file(s)
- **Large** (300+ lines): Full module (types, traits, impl, error, tests)

See: [references/code-templates.md](references/code-templates.md) for structure examples.

### 3. Generate Implementation

#### Key Principles (not templates)

**Rust idioms**:
- Use `thiserror` for custom errors, `anyhow` for application errors
- Derive: `Debug`, `Clone` for most types; add `PartialEq`, `Eq`, `Default` as needed
- Use `async-trait` for async trait methods
- Prefer `impl Trait` for return types over boxed traits when possible

**Error handling**:
- Use `Result<T, E>` consistently
- Use `?` operator for propagation
- Provide context with `.context()` (anyhow) or custom error variants

**Testing**:
- Unit tests in `#[cfg(test)] mod tests` or `tests.rs`
- Integration tests in `tests/` directory
- Property tests with `proptest` for invariants

**See references** for detailed patterns:
- [code-templates.md](references/code-templates.md) - Common structures
- [traceability-markers.md](references/traceability-markers.md) - Marker system

### 4. Add Traceability Markers

Link code to specs for `bk-verify` compliance checking.

#### Marker Decision Tree

When adding a marker, use this decision process:

1. **Is there a spec/concern/task for this?**
   - YES, I know the ID → Use real ID: `// SPEC-CACHE-001`
   - YES, but need to find it → Search docs/, then use real ID
   - NO, not yet → Use appropriate placeholder (see below)

2. **Which placeholder?**
   - Spec being written, implementation ahead → `// SPEC-PENDING: [description]`
   - Experimental/prototype feature → `// SPEC-PROTOTYPE: [description]`
   - Uncertain which spec covers this → `// SPEC-TBD: [description]`

See [references/traceability-markers.md](references/traceability-markers.md) for full format reference.

#### Marker Placement

- Module level: `TASK-<ID>` in doc comment
- Function/method: `SPEC-FR-N` or `CONCERN-<ID>` in doc or inline comment
- Test functions: `TEST-<ID>` in doc comment

**Example**:
```rust
//! Cache implementation
//! TASK: CA-003

/// SPEC-FR-2.1: Set with TTL
/// CONCERN-PERF: O(1) insertion
pub fn set(&mut self, key: String, value: String, ttl: Duration) {
    self.inner.insert(key, value, ttl);
}

/// TEST-ACC-2: Expired items evicted
#[test]
fn test_ttl_eviction() {
    // ...
}
```

See [traceability-markers.md](references/traceability-markers.md) for full marker reference.

### 4.5. Validate Markers (Guardrail)

After adding markers, run validation to catch issues:

```bash
.codex/skills/bk-implement-rust/scripts/validate-markers.sh $(git diff --name-only --cached)
```

**Review validation output:**
- ✅ Valid markers: Good to proceed
- ⚠️  Placeholders found: Expected for prototypes/pending specs
- ❌ Unknown markers: Hallucinated IDs - must fix

**If errors found:**
1. Review each flagged marker
2. Fix issues:
   - Search for correct spec ID in docs/specs/
   - If no spec exists, use placeholder (PENDING/PROTOTYPE/TBD)
   - Fix malformed markers
3. Re-run validation
4. Continue when passing or only warnings remain

**Escape hatch:** If placeholders are intentional (prototyping), acknowledge warnings and proceed.

### 5. Generate Tests

From acceptance criteria:
```rust
#[cfg(test)]
mod tests {
    use super::*;

    /// TEST-ACC-1: Cache returns None for missing keys
    /// SPEC-FR-1.1: Get operation
    #[test]
    fn test_missing_key_returns_none() {
        let cache = Cache::new();
        assert_eq!(cache.get("missing"), None);
    }

    /// TEST-ACC-2: Cache stores and retrieves
    /// SPEC-FR-1.2: Set and get operations
    #[test]
    fn test_store_retrieve() {
        let mut cache = Cache::new();
        cache.set("key", "value", Duration::from_secs(60));
        assert_eq!(cache.get("key"), Some("value"));
    }
}
```

### 6. Compilation Check

Before completing:
```bash
cargo check --all-targets  # Ensure it compiles
cargo clippy -- -D warnings  # Lint check
cargo test <test_name>  # Verify tests pass
```

If compilation fails, fix errors before marking task complete.

## Rust Patterns Applied

| Pattern | When Used |
|---------|-----------|
| Builder | Complex struct construction with optional fields |
| Type State | Enforce valid state transitions at compile time |
| Newtype | Wrap primitives for type safety (e.g., `UserId(u64)`) |
| Error enums | Structured error handling with `thiserror` |
| Async/await | I/O bound operations (network, file, database) |
| Channels | Communication between tasks/threads |
| RAII | Resource management (files, locks, connections) |
| Traits | Abstraction for polymorphism and testability |

See [code-templates.md](references/code-templates.md) for pattern examples.

## Example Session

```
User: Implement task CA-003 (cache TTL support)

bk-implement-rust:

1. Load context:
   - Task: CA-003 from docs/plans/cache-implementation.md
   - Spec: COMP-CACHE-001
   - Acceptance: TTL eviction, configurable per-cache

2. Structure (Medium scope):
   crates/gadulka/src/cache/
   ├── mod.rs (re-exports)
   ├── ttl.rs (TTL logic)
   └── tests.rs (unit tests)

3. Generate ttl.rs:
   //! TTL cache implementation
   //! TASK: CA-003
   //! SPEC: COMP-CACHE-001

   use std::time::Duration;

   #[derive(Debug, Clone)]
   pub struct TtlCache {
       // SPEC-FR-2: TTL support
       inner: moka::future::Cache<String, String>,
   }

   impl TtlCache {
       /// SPEC-FR-2.1: Create with TTL
       pub fn new(ttl: Duration, capacity: usize) -> Self {
           Self {
               inner: moka::future::Cache::builder()
                   .time_to_live(ttl)
                   .max_capacity(capacity as u64)
                   .build(),
           }
       }

       /// SPEC-FR-2.2: Auto-evict on access
       pub async fn get(&self, key: &str) -> Option<String> {
           // CONCERN-PERF: O(1) lookup with eviction
           self.inner.get(key).await
       }

       pub async fn set(&self, key: String, value: String) {
           self.inner.insert(key, value).await;
       }
   }

4. Generate tests.rs:
   #[cfg(test)]
   mod tests {
       use super::*;
       use tokio::time::sleep;

       /// TEST-ACC-2: Expired items evicted
       /// SPEC-FR-2.2: TTL eviction behavior
       #[tokio::test]
       async fn test_ttl_eviction() {
           let cache = TtlCache::new(Duration::from_millis(10), 100);

           cache.set("key", "value").await;
           assert_eq!(cache.get("key").await, Some("value".to_string()));

           sleep(Duration::from_millis(20)).await;
           assert_eq!(cache.get("key").await, None);
       }
   }

5. Verify:
   $ cargo check
   $ cargo test test_ttl_eviction
   ✅ Compiles, test passes
```

## Output
- Implementation code with traceability markers
- Test code with test markers
- Updated module structure
- Compilable, tested code ready for `bk-verify`

## Next Steps
- **bk-verify-completion**: Pre-commit checks
- **bk-verify**: Spec compliance audit
- **bk-finish-branch**: Complete and PR

## References

- [code-templates.md](references/code-templates.md) - Rust patterns and structures
- [traceability-markers.md](references/traceability-markers.md) - Full marker reference
