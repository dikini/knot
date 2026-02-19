# Traceability Markers Reference

Markers link implementation to specifications for bk-verify compliance checking.

## Marker Format

| Marker | Meaning | Location |
|--------|---------|----------|
| `// SPEC-FR-N: <desc>` | Implements functional requirement N | Near implementation |
| `// CONCERN-<ID>: <desc>` | Addresses cross-cutting concern | Near handling code |
| `// TASK-<ID>: <desc>` | Part of plan task | Module/file level |
| `// TEST-<ID>: <desc>` | Test case for requirement | Test functions |
| `// INTERFACE-<ID>: <desc>` | Implements interface spec | Trait/impl blocks |

## Usage Guidelines

### Keep Markers Concise
Reference, don't duplicate spec content:

**Good**:
```rust
// SPEC-FR-3: Max concurrent runs
if self.inflight.len() >= self.policy.max_parallel {
    return Err(ScheduleError::CapacityExceeded);
}
```

**Bad** (duplicates spec):
```rust
// SPEC-FR-3: The scheduler must enforce a maximum number of concurrent runs
// as defined by the policy's max_parallel setting. When this limit is reached,
// new schedule requests should be rejected with a CapacityExceeded error.
if self.inflight.len() >= self.policy.max_parallel {
    return Err(ScheduleError::CapacityExceeded);
}
```

### Marker Placement

**Module level**:
```rust
//! Cache implementation with TTL support
//!
//! TASK: CA-003
//! SPEC: COMP-CACHE-001

pub mod ttl;
pub mod backend;
```

**Function level**:
```rust
/// SPEC-FR-2.1: Set with TTL
/// CONCERN-PERF: O(1) insertion
pub fn set(&mut self, key: String, value: String, ttl: Duration) {
    // implementation
}
```

**Implementation blocks**:
```rust
// INTERFACE-CACHE-001: Cache trait implementation
impl Cache for MokaBackend {
    // SPEC-FR-1.1: Get operation
    fn get(&self, key: &str) -> Option<String> {
        self.inner.get(key)
    }

    // SPEC-FR-1.2: Set operation
    fn set(&self, key: String, value: String) {
        self.inner.insert(key, value);
    }
}
```

**Test functions**:
```rust
/// TEST-ACC-2: Expired items are evicted
/// SPEC-FR-2.2: TTL eviction
#[tokio::test]
async fn test_ttl_eviction() {
    let cache = Cache::new(CacheConfig {
        ttl: Duration::from_millis(10),
        ..Default::default()
    });

    cache.set("key", "value").await;
    sleep(Duration::from_millis(20)).await;

    assert_eq!(cache.get("key").await, None);
}
```

## Concern IDs

Common cross-cutting concerns from `docs/specs/concern-registry.yaml`:

- `REL` - Reliability (retries, circuit breakers, bounded ops)
- `SEC` - Security (auth, audit, validation)
- `OBS` - Observability (metrics, tracing, logging)
- `CAP` - Capacity (backpressure, limits, quotas)
- `CONS` - Consistency (ordering, timing, idempotency)
- `COMP` - Compatibility (versioning, migration)
- `CONF` - Configuration (validation, rollout)
- `PERF` - Performance (time/space complexity)

## Example: Full Annotated Implementation

