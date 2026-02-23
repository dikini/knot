//! Application state management for Tauri.
//!
//! This module provides the shared state that is managed by Tauri
//! and accessible from command handlers.
//!
//! SPEC: COMP-VAULT-001 FR-5

use crate::core::VaultManager;
use crate::runtime::{RuntimeHost, RuntimeMode};
use std::sync::Arc;
use tokio::sync::Mutex;

/// The main application state shared across Tauri commands.
///
/// This state is created once at application startup and passed
/// to all command handlers via Tauri's state injection.
#[derive(Default)]
pub struct AppState {
    runtime: RuntimeHost,
}

impl AppState {
    /// Create a new empty application state.
    pub fn new() -> Self {
        // TRACE: DESIGN-knotd-ui-daemon-integration
        let runtime_mode = match std::env::var("KNOT_UI_RUNTIME_MODE")
            .ok()
            .as_deref()
            .map(str::trim)
        {
            Some("daemon_ipc") => RuntimeMode::DesktopDaemonCapable,
            _ => RuntimeMode::DesktopEmbedded,
        };
        Self {
            runtime: RuntimeHost::new(runtime_mode),
        }
    }

    /// Get a reference to the vault mutex.
    pub fn vault(&self) -> &Arc<Mutex<Option<VaultManager>>> {
        self.runtime.vault()
    }

    /// Access shared runtime host.
    pub fn runtime(&self) -> &RuntimeHost {
        &self.runtime
    }

    /// SPEC: COMP-VAULT-001 FR-5
    /// Check if a vault is currently open.
    pub async fn is_vault_open(&self) -> bool {
        self.runtime.is_open().await
    }

    /// Get the path of the currently open vault, if any.
    pub async fn current_vault_path(&self) -> Option<String> {
        self.runtime.current_vault_path().await
    }

    /// SPEC: COMP-VAULT-UNSAVED-001 FR-4
    /// Set whether the currently active editor context has unsaved changes.
    pub async fn set_unsaved_changes(&self, has_unsaved_changes: bool) {
        self.runtime.set_unsaved_changes(has_unsaved_changes).await;
    }

    /// SPEC: COMP-VAULT-UNSAVED-001 FR-4
    /// Check whether unsaved changes are currently tracked.
    pub async fn has_unsaved_changes(&self) -> bool {
        self.runtime.has_unsaved_changes().await
    }
}

#[cfg(test)]
mod tests {
    use super::AppState;
    use crate::runtime::RuntimeMode;

    struct EnvGuard {
        key: &'static str,
        original: Option<String>,
    }

    impl EnvGuard {
        fn set(key: &'static str, value: &str) -> Self {
            let original = std::env::var(key).ok();
            // SPEC-TDD: KUI-001 daemon mode config contract
            std::env::set_var(key, value);
            Self { key, original }
        }
    }

    impl Drop for EnvGuard {
        fn drop(&mut self) {
            if let Some(value) = &self.original {
                std::env::set_var(self.key, value);
            } else {
                std::env::remove_var(self.key);
            }
        }
    }

    #[tokio::test]
    async fn bug_vault_unsaved_001_tracks_unsaved_changes_flag() {
        let state = AppState::new();

        assert!(!state.has_unsaved_changes().await);

        state.set_unsaved_changes(true).await;
        assert!(state.has_unsaved_changes().await);

        state.set_unsaved_changes(false).await;
        assert!(!state.has_unsaved_changes().await);
    }

    #[test]
    fn tdd_kui_001_app_state_uses_daemon_runtime_mode_when_configured() {
        let _guard = EnvGuard::set("KNOT_UI_RUNTIME_MODE", "daemon_ipc");
        let state = AppState::new();
        assert_eq!(state.runtime().mode(), RuntimeMode::DesktopDaemonCapable);
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
