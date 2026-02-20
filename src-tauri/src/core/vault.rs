//! Vault management - core business logic.
//!
//! This is the refactored version of the original vault.rs,
//! designed for use with Tauri's state management.
//!
//! SPEC: COMP-VAULT-001 FR-1, FR-2, FR-3, FR-7, FR-8
//! SPEC: COMP-NOTE-001 FR-1, FR-2, FR-3, FR-4, FR-5
//! SPEC: COMP-SEARCH-001 FR-4
//! SPEC: COMP-GRAPH-001 FR-2, FR-6, FR-7
//! SPEC: COMP-TAG-EXTRACTION-001 FR-3

use std::path::{Path, PathBuf};

use tracing::{info, warn};

use crate::config::VaultConfig;
use crate::db::Database;
use crate::error::{KnotError, Result};
use crate::graph::LinkGraph;
use crate::note::{Note, NoteMeta};
use crate::search::SearchIndex;
use crate::watcher::FileWatcher;

const VAULT_DIR: &str = ".vault";
const CONFIG_FILE: &str = "config.toml";
const DB_FILE: &str = "metadata.db";

/// Manages an open vault.
///
/// This is the core type that holds all vault-related state
/// and provides operations on notes, search, and the link graph.
pub struct VaultManager {
    root: PathBuf,
    config: VaultConfig,
    db: Database,
    search: SearchIndex,
    graph: LinkGraph,
    watcher: Option<FileWatcher>,
}

impl VaultManager {
    //region Creation and Opening

    /// SPEC: COMP-VAULT-001 FR-1
    /// Create a new vault at the given path.
    pub fn create(root: &Path) -> Result<Self> {
        let vault_dir = root.join(VAULT_DIR);
        if vault_dir.exists() {
            return Err(KnotError::VaultAlreadyExists(
                root.to_string_lossy().to_string(),
            ));
        }

        info!(?root, "creating new vault");

        // Create directory structure
        std::fs::create_dir_all(&vault_dir)?;
        std::fs::create_dir_all(vault_dir.join("logs"))?;

        // Write default config
        let config = VaultConfig::default();
        config.save(&vault_dir.join(CONFIG_FILE))?;

        // Initialize database
        let db = Database::open(&vault_dir.join(DB_FILE))?;

        // Initialize search index
        let search_dir = vault_dir.join("search.index");
        let search = SearchIndex::open(&search_dir)?;

        let mut vault = Self {
            root: root.to_path_buf(),
            config,
            db,
            search,
            graph: LinkGraph::new(),
            watcher: None,
        };

        // Import any existing .md files in the directory
        vault.sync_files_to_db()?;

        info!(?root, "vault created successfully");
        Ok(vault)
    }

    /// SPEC: COMP-VAULT-001 FR-2
    /// Open an existing vault.
    pub fn open(root: &Path) -> Result<Self> {
        let vault_dir = root.join(VAULT_DIR);
        if !vault_dir.exists() {
            return Err(KnotError::VaultNotFound(root.to_string_lossy().to_string()));
        }

        info!(?root, "opening vault");

        let config = VaultConfig::load(&vault_dir.join(CONFIG_FILE))?;
        let db = Database::open(&vault_dir.join(DB_FILE))?;

        // Open search index
        let search_dir = vault_dir.join("search.index");
        let search = SearchIndex::open(&search_dir)?;

        let mut vault = Self {
            root: root.to_path_buf(),
            config,
            db,
            search,
            graph: LinkGraph::new(),
            watcher: None,
        };

        // Build link graph from database
        vault.rebuild_graph()?;

        // Start file watcher
        if let Err(e) = vault.start_watcher() {
            warn!(error = ?e, "failed to start file watcher");
        }

        info!(?root, "vault opened successfully");
        Ok(vault)
    }

    /// SPEC: COMP-VAULT-001 FR-3
    /// Close the vault and clean up resources.
    pub fn close(&mut self) -> Result<()> {
        info!(root = ?self.root, "closing vault");

        self.stop_watcher();

        // Close search index
        self.search.close()?;

        info!(root = ?self.root, "vault closed");
        Ok(())
    }

    //endregion

    //region Properties

    /// Get the root path of the vault.
    pub fn root_path(&self) -> &Path {
        &self.root
    }

