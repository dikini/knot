# TypeScript Code Templates

Reference templates for common TypeScript patterns. See main SKILL.md for principles.

## Module Structure

### Small Task (single file)
```typescript
/**
 * <Module description>
 * TASK: <ID>
 */

export interface FeatureConfig {
    required: string;
    optional?: number;
}

export class Feature {
    constructor(private config: FeatureConfig) {}

    public method(): Result<T, Error> { ... }
}

// Co-located tests
if (import.meta.vitest) {
    const { describe, test, expect } = import.meta.vitest;
    describe('Feature', () => {
        test('functionality', () => { ... });
    });
}
```

### Medium Task (index.ts + impl)
```
index.ts       - Public API, re-exports
types.ts       - Interface/type definitions
feature.ts     - Implementation
feature.test.ts - Unit tests
```

### Large Task (full module)
```
index.ts       - Public API
types/         - Domain types
  ├── index.ts
  ├── user.ts
  └── order.ts
services/      - Business logic
  ├── cache-service.ts
  └── api-client.ts
utils/         - Helper functions
errors.ts      - Error classes
tests/         - Unit/integration tests
```

## Error Handling

### Custom Error Classes
```typescript
export class CacheError extends Error {
    constructor(
        message: string,
        public readonly code: CacheErrorCode,
        public readonly key?: string
    ) {
        super(message);
        this.name = 'CacheError';
    }
}

export enum CacheErrorCode {
    KEY_NOT_FOUND = 'KEY_NOT_FOUND',
    CAPACITY_EXCEEDED = 'CAPACITY_EXCEEDED',
    TTL_INVALID = 'TTL_INVALID',
}

// Usage
throw new CacheError(
    `Key not found: ${key}`,
    CacheErrorCode.KEY_NOT_FOUND,
    key
);
```

### Result Type Pattern
```typescript
export type Result<T, E = Error> =
    | { ok: true; value: T }
    | { ok: false; error: E };

export const Ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const Err = <E>(error: E): Result<never, E> => ({ ok: false, error });

// Usage
function parseConfig(input: string): Result<Config, ConfigError> {
    try {
        const parsed = JSON.parse(input);
        return Ok(parsed);
    } catch (e) {
        return Err(new ConfigError('Invalid JSON'));
    }
}
```

## Async Patterns

### Async/Await
```typescript
export interface Cache {
    get(key: string): Promise<string | undefined>;
    set(key: string, value: string): Promise<void>;
}

export class RedisCache implements Cache {
    async get(key: string): Promise<string | undefined> {
        const value = await this.client.get(key);
        return value ?? undefined;
    }

    async set(key: string, value: string): Promise<void> {
        await this.client.set(key, value);
    }
}
```

### Async with AbortSignal
```typescript
export async function fetchWithTimeout(
    url: string,
    options: { timeout?: number; signal?: AbortSignal } = {}
): Promise<Response> {
    const { timeout = 5000, signal } = options;
    const controller = new AbortController();
    
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            signal: signal ?? controller.signal,
        });
        return response;
    } finally {
        clearTimeout(timeoutId);
    }
}
```

## Testing Patterns

### Unit test with Vitest
```typescript
import { describe, test, expect, vi } from 'vitest';
import { Cache } from './cache';

describe('Cache', () => {
    test('should store and retrieve values', () => {
        // Arrange
        const cache = new Cache();

        // Act
        cache.set('key', 'value');
        const result = cache.get('key');

        // Assert
        expect(result).toBe('value');
    });

    test('should return undefined for missing keys', () => {
        const cache = new Cache();
        expect(cache.get('missing')).toBeUndefined();
    });
});
```

### Async test
```typescript
describe('AsyncCache', () => {
    test('should resolve with value', async () => {
        const cache = new AsyncCache();
        await cache.set('key', 'value');
        const result = await cache.get('key');
        expect(result).toBe('value');
    });

    test('should handle concurrent access', async () => {
        const cache = new AsyncCache();
        const promises = Array.from({ length: 10 }, (_, i) =>
            cache.set(`key-${i}`, `value-${i}`)
        );
        await Promise.all(promises);
        expect(cache.size()).toBe(10);
    });
});
```

