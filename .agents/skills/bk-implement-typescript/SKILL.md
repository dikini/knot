---
name: bk-implement-typescript
description: Generate idiomatic TypeScript code from implementation plans with spec traceability. Creates modules, types, interfaces, functions, and tests following TypeScript best practices.
triggers:
  - "implement in typescript"
  - "implement in ts"
  - "write typescript code"
  - "typescript implementation"
  - "build typescript feature"
  - "write ts tests"
---

# bk-implement-typescript: TypeScript Implementation with Traceability

## Purpose
Write idiomatic TypeScript code from implementation plans. Generates code, tests, and traceability markers for spec compliance.

## When to Use
- Implementing a task from `bk-plan`
- Writing new TypeScript modules/features
- Refactoring existing TypeScript code
- Building features from specs

## When NOT to Use
- Planning or design (use `bk-plan` or `bk-design` first)
- Other languages (use `bk-implement-rust` or create `bk-implement-<lang>` skill)
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
- **Small** (< 100 lines): Single file with co-located tests
- **Medium** (100-300 lines): index.ts + implementation file(s)
- **Large** (300+ lines): Full module (types/, utils/, services/, tests/)

See: [references/code-templates.md](references/code-templates.md) for structure examples.

### 3. Generate Implementation

#### Key Principles (not templates)

**TypeScript idioms**:
- Use explicit return types on public APIs
- Prefer `interface` over `type` for object shapes (extensibility)
- Use `readonly` for immutable properties
- Use `const` assertions for literal types
- Leverage discriminated unions for state machines

**Error handling**:
- Use custom error classes extending `Error`
- Return `Result<T, E>` pattern or throw for exceptional cases
- Provide context in error messages

**Testing**:
- Unit tests co-located or in `__tests__/` / `tests/` directories
- Use Vitest or Jest for test runner
- Mock external dependencies with `vi.fn()` or `jest.fn()`

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

- Module level: `TASK-<ID>` in file header comment
- Function/method: `SPEC-FR-N` or `CONCERN-<ID>` in JSDoc or inline comment
- Test functions: `TEST-<ID>` in JSDoc comment

**Example**:
```typescript
/**
 * Cache implementation
 * TASK: CA-003
 */

/**
 * SPEC-FR-2.1: Set with TTL
 * CONCERN-PERF: O(1) insertion
 */
public set(key: string, value: string, ttl: Duration): void {
    this.inner.insert(key, value, ttl);
}

/**
 * TEST-ACC-2: Expired items evicted
 */
test('ttl eviction', () => {
    // ...
});
```

See [traceability-markers.md](references/traceability-markers.md) for full marker reference.

### 4.5. Validate Markers (Guardrail)

After adding markers, review to catch issues:

**Check for**:
- ✅ Valid markers: Good to proceed
- ⚠️ Placeholders found: Expected for prototypes/pending specs
- ❌ Unknown markers: Hallucinated IDs - must fix

**If errors found**:
1. Review each flagged marker
2. Fix issues:
   - Search for correct spec ID in docs/specs/
   - If no spec exists, use placeholder (PENDING/PROTOTYPE/TBD)
   - Fix malformed markers
3. Continue when passing or only warnings remain

**Escape hatch:** If placeholders are intentional (prototyping), acknowledge warnings and proceed.

### 5. Generate Tests

From acceptance criteria:
```typescript
import { describe, test, expect } from 'vitest';
import { Cache } from './cache';

describe('Cache', () => {
    /**
     * TEST-ACC-1: Cache returns undefined for missing keys
     * SPEC-FR-1.1: Get operation
     */
    test('missing key returns undefined', () => {
        const cache = new Cache();
        expect(cache.get('missing')).toBeUndefined();
    });

    /**
     * TEST-ACC-2: Cache stores and retrieves
     * SPEC-FR-1.2: Set and get operations
     */
    test('store and retrieve', () => {
        const cache = new Cache();
        cache.set('key', 'value', 60000);
        expect(cache.get('key')).toBe('value');
    });
});
```

### 6. Compilation Check

Before completing:
```bash
npx tsc --noEmit              # Type check
npx eslint . --ext .ts        # Lint check
npx vitest run <test_name>    # Verify tests pass
```

If compilation fails, fix errors before marking task complete.

## TypeScript Patterns Applied

| Pattern | When Used |
|---------|-----------|
| Builder | Complex object construction with optional fields |
| Discriminated Unions | State machines, action types, error variants |
| Branded Types | Type-safe wrappers for primitives (e.g., `UserId`) |
| Custom Error Classes | Structured error handling with `instanceof` checks |
| Async/Await | I/O bound operations (network, file, database) |
| Strategy Pattern | Pluggable behaviors via interfaces |
| Repository Pattern | Data access abstraction |
| Factory Functions | Creating objects with complex initialization |

See [code-templates.md](references/code-templates.md) for pattern examples.

## Example Session

```
User: Implement task CA-003 (cache TTL support)

bk-implement-typescript:

1. Load context:
   - Task: CA-003 from docs/plans/cache-implementation.md
   - Spec: COMP-CACHE-001
   - Acceptance: TTL eviction, configurable per-cache

2. Structure (Medium scope):
   src/cache/
   ├── index.ts (re-exports)
   ├── ttl-cache.ts (TTL logic)
   └── ttl-cache.test.ts (unit tests)

3. Generate ttl-cache.ts:
   /**
    * TTL cache implementation
    * TASK: CA-003
    * SPEC: COMP-CACHE-001
    */

   export interface TtlCacheConfig {
       ttl: number;
       maxCapacity?: number;
   }

   export class TtlCache {
       // SPEC-FR-2: TTL support
       private inner: Map<string, CacheEntry>;

       /**
        * SPEC-FR-2.1: Create with TTL
        */
       constructor(private config: TtlCacheConfig) {
           this.inner = new Map();
       }

       /**
        * SPEC-FR-2.2: Auto-evict on access
        * CONCERN-PERF: O(1) lookup with eviction
        */
       get(key: string): string | undefined {
           const entry = this.inner.get(key);
           if (entry && Date.now() > entry.expiresAt) {
               this.inner.delete(key);
               return undefined;
           }
           return entry?.value;
       }

       set(key: string, value: string): void {
           const expiresAt = Date.now() + this.config.ttl;
           this.inner.set(key, { value, expiresAt });
       }
   }

4. Generate ttl-cache.test.ts:
   import { describe, test, expect } from 'vitest';
   import { TtlCache } from './ttl-cache';

   describe('TtlCache', () => {
       /**
        * TEST-ACC-2: Expired items evicted
        * SPEC-FR-2.2: TTL eviction behavior
        */
       test('ttl eviction', async () => {
           const cache = new TtlCache({ ttl: 10 });

           cache.set('key', 'value');
           expect(cache.get('key')).toBe('value');

           await sleep(20);
           expect(cache.get('key')).toBeUndefined();
       });
   });

5. Verify:
   $ npx tsc --noEmit
   $ npx vitest run test_ttl_eviction
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

- [code-templates.md](references/code-templates.md) - TypeScript patterns and structures
- [traceability-markers.md](references/traceability-markers.md) - Full marker reference
