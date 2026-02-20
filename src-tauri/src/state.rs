//! Application state management for Tauri.
//!
//! This module provides the shared state that is managed by Tauri
//! and accessible from command handlers.
//!
//! SPEC: COMP-VAULT-001 FR-5

use crate::core::VaultManager;
use std::sync::Arc;
use tokio::sync::Mutex;

/// The main application state shared across Tauri commands.
///
/// This state is created once at application startup and passed
/// to all command handlers via Tauri's state injection.
#[derive(Default)]
pub struct AppState {
    /// The vault manager - holds the currently open vault.
    /// Wrapped in Arc<Mutex<_>> for thread-safe access across async commands.
    vault: Arc<Mutex<Option<VaultManager>>>,
}

impl AppState {
    /// Create a new empty application state.
    pub fn new() -> Self {
        Self {
            vault: Arc::new(Mutex::new(None)),
        }
    }

    /// Get a reference to the vault mutex.
    pub fn vault(&self) -> &Arc<Mutex<Option<VaultManager>>> {
        &self.vault
    }

    /// SPEC: COMP-VAULT-001 FR-5
    /// Check if a vault is currently open.
    pub async fn is_vault_open(&self) -> bool {
        let vault = self.vault.lock().await;
        vault.is_some()
    }

    /// Get the path of the currently open vault, if any.
    pub async fn current_vault_path(&self) -> Option<String> {
        let vault = self.vault.lock().await;
        vault.as_ref().map(|v| v.root_path().to_string_lossy().to_string())
    }
}

/// Response types for Tauri commands.
/// 
/// These are serializable structs that are returned from commands
/// to the frontend.
pub mod response {
    use serde::Serialize;

    /// Information about an open vault.
    #[derive(Debug, Clone, Serialize)]
    pub struct VaultInfo {
        pub path: String,
        pub name: String,
        pub note_count: usize,
        pub last_modified: i64,
    }

    /// Summary of a note for list views.
    #[derive(Debug, Clone, Serialize)]
    pub struct NoteSummary {
        pub id: String,
        pub path: String,
        pub title: String,
        pub created_at: i64,
        pub modified_at: i64,
        pub word_count: usize,
    }

    /// Full note data.
    #[derive(Debug, Clone, Serialize)]
    pub struct NoteData {
        pub id: String,
        pub path: String,
        pub title: String,
        pub content: String,
        pub created_at: i64,
        pub modified_at: i64,
        pub word_count: usize,
        pub headings: Vec<Heading>,
        pub backlinks: Vec<Backlink>,
    }

    /// A heading extracted from a note.
    #[derive(Debug, Clone, Serialize)]
    pub struct Heading {
        pub level: u8,
        pub text: String,
        pub position: usize,
    }

    /// A backlink to a note.
    #[derive(Debug, Clone, Serialize)]
    pub struct Backlink {
        pub source_path: String,
        pub source_title: String,
        pub context: String,
    }

    /// Search result.
    #[derive(Debug, Clone, Serialize)]
    pub struct SearchResult {
        pub path: String,
        pub title: String,
        pub excerpt: String,
        pub score: f32,
    }

    /// Graph layout response.
    #[derive(Debug, Clone, Serialize)]
    pub struct GraphLayout {
        pub nodes: Vec<GraphNode>,
        pub edges: Vec<GraphEdge>,
    }

    #[derive(Debug, Clone, Serialize)]
    pub struct GraphNode {
        pub id: String,
        pub label: String,
        pub x: f64,
        pub y: f64,
    }

    #[derive(Debug, Clone, Serialize)]
    pub struct GraphEdge {
        pub source: String,
        pub target: String,
    }

    /// Explorer tree payload for notes pane navigation.
    #[derive(Debug, Clone, Serialize)]
    pub struct ExplorerTree {
        pub root: ExplorerFolderNode,
        pub hidden_policy: String,
    }

    /// Folder node in explorer tree.
    #[derive(Debug, Clone, Serialize)]
    pub struct ExplorerFolderNode {
        pub path: String,
        pub name: String,
        pub expanded: bool,
        pub folders: Vec<ExplorerFolderNode>,
        pub notes: Vec<ExplorerNoteNode>,
    }

    /// Note leaf in explorer tree.
    #[derive(Debug, Clone, Serialize)]
    pub struct ExplorerNoteNode {
        pub path: String,
        pub title: String,
        pub display_title: String,
        pub modified_at: i64,
        pub word_count: usize,
    }
}
