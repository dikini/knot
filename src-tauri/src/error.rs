use serde::Serialize;

/// Error types for Knot operations.
///
/// These errors are serializable for Tauri command responses.
#[derive(Debug, thiserror::Error, Serialize)]
#[serde(tag = "type", content = "message", rename_all = "snake_case")]
pub enum KnotError {
    #[error("vault not found at {0}")]
    VaultNotFound(String),

    #[error("vault already exists at {0}")]
    VaultAlreadyExists(String),

    #[error("note not found: {0}")]
    NoteNotFound(String),

    #[error("note already exists: {0}")]
    NoteAlreadyExists(String),

    #[error("invalid path: {0}")]
    InvalidPath(String),

    #[error("database error: {0}")]
    Database(String),

    #[error("io error: {0}")]
    Io(String),

    #[error("config error: {0}")]
    Config(String),

    #[error("json error: {0}")]
    Json(String),

    #[error("search error: {0}")]
    Search(String),

    #[error("file watcher error: {0}")]
    Notify(String),

    #[error("WASM runtime error: {0}")]
    Wasm(String),

    #[error("plugin error: {0}")]
    Plugin(String),

    #[error("vault not open")]
    VaultNotOpen,

    #[error("{0}")]
    Other(String),
}

impl KnotError {
    /// Convert to a string representation for Tauri error responses.
    pub fn to_response_string(&self) -> String {
        self.to_string()
    }
}

/// Convenience type alias for Knot results.
pub type Result<T> = std::result::Result<T, KnotError>;

// Conversions from external error types
impl From<rusqlite::Error> for KnotError {
    fn from(err: rusqlite::Error) -> Self {
        KnotError::Database(err.to_string())
    }
}

impl From<std::io::Error> for KnotError {
    fn from(err: std::io::Error) -> Self {
        KnotError::Io(err.to_string())
    }
}

impl From<toml::de::Error> for KnotError {
    fn from(err: toml::de::Error) -> Self {
        KnotError::Config(err.to_string())
    }
}

impl From<toml::ser::Error> for KnotError {
    fn from(err: toml::ser::Error) -> Self {
        KnotError::Config(err.to_string())
    }
}

impl From<serde_json::Error> for KnotError {
    fn from(err: serde_json::Error) -> Self {
        KnotError::Json(err.to_string())
    }
}

impl From<tantivy::TantivyError> for KnotError {
    fn from(err: tantivy::TantivyError) -> Self {
        KnotError::Search(err.to_string())
    }
}

impl From<notify::Error> for KnotError {
    fn from(err: notify::Error) -> Self {
        KnotError::Notify(err.to_string())
    }
}

#[cfg(feature = "plugins")]
impl From<wasmtime::Error> for KnotError {
    fn from(err: wasmtime::Error) -> Self {
        KnotError::Wasm(err.to_string())
    }
}

impl From<walkdir::Error> for KnotError {
    fn from(err: walkdir::Error) -> Self {
        KnotError::Io(err.to_string())
    }
}

// Preserve original error types for backward compatibility during migration
pub use KnotError as VaultError;
