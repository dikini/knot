//! Core business logic for Knot.
//!
//! This module contains the pure business logic, independent of
//! the Tauri command layer. It handles:
//! - Vault management
//! - Note operations
//! - Search indexing
//! - Link graph

mod vault;

pub use vault::VaultManager;

// Re-export types from other modules for convenience
pub use crate::note::{Note, NoteMeta};
pub use crate::search::SearchResult;
