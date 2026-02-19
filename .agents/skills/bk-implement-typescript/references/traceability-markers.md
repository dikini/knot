# Traceability Markers Reference

Markers link implementation to specifications for `bk-verify` compliance checking.

## Marker Format

| Marker | Meaning | Location |
|--------|---------|----------|
| `// SPEC-FR-N: <desc>` | Implements functional requirement N | Near implementation |
| `// CONCERN-<ID>: <desc>` | Addresses cross-cutting concern | Near handling code |
| `// TASK-<ID>: <desc>` | Part of plan task | Module/file level |
| `// TEST-<ID>: <desc>` | Test case for requirement | Test functions |
| `// INTERFACE-<ID>: <desc>` | Implements interface spec | Interface/class definition |

## Usage Guidelines

### Keep Markers Concise
Reference, don't duplicate spec content:

**Good**:
```typescript
// SPEC-FR-3: Max concurrent runs
if (this.inflight.size >= this.policy.maxParallel) {
    throw new ScheduleError('CapacityExceeded');
}
```

**Bad** (duplicates spec):
```typescript
// SPEC-FR-3: The scheduler must enforce a maximum number of concurrent runs
// as defined by the policy's maxParallel setting. When this limit is reached,
// new schedule requests should be rejected with a CapacityExceeded error.
if (this.inflight.size >= this.policy.maxParallel) {
    throw new ScheduleError('CapacityExceeded');
}
```

### Marker Placement

**Module level**:
```typescript
/**
 * Cache implementation with TTL support
 *
 * TASK: CA-003
 * SPEC: COMP-CACHE-001
 */

export * from './ttl';
export * from './backend';
```

**Function level**:
```typescript
/**
 * SPEC-FR-2.1: Set with TTL
 * CONCERN-PERF: O(1) insertion
 */
public set(key: string, value: string, ttl: Duration): void {
    // implementation
}
```

**Implementation blocks**:
```typescript
/**
 * INTERFACE-CACHE-001: Cache interface implementation
 */
export class MokaBackend implements Cache {
    /**
     * SPEC-FR-1.1: Get operation
     */
    get(key: string): string | undefined {
        return this.inner.get(key);
    }

    /**
     * SPEC-FR-1.2: Set operation
     */
    set(key: string, value: string): void {
        this.inner.insert(key, value);
    }
}
```

**Test functions**:
```typescript
describe('Cache', () => {
    /**
     * TEST-ACC-2: Expired items are evicted
     * SPEC-FR-2.2: TTL eviction
     */
    test('ttl eviction', async () => {
        const cache = new Cache({ ttl: 10 });

        cache.set('key', 'value');
        expect(cache.get('key')).toBe('value');

        await sleep(20);
        expect(cache.get('key')).toBeUndefined();
    });
});
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

```typescript
/**
 * Task scheduler implementation
 *
 * TASK: TS-003
 * SPEC: COMP-SCHEDULER-001
 */

import type { Policy } from './policy';
import type { Run, RunId } from './run';

/**
 * INTERFACE-SCHEDULER-001: Scheduler interface
 */
export class Scheduler {
    private inflight = new Map<RunId, Run>();

    /**
     * SPEC-FR-1: Create scheduler with policy
     */
    constructor(private policy: Policy) {}

    /**
     * SPEC-FR-3: Schedule run with capacity check
     * CONCERN-CAP-1: Backpressure on capacity limit
     */
    async schedule(run: Run): Promise<RunId> {
        // SPEC-FR-3.1: Check capacity before accepting
        if (this.inflight.size >= this.policy.maxParallel) {
            throw new ScheduleError('CapacityExceeded');
        }

        // SPEC-FR-3.2: Assign run ID
        const runId = RunId.create();

        // SPEC-FR-3.3: Track in registry
        this.inflight.set(runId, run);

        return runId;
    }
}

import { describe, test, expect } from 'vitest';

describe('Scheduler', () => {
    /**
     * TEST-ACC-1: Scheduler enforces max concurrent
     * SPEC-FR-3: Max concurrent limit
     */
    test('max concurrent enforced', async () => {
        const policy: Policy = { maxParallel: 2 };
        const scheduler = new Scheduler(policy);

        // Fill capacity
        await scheduler.schedule(run1());
        await scheduler.schedule(run2());

        // Third should fail
        await expect(scheduler.schedule(run3())).rejects.toThrow('CapacityExceeded');
    });

    /**
     * TEST-CONCERN-CAP-1: Backpressure prevents overload
     */
    test('backpressure under load', async () => {
        const scheduler = new Scheduler({ maxParallel: 10 });
        const attempts = Array.from({ length: 100 }, () =>
            scheduler.schedule(run())
        );

        const results = await Promise.allSettled(attempts);
        const accepted = results.filter(r => r.status === 'fulfilled').length;

        expect(accepted).toBe(10); // Exactly capacity limit
    });
});
```

## Verification

Markers enable `bk-verify` to build a compliance matrix:

```
| Spec Requirement | Marker Found | Test Coverage | Status |
|------------------|--------------|---------------|--------|
| SPEC-FR-3        | scheduler.ts:34 | test_max_concurrent_enforced | ✅ Full |
| CONCERN-CAP-1    | scheduler.ts:36 | test_backpressure_under_load | ✅ Full |
```

## When to Mark

- **Every public API** → SPEC or INTERFACE marker
- **Every concern requirement** → CONCERN marker
- **Every acceptance criterion** → TEST marker in test function

## When NOT to Mark

- Private helper functions (unless implementing specific requirement)
- Obvious implementations (getters/setters without business logic)
- Auto-generated code
- Type definitions without logic

## Exceptions

For intentionally omitted requirements:
```typescript
/**
 * EXCEPTION-SPEC-FR-5: Caching disabled for MVP, deferred to v2
 * See: docs/design/cache-deferral-decision.md
 */
public get(key: string): string {
    return this.fetchFresh(key);
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

### Cleanup

Before release, resolve or document all placeholders:
- `bk-verify` reports placeholder count
- Create missing specs or convert to real IDs
- Or explicitly accept placeholders as intentional