```rust
//! Task scheduler implementation
//!
//! TASK: TS-003
//! SPEC: COMP-SCHEDULER-001

use crate::policy::Policy;
use crate::run::Run;

// INTERFACE-SCHEDULER-001: Scheduler trait
pub struct Scheduler {
    inflight: HashMap<RunId, Run>,
    policy: Policy,
}

impl Scheduler {
    /// SPEC-FR-1: Create scheduler with policy
    pub fn new(policy: Policy) -> Self {
        Self {
            inflight: HashMap::new(),
            policy,
        }
    }

    /// SPEC-FR-3: Schedule run with capacity check
    /// CONCERN-CAP-1: Backpressure on capacity limit
    pub async fn schedule(&self, run: Run) -> Result<RunId, ScheduleError> {
        // SPEC-FR-3.1: Check capacity before accepting
        if self.inflight.len() >= self.policy.max_parallel {
            return Err(ScheduleError::CapacityExceeded);
        }

        // SPEC-FR-3.2: Assign run ID
        let run_id = RunId::new();

        // SPEC-FR-3.3: Track in registry
        self.inflight.insert(run_id.clone(), run);

        Ok(run_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// TEST-ACC-1: Scheduler enforces max concurrent
    /// SPEC-FR-3: Max concurrent limit
    #[tokio::test]
    async fn test_max_concurrent_enforced() {
        let policy = Policy { max_parallel: 2 };
        let scheduler = Scheduler::new(policy);

        // Fill capacity
        let _ = scheduler.schedule(run1()).await;
        let _ = scheduler.schedule(run2()).await;

        // Third should fail
        assert!(matches!(
            scheduler.schedule(run3()).await,
            Err(ScheduleError::CapacityExceeded)
        ));
    }

    /// TEST-CONCERN-CAP-1: Backpressure prevents overload
    #[tokio::test]
    async fn test_backpressure_under_load() {
        // Test concurrent attempts beyond capacity
        let scheduler = Arc::new(Scheduler::new(Policy { max_parallel: 10 }));
        let results: Vec<_> = (0..100)
            .map(|_| {
                let s = scheduler.clone();
                tokio::spawn(async move { s.schedule(run()).await })
            })
            .collect();

        let outcomes: Vec<_> = join_all(results).await;
        let accepted = outcomes.iter().filter(|r| r.is_ok()).count();

        assert_eq!(accepted, 10); // Exactly capacity limit
    }
}
```

## Verification

Markers enable `bk-verify` to build a compliance matrix:

```
| Spec Requirement | Marker Found | Test Coverage | Status |
|------------------|--------------|---------------|--------|
| SPEC-FR-3        | scheduler.rs:34 | test_max_concurrent_enforced | ✅ Full |
| CONCERN-CAP-1    | scheduler.rs:36 | test_backpressure_under_load | ✅ Full |
```

## When to Mark

- **Every public API** → SPEC or INTERFACE marker
- **Every concern requirement** → CONCERN marker
- **Every acceptance criterion** → TEST marker in test function

## When NOT to Mark

- Private helper functions (unless implementing specific requirement)
- Obvious implementations (getters/setters without business logic)
- Derived/auto-generated code

## Exceptions

For intentionally omitted requirements:
```rust
// EXCEPTION-SPEC-FR-5: Caching disabled for MVP, deferred to v2
// See: docs/design/cache-deferral-decision.md
pub fn get(&self, key: &str) -> Result<String> {
    self.fetch_fresh(key)
}
```

## Placeholder Markers

When real spec/concern/task IDs don't exist yet, use placeholders instead of inventing IDs.

### Placeholder Types

| Placeholder | When to Use | Example |
|-------------|-------------|---------|
| `SPEC-PENDING` | Spec being written, implementation ahead of docs | `// SPEC-PENDING: Cache eviction policy` |
| `SPEC-PROTOTYPE` | Experimental feature, may not need spec | `// SPEC-PROTOTYPE: Alternative hash algorithm` |
| `SPEC-TBD` | Uncertain which spec covers this | `// SPEC-TBD: Timeout handling` |
| `CONCERN-PENDING` | Concern identified, not yet documented | `// CONCERN-PENDING: Lock contention on insert` |
| `CONCERN-PROTOTYPE` | Experimental, concern TBD | `// CONCERN-PROTOTYPE: Memory usage pattern` |
| `TASK-PENDING` | Task created but not in plan yet | `// TASK-PENDING: Refactor to use builder pattern` |
| `TEST-PENDING` | Test planned but not specified | `// TEST-PENDING: Edge case for empty cache` |

### Decision Flow

```
Need to add marker
├─ Real spec/concern/task exists?
│  ├─ YES, know the ID → Use it: SPEC-CACHE-001
│  └─ YES, but uncertain → Search docs/, then use real ID
└─ NO, doesn't exist yet
   ├─ Spec being written → SPEC-PENDING
   ├─ Experimental work → SPEC-PROTOTYPE
   └─ Uncertain category → SPEC-TBD
```

### Validation

Placeholders are validated by the guardrail script (Step 4.5):
- Real IDs must exist in docs/
- Placeholders must be from known set (see [marker-config.conf](marker-config.conf))
- Unknown IDs (hallucinations) are flagged as errors

### Cleanup

Before release, resolve or document all placeholders:
- `bk-verify` reports placeholder count
- Create missing specs or convert to real IDs
- Or explicitly accept placeholders as intentional