    /// Get the vault configuration.
    pub fn config(&self) -> &VaultConfig {
        &self.config
    }

    /// Persist expanded/collapsed state for an explorer folder path.
    pub fn set_folder_expanded(&mut self, folder_path: &str, expanded: bool) -> Result<()> {
        let normalized = folder_path.trim_matches('/').to_string();

        if expanded {
            if !self.config.explorer.expanded_folders.iter().any(|p| p == &normalized) {
                self.config.explorer.expanded_folders.push(normalized);
            }
        } else {
            self.config
                .explorer
                .expanded_folders
                .retain(|p| p != &normalized);
        }

        self.config.explorer.expansion_state_initialized = true;
        self.config.explorer.expanded_folders.sort();
        self.config.explorer.expanded_folders.dedup();
        self.config.save(&self.vault_dir().join(CONFIG_FILE))?;
        Ok(())
    }

    /// SPEC: COMP-EXPLORER-TREE-001 FR-8
    /// Create a directory inside the vault.
    pub fn create_directory(&self, rel_path: &str) -> Result<()> {
        let normalized = normalize_rel_dir(rel_path)?;
        std::fs::create_dir_all(self.root.join(normalized))?;
        Ok(())
    }

    /// SPEC: COMP-EXPLORER-TREE-001 FR-8
    /// Delete a directory from the vault.
    pub fn delete_directory(&mut self, rel_path: &str, recursive: bool) -> Result<()> {
        let normalized = normalize_rel_dir(rel_path)?;
        let target = self.root.join(&normalized);
        if !target.exists() {
            return Ok(());
        }

        if recursive {
            std::fs::remove_dir_all(&target)?;
        } else {
            std::fs::remove_dir(&target)?;
        }

        self.sync_files_to_db()?;
        Ok(())
    }

    /// SPEC: COMP-EXPLORER-TREE-001 FR-8
    /// Rename/move a directory in the vault.
    pub fn rename_directory(&mut self, old_path: &str, new_path: &str) -> Result<()> {
        let old_norm = normalize_rel_dir(old_path)?;
        let new_norm = normalize_rel_dir(new_path)?;
        if old_norm == new_norm {
            return Ok(());
        }

        let old_prefix = format!("{old_norm}/");
        let notes_to_move = self
            .list_notes()?
            .into_iter()
            .map(|note| note.path)
            .filter(|path| path == &old_norm || path.starts_with(&old_prefix))
            .collect::<Vec<_>>();

        if notes_to_move.is_empty() {
            let old_full = self.root.join(&old_norm);
            if !old_full.exists() {
                return Err(KnotError::InvalidPath(old_norm));
            }
            let new_full = self.root.join(&new_norm);
            if let Some(parent) = new_full.parent() {
                std::fs::create_dir_all(parent)?;
            }
            std::fs::rename(old_full, new_full)?;
            return Ok(());
        }

        for old_note_path in notes_to_move {
            let suffix = old_note_path
                .strip_prefix(&old_prefix)
                .unwrap_or_default();
            let new_note_path = if suffix.is_empty() {
                new_norm.clone()
            } else {
                format!("{new_norm}/{suffix}")
            };
            self.rename_note(&old_note_path, &new_note_path)?;
        }

        let old_full = self.root.join(&old_norm);
        if old_full.exists() {
            let _ = std::fs::remove_dir_all(old_full);
        }

        Ok(())
    }

    /// Get the vault directory path.
    pub fn vault_dir(&self) -> PathBuf {
        self.root.join(VAULT_DIR)
    }

    /// Get the number of notes in the vault.
    pub fn note_count(&self) -> Result<usize> {
        self.db.note_count()
    }

    //endregion

    //region Note Operations

    /// SPEC: COMP-NOTE-001 FR-1
    /// List all notes in the vault.
    pub fn list_notes(&self) -> Result<Vec<NoteMeta>> {
        self.db.list_notes()
    }

    /// SPEC: COMP-NOTE-001 FR-2
    /// Get a note by its path.
    pub fn get_note(&self, path: &str) -> Result<Note> {
        // First try to get from database
        let note = self.db.get_note_by_path(path, &self.root)?;

        // If not in database, try to read from filesystem
        if note.is_none() {
            let full_path = self.root.join(path);
            if !full_path.exists() {
                return Err(KnotError::NoteNotFound(path.to_string()));
            }

            let content = std::fs::read_to_string(&full_path)?;
            return Ok(Note::new(path, &content));
        }

        note.ok_or_else(|| KnotError::NoteNotFound(path.to_string()))
    }