### Mock/stub
```typescript
describe('Cache with mock storage', () => {
    test('should use storage', async () => {
        const mockStorage = {
            get: vi.fn().mockResolvedValue('mocked'),
            set: vi.fn().mockResolvedValue(undefined),
        };

        const cache = new Cache(mockStorage);
        const result = await cache.get('key');

        expect(mockStorage.get).toHaveBeenCalledWith('key');
        expect(result).toBe('mocked');
    });
});
```

### Property-based test
```typescript
import { fc, test as propertyTest } from '@fast-check/vitest';

describe('Math operations', () => {
    propertyTest('addition is commutative', [fc.integer(), fc.integer()], (a, b) => {
        expect(add(a, b)).toBe(add(b, a));
    });
});
```

## Common Type Patterns

### Discriminated Unions
```typescript
export type Action =
    | { type: 'LOAD'; payload: { id: string } }
    | { type: 'SAVE'; payload: { data: Data } }
    | { type: 'DELETE'; payload: { id: string } };

export function handleAction(state: State, action: Action): State {
    switch (action.type) {
        case 'LOAD':
            return { ...state, loadingId: action.payload.id };
        case 'SAVE':
            return { ...state, data: action.payload.data };
        case 'DELETE':
            return { ...state, data: null };
        default:
            return state;
    }
}
```

### Branded Types
```typescript
declare const __brand: unique symbol;

export type UserId = string & { [__brand]: 'UserId' };
export type OrderId = string & unique symbol;

export function createUserId(id: string): UserId {
    return id as UserId;
}

// Type-safe usage
function getUser(id: UserId): User { ... }
function getOrder(id: OrderId): Order { ... }

getUser(createUserId('123')); // OK
getUser('123'); // Error: Type 'string' is not assignable to type 'UserId'
```

### Utility Types
```typescript
// Make all properties optional except id
export type UpdateInput<T> = Partial<Omit<T, 'id'>>;

// API response wrapper
export type ApiResponse<T> =
    | { success: true; data: T }
    | { success: false; error: ApiError };

// Function return type helper
export type AsyncResult<T> = Promise<Result<T, Error>>;
```

## Builder Pattern

```typescript
export interface RequestConfig {
    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    body?: unknown;
    timeout?: number;
    retries?: number;
}

export class RequestBuilder {
    private config: Partial<RequestConfig> = {};

    static create(): RequestBuilder {
        return new RequestBuilder();
    }

    url(url: string): this {
        this.config.url = url;
        return this;
    }

    method(method: RequestConfig['method']): this {
        this.config.method = method;
        return this;
    }

    header(key: string, value: string): this {
        this.config.headers = { ...this.config.headers, [key]: value };
        return this;
    }

    timeout(ms: number): this {
        this.config.timeout = ms;
        return this;
    }

    build(): RequestConfig {
        if (!this.config.url || !this.config.method) {
            throw new Error('URL and method are required');
        }
        return this.config as RequestConfig;
    }
}

// Usage
const request = RequestBuilder.create()
    .url('/api/users')
    .method('GET')
    .header('Authorization', 'Bearer token')
    .timeout(5000)
    .build();
```

## Repository Pattern

```typescript
export interface UserRepository {
    findById(id: UserId): Promise<User | undefined>;
    findAll(): Promise<User[]>;
    save(user: User): Promise<void>;
    delete(id: UserId): Promise<void>;
}

export class PostgresUserRepository implements UserRepository {
    constructor(private db: DatabaseConnection) {}

    async findById(id: UserId): Promise<User | undefined> {
        const row = await this.db.query(
            'SELECT * FROM users WHERE id = $1',
            [id]
        );
        return row ? this.mapToUser(row) : undefined;
    }

    async findAll(): Promise<User[]> {
        const rows = await this.db.query('SELECT * FROM users');
        return rows.map(this.mapToUser);
    }

    // ...
}

// In-memory implementation for testing
export class InMemoryUserRepository implements UserRepository {
    private users = new Map<string, User>();

    async findById(id: UserId): Promise<User | undefined> {
        return this.users.get(id);
    }

    async save(user: User): Promise<void> {
        this.users.set(user.id, user);
    }

    // ...
}
```
