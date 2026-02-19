# Rust Code Templates

Reference templates for common Rust patterns. See main SKILL.md for principles.

## Module Structure

### Small Task (single file)
```rust
//! <Module description>

/// <Description>
#[derive(Debug, Clone)]
pub struct Feature {
    field: Type,
}

impl Feature {
    pub fn new() -> Self { ... }
    pub fn method(&self) -> Result<T, E> { ... }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn test_functionality() { ... }
}
```

### Medium Task (mod.rs + impl)
```
mod.rs       - Public API, re-exports
types.rs     - Struct/enum definitions
implementation.rs - Trait impls, logic
```

### Large Task (full module)
```
mod.rs       - Public API
types.rs     - Data types
traits.rs    - Trait definitions
implementation.rs - Implementations
error.rs     - Error types
tests.rs     - Unit tests (or #[cfg(test)] in each file)
```

## Error Handling

### Using thiserror
```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum CacheError {
    #[error("key not found: {0}")]
    KeyNotFound(String),

    #[error("capacity exceeded: {current}/{max}")]
    CapacityExceeded { current: usize, max: usize },

    #[error(transparent)]
    Io(#[from] std::io::Error),
}
```

### Using anyhow (application level)
```rust
use anyhow::{Context, Result};

fn load_config() -> Result<Config> {
    let contents = std::fs::read_to_string("config.toml")
        .context("Failed to read config file")?;

    toml::from_str(&contents)
        .context("Failed to parse config")
}
```

## Async Patterns

### Async trait
```rust
use async_trait::async_trait;

#[async_trait]
pub trait Cache {
    async fn get(&self, key: &str) -> Option<String>;
    async fn set(&self, key: String, value: String);
}
```

### Async implementation
```rust
#[async_trait]
impl Cache for RedisCache {
    async fn get(&self, key: &str) -> Option<String> {
        self.client.get(key).await.ok()
    }

    async fn set(&self, key: String, value: String) {
        let _ = self.client.set(key, value).await;
    }
}
```

## Testing Patterns

### Unit test
```rust
#[test]
fn test_feature() {
    // Arrange
    let input = setup();

    // Act
    let result = function(input);

    // Assert
    assert_eq!(result, expected);
}
```

### Async test
```rust
#[tokio::test]
async fn test_async_feature() {
    let result = async_function().await;
    assert!(result.is_ok());
}
```

### Property-based test
```rust
use proptest::prelude::*;

proptest! {
    #[test]
    fn test_property(input in 0..100) {
        let result = function(input);
        prop_assert!(result >= 0);
    }
}
```

### Mock/stub
```rust
struct MockCache {
    data: HashMap<String, String>,
}

impl Cache for MockCache {
    fn get(&self, key: &str) -> Option<String> {
        self.data.get(key).cloned()
    }
}
```

## Common Derives

```rust
// For most types
#[derive(Debug, Clone, PartialEq, Eq)]

// For config/data structures
#[derive(Debug, Clone, Serialize, Deserialize)]

// For types with defaults
#[derive(Debug, Clone, Default)]

// For copyable types (primitives only)
#[derive(Debug, Copy, Clone, PartialEq, Eq)]
```

## Builder Pattern

```rust
#[derive(Debug, Clone, Default)]
pub struct CacheConfig {
    max_capacity: Option<usize>,
    ttl: Option<Duration>,
}

impl CacheConfig {
    pub fn builder() -> Self {
        Self::default()
    }

    pub fn max_capacity(mut self, cap: usize) -> Self {
        self.max_capacity = Some(cap);
        self
    }

    pub fn ttl(mut self, ttl: Duration) -> Self {
        self.ttl = Some(ttl);
        self
    }

    pub fn build(self) -> Cache {
        Cache::new(self)
    }
}

// Usage
let cache = CacheConfig::builder()
    .max_capacity(1000)
    .ttl(Duration::from_secs(60))
    .build();
```