    /// SPEC: COMP-NOTE-001 FR-3
    /// Save a note.
    pub fn save_note(&mut self, path: &str, content: &str) -> Result<()> {
        let full_path = self.root.join(path);

        // Ensure parent directory exists
        if let Some(parent) = full_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        // Write to filesystem
        std::fs::write(&full_path, content)?;

        // Update database
        let note = Note::new(path, content);
        self.db.save_note(&note)?;

        // SPEC: COMP-TAG-EXTRACTION-001 FR-3
        // Extract and sync tags
        let tags = crate::markdown::extract_tags(content);
        self.sync_tags(note.id(), &tags)?;

        // SPEC: COMP-TAG-EXTRACTION-001 FR-3
        // Update search index WITH tags
        self.search
            .index_note(note.path(), note.title(), note.content(), &tags)?;

        // Update link graph
        self.update_graph_for_note(&note)?;

        info!(path, "note saved");
        Ok(())
    }

    /// SPEC: COMP-TAG-EXTRACTION-001 FR-3
    fn sync_tags(&self, note_id: &str, tags: &[String]) -> Result<()> {
        let conn = self.db.conn();

        // Delete existing tags for this note
        conn.execute("DELETE FROM note_tags WHERE note_id = ?1", [note_id])?;

        // Insert/update tags
        for tag in tags {
            // Insert tag if not exists
            conn.execute("INSERT OR IGNORE INTO tags (name) VALUES (?1)", [tag])?;

            // Link note to tag
            conn.execute(
                "INSERT INTO note_tags (note_id, tag_id) 
                 SELECT ?1, id FROM tags WHERE name = ?2",
                [note_id, tag],
            )?;
        }

        Ok(())
    }

    /// SPEC: COMP-NOTE-001 FR-4
    /// Delete a note.
    pub fn delete_note(&mut self, path: &str) -> Result<()> {
        let full_path = self.root.join(path);

        // Delete from filesystem
        if full_path.exists() {
            std::fs::remove_file(&full_path)?;
        }

        // Remove from database
        self.db.delete_note_by_path(path)?;

        // Remove from search index
        self.search.remove_note(path)?;

        // Update graph
        self.rebuild_graph()?;

        info!(path, "note deleted");
        Ok(())
    }

    /// SPEC: COMP-NOTE-001 FR-5
    /// Rename/move a note.
    pub fn rename_note(&mut self, old_path: &str, new_path: &str) -> Result<()> {
        let old_full = self.root.join(old_path);
        let new_full = self.root.join(new_path);

        if !old_full.exists() {
            return Err(KnotError::NoteNotFound(old_path.to_string()));
        }

        // Create parent directory if needed
        if let Some(parent) = new_full.parent() {
            std::fs::create_dir_all(parent)?;
        }

        // Move file
        std::fs::rename(&old_full, &new_full)?;

        // Update database
        self.db.rename_note_path(old_path, new_path)?;

        // Rebuild search index for this note
        let content = std::fs::read_to_string(&new_full)?;
        let note = Note::new(new_path, &content);
        let tags = crate::markdown::extract_tags(&content);
        self.sync_tags(note.id(), &tags)?;
        self.search.remove_note(old_path)?;
        self.search
            .index_note(note.path(), note.title(), note.content(), &tags)?;

        // Update graph
        self.rebuild_graph()?;

        info!(old_path, new_path, "note renamed");
        Ok(())
    }

    //endregion

    //region Search

    /// SPEC: COMP-SEARCH-001 FR-4
    /// Search notes in the vault.
    pub fn search(&self, query: &str, limit: usize) -> Result<Vec<crate::search::SearchResult>> {
        self.search.search(query, limit)
    }

    //endregion

    //region Graph

    /// Get the link graph.
    pub fn graph(&self) -> &LinkGraph {
        &self.graph
    }

    /// SPEC: COMP-GRAPH-001 FR-7
    /// Get neighbors of a note in the graph.
    pub fn graph_neighbors(&self, path: &str, depth: usize) -> Vec<String> {
        self.graph.neighbors(path, depth)
    }

