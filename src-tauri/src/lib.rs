//! Knot - AI-native knowledge base core library.
//!
//! This is the Rust core of Knot, providing:
//! - Vault management
//! - Note operations
//! - Full-text search
//! - Link graph
//! - P2P sync (future)

pub mod app_command;
pub mod app_config;
pub mod commands;
pub mod config;
pub mod core;
pub mod db;
pub mod error;
pub mod event_log;
pub mod graph;
pub mod ipc;
pub mod knotd_client;
pub mod launcher;
pub mod markdown;
pub mod mcp;
pub mod note;
pub mod note_type;
pub mod recent_vaults;
pub mod runtime;
pub mod search;
pub mod state;
pub mod ui_automation;
pub mod watcher;
pub mod youtube;

// Plugin system (conditionally compiled)
#[cfg(feature = "plugins")]
pub mod plugin;

// Re-exports for convenience
pub use core::VaultManager;
pub use error::{KnotError, Result};
pub use ipc::{IpcClient, IpcServer};

/// Library version string.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

// Legacy re-exports for backward compatibility during migration
pub use error::KnotError as VaultError;