    /// SPEC: COMP-GRAPH-001 FR-6
    /// Compute graph layout.
    pub fn graph_layout(&self, width: f64, height: f64) -> crate::graph::GraphLayout {
        self.graph.layout(width, height)
    }

    fn rebuild_graph(&mut self) -> Result<()> {
        self.graph = LinkGraph::from_vault(&self.db)?;
        Ok(())
    }

    fn update_graph_for_note(&mut self, note: &Note) -> Result<()> {
        // Parse note for links
        let parsed = crate::markdown::parse(&note.content());
        self.graph.update_note(&note.path(), &parsed.links);
        Ok(())
    }

    //endregion

    //region Sync

    /// SPEC: COMP-VAULT-001 FR-7
    /// Sync files from filesystem to database.
    ///
    /// This scans the vault directory for .md files and updates
    /// the database to match the filesystem state.
    pub fn sync_files_to_db(&mut self) -> Result<()> {
        use walkdir::WalkDir;

        info!("syncing files to database");

        let mut synced = 0;
        for entry in WalkDir::new(&self.root)
            .follow_links(false)
            .into_iter()
            .filter_entry(|e| {
                // Skip the .vault directory
                let path = e.path();
                !path
                    .components()
                    .any(|c| c.as_os_str() == std::ffi::OsStr::new(VAULT_DIR))
            })
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) != Some("md") {
                continue;
            }

            // Get relative path from vault root
            let relative = path
                .strip_prefix(&self.root)
                .map_err(|_| KnotError::InvalidPath(path.to_string_lossy().to_string()))?;
            let path_str = relative.to_string_lossy();

            // Read file content
            let content = std::fs::read_to_string(path)?;
            let note = Note::new(&path_str, &content);

            // Save to database
            self.db.save_note(&note)?;
            let tags = crate::markdown::extract_tags(&content);
            self.sync_tags(note.id(), &tags)?;
            self.search
                .index_note(note.path(), note.title(), note.content(), &tags)?;

            synced += 1;
        }

        info!(synced, "files synced to database");

        // Rebuild graph after sync
        self.rebuild_graph()?;

        Ok(())
    }

    //endregion

    //region File Watching

    /// SPEC: COMP-FILE-WATCH-001 FR-1, FR-6, FR-7
    /// Start watching vault directory for file changes
    fn start_watcher(&mut self) -> Result<()> {
        let watcher = FileWatcher::new(&self.root)?;
        info!("file watcher started for vault");
        self.watcher = Some(watcher);
        Ok(())
    }

    fn stop_watcher(&mut self) {
        if let Some(watcher) = self.watcher.take() {
            drop(watcher);
            info!("file watcher stopped");
        }
    }

    /// Call this periodically to process watcher events
    /// SPEC: COMP-FILE-WATCH-001 FR-7
    /// Poll for and sync external file changes
    pub fn sync_external_changes(&mut self) -> Result<()> {
        if let Some(ref mut watcher) = self.watcher {
            let events = watcher.poll_events();
            for event in events {
                self.handle_file_event(event)?;
            }
        }
        Ok(())
    }

    /// SPEC: COMP-FILE-WATCH-001 FR-2, FR-3, FR-4, FR-5
    /// Handle file watcher events and sync to database/index/graph
    fn handle_file_event(&mut self, event: crate::watcher::FileEvent) -> Result<()> {
        use crate::watcher::FileEvent;
        match event {
            FileEvent::Modified { path } => {
                self.sync_modified_file(&path)?;
            }
            FileEvent::Deleted { path } => {
                self.sync_deleted_file(&path)?;
            }
            FileEvent::Renamed { from, to } => {
                self.sync_renamed_file(&from, &to)?;
            }
        }
        Ok(())
    }

    /// SPEC: COMP-FILE-WATCH-001 FR-2
    /// Sync newly created file to database, index, and graph
    fn sync_new_file(&mut self, path: &str) -> Result<()> {
        let full_path = self.root.join(path);
        let content = std::fs::read_to_string(&full_path)?;
        let note = Note::new(path, &content);
        let tags = crate::markdown::extract_tags(&content);

        self.db.save_note(&note)?;
        self.sync_tags(note.id(), &tags)?;
        self.search
            .index_note(path, note.title(), &content, &tags)?;
        self.update_graph_for_note(&note)?;

        info!(path, "synced new file to database, index, and graph");
        Ok(())
    }

    /// SPEC: COMP-FILE-WATCH-001 FR-3
    /// Sync externally modified file to database, index, and graph
    fn sync_modified_file(&mut self, path: &str) -> Result<()> {
        info!(path, "external file modified");
        let full_path = self.root.join(path);
        let content = std::fs::read_to_string(&full_path)?;
        let note = Note::new(path, &content);
        let tags = crate::markdown::extract_tags(&content);

        self.db.save_note(&note)?;
        self.sync_tags(note.id(), &tags)?;
        self.search
            .index_note(path, note.title(), &content, &tags)?;
        self.update_graph_for_note(&note)?;

        info!(path, "synced modified file to database, index, and graph");
        Ok(())
    }

    /// SPEC: COMP-FILE-WATCH-001 FR-4
    /// Sync deleted file removal to database, index, and graph
    fn sync_deleted_file(&mut self, path: &str) -> Result<()> {
        info!(path, "external file deleted");
        self.delete_note(path)
    }

    /// SPEC: COMP-FILE-WATCH-001 FR-5
    /// Sync renamed/moved file to database, index, and graph
    fn sync_renamed_file(&mut self, from: &str, to: &str) -> Result<()> {
        info!(from, to, "external file renamed");
        let _ = self.sync_deleted_file(from);
        let _ = self.sync_new_file(to);
        Ok(())
    }

    //endregion
}

fn normalize_rel_dir(path: &str) -> Result<String> {
    let normalized = path.trim().replace('\\', "/").trim_matches('/').to_string();
    if normalized.is_empty() {
        return Err(KnotError::InvalidPath(path.to_string()));
    }
    if normalized.starts_with('.') {
        return Err(KnotError::InvalidPath(path.to_string()));
    }
    if normalized
        .split('/')
        .any(|segment| segment.is_empty() || segment == "." || segment == "..")
    {
        return Err(KnotError::InvalidPath(path.to_string()));
    }
    Ok(normalized)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_create_and_open_vault() {
        let temp = TempDir::new().unwrap();
        let vault_path = temp.path().join("test-vault");

        // Create vault
        let vault = VaultManager::create(&vault_path);
        assert!(vault.is_ok());
        drop(vault);

        // Open vault
        let vault = VaultManager::open(&vault_path);
        assert!(vault.is_ok());
    }

    #[test]
    fn test_save_and_get_note() {
        let temp = TempDir::new().unwrap();
        let vault_path = temp.path().join("test-vault");

        let mut vault = VaultManager::create(&vault_path).unwrap();

        // Save a note
        vault
            .save_note("test.md", "# Test Note\n\nContent here.")
            .unwrap();

        // Get the note
        let note = vault.get_note("test.md").unwrap();
        assert_eq!(note.title(), "Test Note");
    }

    #[test]
    fn explorer_directory_crud_roundtrip() {
        let temp = TempDir::new().unwrap();
        let vault_path = temp.path().join("test-vault");
        let mut vault = VaultManager::create(&vault_path).unwrap();

        vault.create_directory("Projects/2026").unwrap();
        assert!(vault.root_path().join("Projects/2026").exists());

        vault.delete_directory("Projects", true).unwrap();
        assert!(!vault.root_path().join("Projects").exists());
    }

    #[test]
    fn explorer_directory_rename_moves_notes() {
        let temp = TempDir::new().unwrap();
        let vault_path = temp.path().join("test-vault");
        let mut vault = VaultManager::create(&vault_path).unwrap();

        vault
            .save_note("Programming/rust.md", "# Rust\n\nhello")
            .unwrap();
        vault
            .save_note("Programming/python.md", "# Python\n\nhello")
            .unwrap();

        vault
            .rename_directory("Programming", "Engineering")
            .unwrap();

        assert!(vault.root_path().join("Engineering/rust.md").exists());
        assert!(vault.root_path().join("Engineering/python.md").exists());
        assert!(vault.get_note("Engineering/rust.md").is_ok());
        assert!(vault.get_note("Programming/rust.md").is_err());
    }
}
