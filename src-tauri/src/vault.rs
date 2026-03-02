use std::collections::HashSet;
use std::path::{Path, PathBuf};

use chrono::Utc;
use tracing::{debug, info, warn};
use uuid::Uuid;
use walkdir::WalkDir;

use crate::config::VaultConfig;
use crate::db::Database;
use crate::error::{Result, VaultError};
use crate::graph::{self, GraphLayout, LinkGraph, NoteLink};
use crate::markdown::{self, Heading};
use crate::note::{Note, NoteMeta};
use crate::plugin::PluginRuntime;
use crate::search::{SearchIndex, SearchResult};
use crate::watcher::{FileEvent, FileWatcher};

const VAULT_DIR: &str = ".vault";
const CONFIG_FILE: &str = "config.toml";
const DB_FILE: &str = "metadata.db";

#[cfg(test)]
thread_local! {
    static FORCE_PLUGIN_RUNTIME_INIT_FAILURE: std::cell::Cell<bool> = const { std::cell::Cell::new(false) };
}

pub struct Vault {
    root: PathBuf,
    config: VaultConfig,
    db: Database,
    search: SearchIndex,
    watcher: Option<FileWatcher>,
    plugins: Option<PluginRuntime>,
}

impl Vault {
    /// Create a new vault at the given path.
    pub fn create(root: &Path) -> Result<Self> {
        let vault_dir = root.join(VAULT_DIR);
        if vault_dir.exists() {
            return Err(VaultError::AlreadyExists(root.to_path_buf()));
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

        let vault = Self {
            root: root.to_path_buf(),
            config,
            db,
            search,
            watcher: None,
            plugins: None, // Disabled by default on create
        };

        // Import any existing .md files in the directory
        vault.sync_files_to_db()?;

        Ok(vault)
    }

    /// Open an existing vault.
    pub fn open(root: &Path) -> Result<Self> {
        let vault_dir = root.join(VAULT_DIR);
        if !vault_dir.exists() {
            return Err(VaultError::NotFound(root.to_path_buf()));
        }

        info!(?root, "opening vault");

        let config = VaultConfig::load(&vault_dir.join(CONFIG_FILE))?;
        let db = Database::open(&vault_dir.join(DB_FILE))?;

        // Open search index
        let search_dir = vault_dir.join("search.index");
        let search = SearchIndex::open(&search_dir)?;

        // Initialize plugin runtime
        let plugins = if config.plugins_enabled {
            Some(initialize_plugin_runtime(&vault_dir)?)
        } else {
            None
        };

        let vault = Self {
            root: root.to_path_buf(),
            config,
            db,
            search,
            watcher: None,
            plugins,
        };

        // Import any new .md files, remove stale DB entries
        vault.sync_files_to_db()?;

        // Rebuild search index from all notes
        let notes = vault.list_notes()?;
        for meta in &notes {
            let content = std::fs::read_to_string(vault.root.join(&meta.path)).unwrap_or_default();
            vault
                .search
                .index_note(&meta.path, &meta.title, &content, &[])?;
        }
        vault.search.commit()?;

        Ok(vault)
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn config(&self) -> &VaultConfig {
        &self.config
    }

    /// Get current vault settings as a JSON object string.
    pub fn get_vault_settings_json(&self) -> Result<String> {
        Ok(serde_json::to_string(&self.config)?)
    }

    /// Apply a JSON merge patch to vault settings, persist, and return updated settings JSON.
    pub fn update_vault_settings_patch(&mut self, patch_json: &str) -> Result<String> {
        let previous_plugins_enabled = self.config.plugins_enabled;
        let patch: serde_json::Value = serde_json::from_str(patch_json)?;
        let mut settings_value = serde_json::to_value(&self.config)?;
        apply_json_merge_patch(&mut settings_value, &patch);

        let updated_config: VaultConfig = serde_json::from_value(settings_value)?;
        let next_plugins_enabled = updated_config.plugins_enabled;
        let plugins_enabled_changed = next_plugins_enabled != previous_plugins_enabled;

        // Keep enable toggle atomic: only commit config/runtime after init succeeds.
        let initialized_runtime = if plugins_enabled_changed && next_plugins_enabled {
            Some(initialize_plugin_runtime(&self.root.join(VAULT_DIR))?)
        } else {
            None
        };

        updated_config.save(&self.root.join(VAULT_DIR).join(CONFIG_FILE))?;
        self.config = updated_config;

        if let Some(runtime) = initialized_runtime {
            self.plugins = Some(runtime);
        } else if plugins_enabled_changed && !next_plugins_enabled {
            self.plugins = None;
        }

        self.get_vault_settings_json()
    }

    /// Synchronize the filesystem with the database.
    ///
    /// - Imports .md files found on disk but not in the DB.
    /// - Removes DB entries for files that no longer exist on disk.
    ///
    /// Called automatically on vault open and create.
    pub fn sync_files_to_db(&self) -> Result<()> {
        let disk_files: HashSet<String> = self.scan_files()?.into_iter().collect();

        // Get paths already in DB
        let db_files: HashSet<String> = {
            let mut stmt = self.db.conn().prepare("SELECT path FROM notes")?;
            let rows = stmt
                .query_map([], |row| row.get::<_, String>(0))?
                .filter_map(|r| r.ok())
                .collect();
            rows
        };

        // Import files on disk but not in DB
        let to_import: Vec<&String> = disk_files.difference(&db_files).collect();
        if !to_import.is_empty() {
            info!(
                count = to_import.len(),
                "importing existing files into vault"
            );
        }
        for rel_path in to_import {
            let full_path = self.root.join(rel_path);
            let content = match std::fs::read_to_string(&full_path) {
                Ok(c) => c,
                Err(e) => {
                    warn!(?rel_path, ?e, "skipping unreadable file");
                    continue;
                }
            };

            let now = Utc::now().timestamp();
            let id = Uuid::new_v4().to_string();
            let title = NoteMeta::title_from_content(&content, rel_path);
            let word_count = NoteMeta::word_count(&content);
            let hash = NoteMeta::content_hash(&content);

            self.db.conn().execute(
                "INSERT INTO notes (id, path, title, created_at, modified_at, word_count, content_hash)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                rusqlite::params![id, rel_path, title, now, now, word_count, hash],
            )?;

            let parsed = markdown::parse(&content);
            graph::save_links(&self.db, &id, &parsed.links)?;
            graph::save_headings(&self.db, &id, &parsed.headings)?;

            self.search.index_note(rel_path, &title, &content, &[])?;

            debug!(?rel_path, "imported");
        }

        // Remove DB entries for files no longer on disk
        let to_remove: Vec<&String> = db_files.difference(&disk_files).collect();
        if !to_remove.is_empty() {
            info!(
                count = to_remove.len(),
                "removing stale entries from vault DB"
            );
        }
        for rel_path in to_remove {
            self.db
                .conn()
                .execute("DELETE FROM notes WHERE path = ?1", [rel_path])?;
            debug!(?rel_path, "removed stale entry");
        }

        self.search.commit()?;

        Ok(())
    }

    /// Scan the vault directory for markdown files and sync with the database.
    pub fn scan_files(&self) -> Result<Vec<String>> {
        let mut paths = Vec::new();

        for entry in WalkDir::new(&self.root)
            .into_iter()
            .filter_entry(|e| !is_hidden(e))
            .filter_map(|e| e.ok())
        {
            if entry.file_type().is_file() {
                if let Some(ext) = entry.path().extension() {
                    if ext == "md" {
                        if let Ok(rel) = entry.path().strip_prefix(&self.root) {
                            paths.push(rel.to_string_lossy().to_string());
                        }
                    }
                }
            }
        }

        debug!(count = paths.len(), "scanned vault files");
        Ok(paths)
    }

    /// Create a new note with the given relative path and content.
    pub fn create_note(&self, rel_path: &str, content: &str) -> Result<NoteMeta> {
        validate_note_path(rel_path)?;

        let full_path = self.root.join(rel_path);
        if full_path.exists() {
            return Err(VaultError::NoteAlreadyExists(rel_path.to_string()));
        }

        // Ensure parent directory exists
        if let Some(parent) = full_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        // Write file
        std::fs::write(&full_path, content)?;

        // Insert into database
        let now = Utc::now().timestamp();
        let id = Uuid::new_v4().to_string();
        let title = NoteMeta::title_from_content(content, rel_path);
        let word_count = NoteMeta::word_count(content);
        let hash = NoteMeta::content_hash(content);

        self.db.conn().execute(
            "INSERT INTO notes (id, path, title, created_at, modified_at, word_count, content_hash)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![id, rel_path, title, now, now, word_count, hash],
        )?;

        // Parse markdown and persist links + headings
        let parsed = markdown::parse(content);
        graph::save_links(&self.db, &id, &parsed.links)?;
        graph::save_headings(&self.db, &id, &parsed.headings)?;

        // Update search index
        self.search.index_note(rel_path, &title, content, &[])?;
        self.search.commit()?;

        Ok(NoteMeta {
            id,
            path: rel_path.to_string(),
            title,
            created_at: now,
            modified_at: now,
            word_count,
            content_hash: Some(hash),
        })
    }

    /// Create a directory in the vault.
    pub fn create_directory(&self, rel_path: &str) -> Result<()> {
        validate_relative_path(rel_path)?;
        std::fs::create_dir_all(self.root.join(rel_path))?;
        Ok(())
    }

    /// Delete a directory from the vault.
    pub fn delete_directory(&self, rel_path: &str, recursive: bool) -> Result<()> {
        validate_relative_path(rel_path)?;
        let full_path = self.root.join(rel_path);

        if recursive {
            std::fs::remove_dir_all(&full_path)?;
        } else {
            std::fs::remove_dir(&full_path)?;
        }

        Ok(())
    }

    /// Read a note by its relative path.
    pub fn read_note(&self, rel_path: &str) -> Result<Note> {
        let full_path = self.root.join(rel_path);
        let content = std::fs::read_to_string(&full_path)
            .map_err(|_| VaultError::NoteNotFound(rel_path.to_string()))?;

        let meta = self.get_note_meta(rel_path)?;

        Ok(Note { meta, content })
    }

    /// Update a note's content.
    pub fn update_note(&self, rel_path: &str, content: &str) -> Result<NoteMeta> {
        let full_path = self.root.join(rel_path);
        if !full_path.exists() {
            return Err(VaultError::NoteNotFound(rel_path.to_string()));
        }

        std::fs::write(&full_path, content)?;

        let now = Utc::now().timestamp();
        let title = NoteMeta::title_from_content(content, rel_path);
        let word_count = NoteMeta::word_count(content);
        let hash = NoteMeta::content_hash(content);

        self.db.conn().execute(
            "UPDATE notes SET title = ?1, modified_at = ?2, word_count = ?3, content_hash = ?4
             WHERE path = ?5",
            rusqlite::params![title, now, word_count, hash, rel_path],
        )?;

        // Re-parse markdown and update links + headings
        let meta = self.get_note_meta(rel_path)?;
        let parsed = markdown::parse(content);
        graph::save_links(&self.db, &meta.id, &parsed.links)?;
        graph::save_headings(&self.db, &meta.id, &parsed.headings)?;

        // Update search index
        self.search
            .index_note(rel_path, &meta.title, content, &[])?;
        self.search.commit()?;

        Ok(meta)
    }

    /// Delete a note by its relative path.
    pub fn delete_note(&self, rel_path: &str) -> Result<()> {
        let full_path = self.root.join(rel_path);
        if !full_path.exists() {
            return Err(VaultError::NoteNotFound(rel_path.to_string()));
        }

        std::fs::remove_file(&full_path)?;

        self.db
            .conn()
            .execute("DELETE FROM notes WHERE path = ?1", [rel_path])?;

        // Remove from search index
        self.search.remove_note(rel_path)?;
        self.search.commit()?;

        Ok(())
    }

    /// Move a note from one path to another.
    pub fn move_note(&self, from_path: &str, to_path: &str) -> Result<NoteMeta> {
        validate_note_path(to_path)?;

        let from_full = self.root.join(from_path);
        let to_full = self.root.join(to_path);

        if !from_full.exists() {
            return Err(VaultError::NoteNotFound(from_path.to_string()));
        }
        if to_full.exists() {
            return Err(VaultError::NoteAlreadyExists(to_path.to_string()));
        }

        // Ensure destination parent exists
        if let Some(parent) = to_full.parent() {
            std::fs::create_dir_all(parent)?;
        }

        std::fs::rename(&from_full, &to_full)?;

        let now = Utc::now().timestamp();
        self.db.conn().execute(
            "UPDATE notes SET path = ?1, modified_at = ?2 WHERE path = ?3",
            rusqlite::params![to_path, now, from_path],
        )?;

        self.get_note_meta(to_path)
    }

    /// List all notes in the vault.
    pub fn list_notes(&self) -> Result<Vec<NoteMeta>> {
        let mut stmt = self.db.conn().prepare(
            "SELECT id, path, title, created_at, modified_at, word_count, content_hash
             FROM notes ORDER BY path",
        )?;

        let notes = stmt
            .query_map([], |row| {
                Ok(NoteMeta {
                    id: row.get(0)?,
                    path: row.get(1)?,
                    title: row.get(2)?,
                    created_at: row.get(3)?,
                    modified_at: row.get(4)?,
                    word_count: row.get(5)?,
                    content_hash: row.get(6)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(notes)
    }

    /// Render a note's content as HTML.
    pub fn render_note(&self, rel_path: &str) -> Result<String> {
        let full_path = self.root.join(rel_path);
        let content = std::fs::read_to_string(&full_path)
            .map_err(|_| VaultError::NoteNotFound(rel_path.to_string()))?;
        let parsed = markdown::parse(&content);
        Ok(parsed.html)
    }

    /// Get notes that link to the given note (backlinks).
    pub fn get_backlinks(&self, rel_path: &str) -> Result<Vec<NoteLink>> {
        graph::load_backlinks(&self.db, rel_path)
    }

    /// Get notes that the given note links to (forward links).
    pub fn get_forward_links(&self, rel_path: &str) -> Result<Vec<NoteLink>> {
        graph::load_forward_links(&self.db, rel_path)
    }

    /// Get headings for a note (for TOC).
    pub fn get_headings(&self, rel_path: &str) -> Result<Vec<Heading>> {
        graph::load_headings(&self.db, rel_path)
    }

    /// Search notes in the vault using full-text search.
    pub fn search_notes(&self, query: &str, limit: usize) -> Result<Vec<SearchResult>> {
        self.search.search(query, limit)
    }

    /// Compute a force-directed graph layout of all notes and their links.
    ///
    /// Builds the link graph from the database, runs Fruchterman-Reingold
    /// layout, and returns node positions and edges for visualization.
    pub fn graph_layout(&self, width: f64, height: f64) -> Result<GraphLayout> {
        let lg = LinkGraph::build_from_db(&self.db)?;
        Ok(lg.compute_layout(width, height))
    }

    /// List all tags in the vault.
    pub fn list_tags(&self) -> Result<Vec<String>> {
        let mut stmt = self
            .db
            .conn()
            .prepare("SELECT name FROM tags ORDER BY name")?;

        let tags = stmt
            .query_map([], |row| row.get::<_, String>(0))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(tags)
    }

    /// Get neighbors in the link graph up to specified depth.
    ///
    /// Returns a tuple of (nodes, edges) where:
    /// - nodes: list of connected note paths
    /// - edges: list of (source, target) tuples representing links
    #[allow(clippy::type_complexity)]
    pub fn get_graph_neighbors(
        &self,
        start_path: &str,
        depth: usize,
    ) -> Result<(Vec<String>, Vec<(String, String)>)> {
        use std::collections::{HashSet, VecDeque};

        let lg = LinkGraph::build_from_db(&self.db)?;

        // Check if start node exists
        if !lg.all_nodes().contains(&start_path.to_string()) {
            return Err(VaultError::NoteNotFound(start_path.to_string()));
        }

        let mut visited = HashSet::new();
        let mut edges = Vec::new();
        let mut queue = VecDeque::new();

        visited.insert(start_path.to_string());
        queue.push_back((start_path.to_string(), 0));

        while let Some((current, current_depth)) = queue.pop_front() {
            // Get forward and backward links
            let forward = lg.get_forward_links(&current);
            let backward = lg.get_backlinks(&current);

            for neighbor in forward.iter().chain(backward.iter()) {
                edges.push((current.clone(), neighbor.clone()));

                // Only traverse further if within depth limit and not visited
                if current_depth < depth && visited.insert(neighbor.clone()) {
                    queue.push_back((neighbor.clone(), current_depth + 1));
                }
            }
        }

        let nodes: Vec<String> = visited.into_iter().collect();
        Ok((nodes, edges))
    }

    /// Get note metadata by path.
    pub fn get_note_meta(&self, rel_path: &str) -> Result<NoteMeta> {
        self.db
            .conn()
            .query_row(
                "SELECT id, path, title, created_at, modified_at, word_count, content_hash
                 FROM notes WHERE path = ?1",
                [rel_path],
                |row| {
                    Ok(NoteMeta {
                        id: row.get(0)?,
                        path: row.get(1)?,
                        title: row.get(2)?,
                        created_at: row.get(3)?,
                        modified_at: row.get(4)?,
                        word_count: row.get(5)?,
                        content_hash: row.get(6)?,
                    })
                },
            )
            .map_err(|_| VaultError::NoteNotFound(rel_path.to_string()))
    }

    /// SPEC: COMP-FILE-WATCH-001 FR-1
    /// Start watching the vault directory for external changes.
    pub fn start_watching(&mut self) -> Result<()> {
        if self.watcher.is_some() {
            return Ok(()); // Already watching
        }
        self.watcher = Some(FileWatcher::new(&self.root)?);
        info!("vault file watching started");
        Ok(())
    }

    /// SPEC: COMP-FILE-WATCH-001 FR-1, FR-7
    /// Stop watching the vault directory.
    pub fn stop_watching(&mut self) {
        if self.watcher.take().is_some() {
            info!("vault file watching stopped");
        }
    }

    /// SPEC: COMP-FILE-WATCH-001 FR-1
    /// Check if file watching is active.
    pub fn is_watching(&self) -> bool {
        self.watcher.is_some()
    }

    /// Get plugin runtime (if enabled)
    pub fn plugins(&self) -> Option<&PluginRuntime> {
        self.plugins.as_ref()
    }

    /// Get mutable plugin runtime (if enabled)
    pub fn plugins_mut(&mut self) -> Option<&mut PluginRuntime> {
        self.plugins.as_mut()
    }

    /// Check if plugins are enabled
    pub fn plugins_enabled(&self) -> bool {
        self.config.plugins_enabled
    }

    /// SPEC: COMP-FILE-WATCH-001 FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7
    /// Poll for file system changes and sync them to the vault.
    /// Returns the number of changes processed.
    pub fn sync_external_changes(&mut self) -> Result<usize> {
        let Some(watcher) = &mut self.watcher else {
            return Ok(0);
        };

        let events = watcher.poll_events();
        let count = events.len();

        for event in events {
            match event {
                FileEvent::Modified { path } => {
                    self.sync_file_modified(&path)?;
                }
                FileEvent::Deleted { path } => {
                    self.sync_file_deleted(&path)?;
                }
                FileEvent::Renamed { from, to } => {
                    self.sync_file_renamed(&from, &to)?;
                }
            }
        }

        if count > 0 {
            self.search.commit()?;
        }

        Ok(count)
    }

    /// SPEC: COMP-FILE-WATCH-001 FR-2, FR-3
    fn sync_file_modified(&self, rel_path: &str) -> Result<()> {
        let full_path = self.root.join(rel_path);

        if !full_path.exists() {
            // File was deleted before we could process
            return self.sync_file_deleted(rel_path);
        }

        let content = match std::fs::read_to_string(&full_path) {
            Ok(c) => c,
            Err(e) => {
                warn!(?rel_path, ?e, "cannot read modified file");
                return Ok(());
            }
        };

        let now = Utc::now().timestamp();
        let title = NoteMeta::title_from_content(&content, rel_path);
        let word_count = NoteMeta::word_count(&content);
        let hash = NoteMeta::content_hash(&content);

        // Check if note already exists in DB
        let exists: bool = self
            .db
            .conn()
            .query_row("SELECT 1 FROM notes WHERE path = ?1", [rel_path], |_| {
                Ok(true)
            })
            .unwrap_or(false);

        if exists {
            // Update existing note
            self.db.conn().execute(
                "UPDATE notes SET title = ?1, modified_at = ?2, word_count = ?3, content_hash = ?4
                 WHERE path = ?5",
                rusqlite::params![title, now, word_count, hash, rel_path],
            )?;

            // Update graph data
            let id: String = self.db.conn().query_row(
                "SELECT id FROM notes WHERE path = ?1",
                [rel_path],
                |row| row.get(0),
            )?;
            let parsed = markdown::parse(&content);
            graph::save_links(&self.db, &id, &parsed.links)?;
            graph::save_headings(&self.db, &id, &parsed.headings)?;
        } else {
            // Insert new note
            let id = Uuid::new_v4().to_string();
            self.db.conn().execute(
                "INSERT INTO notes (id, path, title, created_at, modified_at, word_count, content_hash)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                rusqlite::params![id, rel_path, title, now, now, word_count, hash],
            )?;

            let parsed = markdown::parse(&content);
            graph::save_links(&self.db, &id, &parsed.links)?;
            graph::save_headings(&self.db, &id, &parsed.headings)?;
        }

        // Update search index
        self.search.index_note(rel_path, &title, &content, &[])?;

        info!(?rel_path, "synced modified file");
        Ok(())
    }

    /// SPEC: COMP-FILE-WATCH-001 FR-4
    fn sync_file_deleted(&self, rel_path: &str) -> Result<()> {
        self.db
            .conn()
            .execute("DELETE FROM notes WHERE path = ?1", [rel_path])?;

        self.search.remove_note(rel_path)?;

        info!(?rel_path, "synced deleted file");
        Ok(())
    }

    /// SPEC: COMP-FILE-WATCH-001 FR-5
    fn sync_file_renamed(&self, from_path: &str, to_path: &str) -> Result<()> {
        // Update database path
        self.db.conn().execute(
            "UPDATE notes SET path = ?1 WHERE path = ?2",
            rusqlite::params![to_path, from_path],
        )?;

        // Update search index (remove old, add new)
        let content = std::fs::read_to_string(self.root.join(to_path)).unwrap_or_default();
        let title = NoteMeta::title_from_content(&content, to_path);

        self.search.remove_note(from_path)?;
        self.search.index_note(to_path, &title, &content, &[])?;

        info!(?from_path, ?to_path, "synced renamed file");
        Ok(())
    }
}

/// Check if a walkdir entry is a hidden file/directory (starts with dot).
/// Skips depth 0 (the root directory itself) since TempDir and other
/// paths may start with a dot.
fn is_hidden(entry: &walkdir::DirEntry) -> bool {
    entry.depth() > 0
        && entry
            .file_name()
            .to_str()
            .is_some_and(|s| s.starts_with('.'))
}

/// Validate that a note path is safe (no traversal, ends in .md).
fn validate_note_path(path: &str) -> Result<()> {
    validate_relative_path(path)?;
    if !path.ends_with(".md") {
        return Err(VaultError::InvalidPath(format!(
            "{path}: must end with .md"
        )));
    }
    Ok(())
}

/// Validate that a path is a safe relative path in the vault.
fn validate_relative_path(path: &str) -> Result<()> {
    if path.is_empty()
        || path == "."
        || path.contains("..")
        || path.starts_with('/')
        || path.starts_with('\\')
    {
        return Err(VaultError::InvalidPath(path.to_string()));
    }

    Ok(())
}

/// Apply RFC 7396 JSON merge patch semantics to `target` using `patch`.
fn apply_json_merge_patch(target: &mut serde_json::Value, patch: &serde_json::Value) {
    match patch {
        serde_json::Value::Object(patch_obj) => {
            if !target.is_object() {
                *target = serde_json::Value::Object(serde_json::Map::new());
            }

            let target_obj = target
                .as_object_mut()
                .expect("target must be object after object initialization");

            for (key, patch_value) in patch_obj {
                if patch_value.is_null() {
                    target_obj.remove(key);
                } else {
                    apply_json_merge_patch(
                        target_obj
                            .entry(key.clone())
                            .or_insert(serde_json::Value::Null),
                        patch_value,
                    );
                }
            }
        }
        _ => *target = patch.clone(),
    }
}

fn initialize_plugin_runtime(vault_dir: &Path) -> Result<PluginRuntime> {
    #[cfg(test)]
    if FORCE_PLUGIN_RUNTIME_INIT_FAILURE.with(|flag| flag.get()) {
        return Err(VaultError::Other(
            "forced plugin runtime init failure".to_string(),
        ));
    }

    let runtime = PluginRuntime::new()?;

    let plugins_dir = vault_dir.join("plugins");
    if plugins_dir.exists() {
        for entry in std::fs::read_dir(&plugins_dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() {
                match runtime.load_plugin(&path) {
                    Ok(name) => info!(?name, "Auto-loaded plugin"),
                    Err(e) => warn!(?path, ?e, "Failed to load plugin"),
                }
            }
        }
    }

    Ok(runtime)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;
    use tempfile::TempDir;

    fn create_test_vault() -> (TempDir, Vault) {
        let dir = TempDir::new().unwrap();
        let vault = Vault::create(dir.path()).unwrap();
        (dir, vault)
    }

    #[test]
    fn create_and_open_vault() {
        let dir = TempDir::new().unwrap();
        {
            let _vault = Vault::create(dir.path()).unwrap();

            // .vault directory should exist
            assert!(dir.path().join(".vault").exists());
            assert!(dir.path().join(".vault/config.toml").exists());
            assert!(dir.path().join(".vault/metadata.db").exists());
        }

        // Should be able to reopen (after dropping the first vault to release the index lock)
        let vault = Vault::open(dir.path()).unwrap();
        assert_eq!(vault.config().name, "My Vault");
    }

    #[test]
    fn create_vault_fails_if_exists() {
        let dir = TempDir::new().unwrap();
        Vault::create(dir.path()).unwrap();
        assert!(matches!(
            Vault::create(dir.path()),
            Err(VaultError::AlreadyExists(_))
        ));
    }

    #[test]
    fn open_nonexistent_vault_fails() {
        let dir = TempDir::new().unwrap();
        assert!(matches!(
            Vault::open(dir.path()),
            Err(VaultError::NotFound(_))
        ));
    }

    #[test]
    fn create_and_read_note() {
        let (_dir, vault) = create_test_vault();
        let meta = vault.create_note("test.md", "# Hello\n\nWorld").unwrap();

        assert_eq!(meta.title, "Hello");
        assert_eq!(meta.word_count, 3); // "#", "Hello", "World"

        let note = vault.read_note("test.md").unwrap();
        assert_eq!(note.content, "# Hello\n\nWorld");
        assert_eq!(note.meta.path, "test.md");
    }

    #[test]
    fn create_note_in_subdirectory() {
        let (_dir, vault) = create_test_vault();
        vault
            .create_note("Projects/botpane.md", "# BotPane\n\nA note app.")
            .unwrap();

        let note = vault.read_note("Projects/botpane.md").unwrap();
        assert_eq!(note.meta.title, "BotPane");
    }

    #[test]
    fn update_note() {
        let (_dir, vault) = create_test_vault();
        vault.create_note("test.md", "# Old Title").unwrap();

        let meta = vault
            .update_note("test.md", "# New Title\n\nUpdated.")
            .unwrap();
        assert_eq!(meta.title, "New Title");

        let note = vault.read_note("test.md").unwrap();
        assert_eq!(note.content, "# New Title\n\nUpdated.");
    }

    #[test]
    fn delete_note() {
        let (dir, vault) = create_test_vault();
        vault.create_note("delete-me.md", "# Delete Me").unwrap();
        assert!(dir.path().join("delete-me.md").exists());

        vault.delete_note("delete-me.md").unwrap();
        assert!(!dir.path().join("delete-me.md").exists());

        // Should not be in DB either
        assert!(vault.list_notes().unwrap().is_empty());
    }

    #[test]
    fn move_note() {
        let (dir, vault) = create_test_vault();
        vault.create_note("old.md", "# Moving Note").unwrap();

        let meta = vault.move_note("old.md", "Archive/old.md").unwrap();
        assert_eq!(meta.path, "Archive/old.md");

        assert!(!dir.path().join("old.md").exists());
        assert!(dir.path().join("Archive/old.md").exists());

        let note = vault.read_note("Archive/old.md").unwrap();
        assert_eq!(note.content, "# Moving Note");
    }

    #[test]
    fn list_notes() {
        let (_dir, vault) = create_test_vault();
        vault.create_note("a.md", "# A").unwrap();
        vault.create_note("b.md", "# B").unwrap();
        vault.create_note("sub/c.md", "# C").unwrap();

        let notes = vault.list_notes().unwrap();
        assert_eq!(notes.len(), 3);
        assert_eq!(notes[0].path, "a.md");
        assert_eq!(notes[1].path, "b.md");
        assert_eq!(notes[2].path, "sub/c.md");
    }

    #[test]
    fn scan_files() {
        let (dir, vault) = create_test_vault();
        // Create files directly on disk (simulating external creation)
        std::fs::write(dir.path().join("note1.md"), "hello").unwrap();
        std::fs::create_dir_all(dir.path().join("sub")).unwrap();
        std::fs::write(dir.path().join("sub/note2.md"), "world").unwrap();
        // Non-markdown file should be ignored
        std::fs::write(dir.path().join("readme.txt"), "text").unwrap();

        let files = vault.scan_files().unwrap();
        assert_eq!(files.len(), 2);
        assert!(files.contains(&"note1.md".to_string()));
        assert!(files.contains(&"sub/note2.md".to_string()));
    }

    #[test]
    fn note_type_red_scan_files_includes_known_image_files() {
        let (dir, vault) = create_test_vault();
        std::fs::write(dir.path().join("photo.png"), b"not-a-real-png").unwrap();

        let files = vault.scan_files().unwrap();

        assert!(files.contains(&"photo.png".to_string()));
    }

    #[test]
    fn note_type_red_sync_imports_svg_files_as_notes() {
        let (dir, vault) = create_test_vault();
        std::fs::write(
            dir.path().join("diagram.svg"),
            r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>"#,
        )
        .unwrap();

        vault.sync_files_to_db().unwrap();

        let notes = vault.list_notes().unwrap();
        assert!(notes.iter().any(|note| note.path == "diagram.svg"));
    }

    #[test]
    fn create_note_extracts_links() {
        let (_dir, vault) = create_test_vault();
        vault
            .create_note("a.md", "# A\n\nSee [[b.md]] and [c](c.md).")
            .unwrap();
        vault
            .create_note("b.md", "# B\n\nBack to [[a.md]].")
            .unwrap();

        let forward = vault.get_forward_links("a.md").unwrap();
        assert_eq!(forward.len(), 2);

        let backlinks = vault.get_backlinks("a.md").unwrap();
        assert_eq!(backlinks.len(), 1);
        assert_eq!(backlinks[0].source_path, "b.md");
    }

    #[test]
    fn update_note_refreshes_links() {
        let (_dir, vault) = create_test_vault();
        vault
            .create_note("a.md", "# A\n\nLink to [[b.md]].")
            .unwrap();

        let forward = vault.get_forward_links("a.md").unwrap();
        assert_eq!(forward.len(), 1);

        // Update to link to c.md instead
        vault
            .update_note("a.md", "# A\n\nNow links to [[c.md]].")
            .unwrap();

        let forward = vault.get_forward_links("a.md").unwrap();
        assert_eq!(forward.len(), 1);
        assert_eq!(forward[0].target, "c.md");
    }

    #[test]
    fn create_note_extracts_headings() {
        let (_dir, vault) = create_test_vault();
        vault
            .create_note("a.md", "# Title\n\n## Section\n\n### Sub")
            .unwrap();

        let headings = vault.get_headings("a.md").unwrap();
        assert_eq!(headings.len(), 3);
        assert_eq!(headings[0].text, "Title");
        assert_eq!(headings[0].level, 1);
        assert_eq!(headings[1].text, "Section");
        assert_eq!(headings[2].text, "Sub");
    }

    #[test]
    fn render_note_produces_html() {
        let (_dir, vault) = create_test_vault();
        vault
            .create_note("a.md", "# Hello\n\n**Bold** text.")
            .unwrap();

        let html = vault.render_note("a.md").unwrap();
        assert!(html.contains("<h1>"));
        assert!(html.contains("<strong>Bold</strong>"));
    }

    #[test]
    fn create_vault_imports_existing_files() {
        let dir = TempDir::new().unwrap();

        // Pre-populate directory with markdown files
        std::fs::create_dir_all(dir.path().join("Notes")).unwrap();
        std::fs::write(dir.path().join("hello.md"), "# Hello\n\nWorld").unwrap();
        std::fs::write(
            dir.path().join("Notes/deep.md"),
            "# Deep Note\n\nLink to [[hello.md]].",
        )
        .unwrap();

        // Create vault over existing directory
        let vault = Vault::create(dir.path()).unwrap();

        let notes = vault.list_notes().unwrap();
        assert_eq!(notes.len(), 2);

        // Notes should have correct titles from content
        let titles: Vec<&str> = notes.iter().map(|n| n.title.as_str()).collect();
        assert!(titles.contains(&"Hello"));
        assert!(titles.contains(&"Deep Note"));

        // Links should be parsed
        let forward = vault.get_forward_links("Notes/deep.md").unwrap();
        assert_eq!(forward.len(), 1);
        assert_eq!(forward[0].target, "hello.md");
    }

    #[test]
    fn open_vault_imports_new_files() {
        let dir = TempDir::new().unwrap();

        // Create empty vault
        let vault = Vault::create(dir.path()).unwrap();
        assert!(vault.list_notes().unwrap().is_empty());
        drop(vault);

        // Add files on disk while vault is closed
        std::fs::write(
            dir.path().join("added.md"),
            "# Added Externally\n\nSome content.",
        )
        .unwrap();

        // Reopen vault — should pick up the new file
        let vault = Vault::open(dir.path()).unwrap();
        let notes = vault.list_notes().unwrap();
        assert_eq!(notes.len(), 1);
        assert_eq!(notes[0].title, "Added Externally");
    }

    #[test]
    fn open_vault_removes_stale_entries() {
        let dir = TempDir::new().unwrap();

        let vault = Vault::create(dir.path()).unwrap();
        vault.create_note("temp.md", "# Temporary").unwrap();
        assert_eq!(vault.list_notes().unwrap().len(), 1);
        drop(vault);

        // Delete the file on disk while vault is closed
        std::fs::remove_file(dir.path().join("temp.md")).unwrap();

        // Reopen — stale DB entry should be cleaned up
        let vault = Vault::open(dir.path()).unwrap();
        assert!(vault.list_notes().unwrap().is_empty());
    }

    #[test]
    fn graph_layout_returns_nodes_and_edges() {
        let (_dir, vault) = create_test_vault();
        vault
            .create_note("a.md", "# A\n\nLink to [[b.md]].")
            .unwrap();
        vault
            .create_note("b.md", "# B\n\nLink to [[c.md]] and [[a.md]].")
            .unwrap();
        vault.create_note("c.md", "# C\n\nStandalone.").unwrap();

        let layout = vault.graph_layout(800.0, 600.0).unwrap();

        // 3 notes in graph (a, b, c)
        assert_eq!(layout.nodes.len(), 3);
        // a->b, b->c, b->a = 3 edges
        assert_eq!(layout.edges.len(), 3);

        // All positions within bounds
        for node in &layout.nodes {
            assert!(node.x >= 0.0 && node.x <= 800.0);
            assert!(node.y >= 0.0 && node.y <= 600.0);
        }
    }

    #[test]
    fn path_traversal_rejected() {
        let (_dir, vault) = create_test_vault();
        assert!(matches!(
            vault.create_note("../escape.md", "bad"),
            Err(VaultError::InvalidPath(_))
        ));
        assert!(matches!(
            vault.create_note("/absolute.md", "bad"),
            Err(VaultError::InvalidPath(_))
        ));
        assert!(matches!(
            vault.create_note("no_extension", "bad"),
            Err(VaultError::InvalidPath(_))
        ));
        assert!(matches!(
            vault.create_directory("../escape"),
            Err(VaultError::InvalidPath(_))
        ));
        assert!(matches!(
            vault.delete_directory("/absolute", true),
            Err(VaultError::InvalidPath(_))
        ));
    }

    #[test]
    fn create_directory_creates_nested_path() {
        let (dir, vault) = create_test_vault();

        vault.create_directory("Projects/2026/Ideas").unwrap();

        assert!(dir.path().join("Projects/2026/Ideas").is_dir());
    }

    #[test]
    fn delete_directory_recursive_removes_tree() {
        let (dir, vault) = create_test_vault();
        vault.create_note("Archive/old/note.md", "# Old").unwrap();

        vault.delete_directory("Archive", true).unwrap();

        assert!(!dir.path().join("Archive").exists());
    }

    #[test]
    fn delete_directory_non_recursive_fails_on_non_empty() {
        let (dir, vault) = create_test_vault();
        vault.create_note("Projects/note.md", "# Note").unwrap();

        assert!(vault.delete_directory("Projects", false).is_err());
        assert!(dir.path().join("Projects").exists());
    }

    #[test]
    fn update_vault_settings_patch_updates_selected_fields_only() {
        let (_dir, mut vault) = create_test_vault();

        let updated = vault
            .update_vault_settings_patch(r#"{"editor":{"font_size":18}}"#)
            .unwrap();
        let value: Value = serde_json::from_str(&updated).unwrap();

        assert_eq!(value["editor"]["font_size"], 18);
        assert_eq!(value["editor"]["tab_size"], 4);
        assert_eq!(value["name"], "My Vault");
        assert_eq!(value["sync"]["enabled"], false);
    }

    #[test]
    fn update_vault_settings_persists_to_config_file() {
        let (dir, mut vault) = create_test_vault();

        vault
            .update_vault_settings_patch(r#"{"name":"Team Vault","plugins_enabled":true}"#)
            .unwrap();

        drop(vault);
        let reopened = Vault::open(dir.path()).unwrap();

        assert_eq!(reopened.config().name, "Team Vault");
        assert!(reopened.config().plugins_enabled);
    }

    #[test]
    fn update_vault_settings_patch_toggles_plugin_runtime() {
        let (_dir, mut vault) = create_test_vault();
        assert!(vault.plugins().is_none());

        vault
            .update_vault_settings_patch(r#"{"plugins_enabled":true}"#)
            .unwrap();
        assert!(vault.plugins().is_some());

        vault
            .update_vault_settings_patch(r#"{"plugins_enabled":false}"#)
            .unwrap();
        assert!(vault.plugins().is_none());
    }

    #[test]
    fn update_vault_settings_patch_enable_failure_keeps_state_consistent() {
        let (dir, mut vault) = create_test_vault();
        assert!(!vault.config().plugins_enabled);
        assert!(vault.plugins().is_none());

        FORCE_PLUGIN_RUNTIME_INIT_FAILURE.with(|flag| flag.set(true));
        let result = vault.update_vault_settings_patch(r#"{"plugins_enabled":true}"#);
        FORCE_PLUGIN_RUNTIME_INIT_FAILURE.with(|flag| flag.set(false));

        assert!(result.is_err());
        assert!(!vault.config().plugins_enabled);
        assert!(vault.plugins().is_none());

        let config_path = dir.path().join(".vault").join("config.toml");
        let persisted = VaultConfig::load(&config_path).unwrap();
        assert!(!persisted.plugins_enabled);
    }

    #[test]
    fn search_notes_in_vault() {
        let (_dir, vault) = create_test_vault();
        vault
            .create_note(
                "rust.md",
                "# Rust\n\nRust is a systems programming language.",
            )
            .unwrap();
        vault
            .create_note(
                "python.md",
                "# Python\n\nPython is an interpreted language.",
            )
            .unwrap();

        let results = vault.search_notes("rust", 10).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].path, "rust.md");
    }

    #[test]
    fn search_works_after_vault_reopen() {
        let dir = TempDir::new().unwrap();
        {
            let vault = Vault::create(dir.path()).unwrap();
            vault
                .create_note(
                    "test.md",
                    "# Searchable\n\nThis content should be findable after reopen.",
                )
                .unwrap();
        }

        let vault = Vault::open(dir.path()).unwrap();
        let results = vault.search_notes("searchable", 10).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].path, "test.md");
    }

    #[test]
    fn search_updated_after_note_edit() {
        let (_dir, vault) = create_test_vault();
        vault
            .create_note("a.md", "# Original\n\nUniqueWordAlpha content here.")
            .unwrap();

        let results = vault.search_notes("UniqueWordAlpha", 10).unwrap();
        assert_eq!(results.len(), 1);

        vault
            .update_note("a.md", "# Changed\n\nUniqueWordBeta different content.")
            .unwrap();

        let results = vault.search_notes("UniqueWordAlpha", 10).unwrap();
        assert!(results.is_empty());

        let results = vault.search_notes("UniqueWordBeta", 10).unwrap();
        assert_eq!(results.len(), 1);
    }

    #[test]
    fn search_updated_after_note_delete() {
        let (_dir, vault) = create_test_vault();
        vault
            .create_note("a.md", "# Deleteable\n\nUniqueDeleteTarget content.")
            .unwrap();

        let results = vault.search_notes("UniqueDeleteTarget", 10).unwrap();
        assert_eq!(results.len(), 1);

        vault.delete_note("a.md").unwrap();

        let results = vault.search_notes("UniqueDeleteTarget", 10).unwrap();
        assert!(results.is_empty());
    }

    #[test]
    fn list_tags_returns_all_tags() {
        let (_dir, vault) = create_test_vault();

        // Insert tags directly into database
        vault
            .db
            .conn()
            .execute(
                "INSERT INTO tags (name) VALUES ('rust'), ('python'), ('mcp')",
                [],
            )
            .unwrap();

        let tags = vault.list_tags().unwrap();
        assert_eq!(tags.len(), 3);
        assert!(tags.contains(&"rust".to_string()));
        assert!(tags.contains(&"python".to_string()));
        assert!(tags.contains(&"mcp".to_string()));
    }

    #[test]
    fn list_tags_empty_vault() {
        let (_dir, vault) = create_test_vault();
        let tags = vault.list_tags().unwrap();
        assert!(tags.is_empty());
    }

    #[test]
    fn get_graph_neighbors_depth_1() {
        let (_dir, vault) = create_test_vault();
        // Create a simple graph: a -> b -> c, a -> c
        vault
            .create_note("a.md", "# A\n\nLinks to [[b.md]] and [[c.md]].")
            .unwrap();
        vault
            .create_note("b.md", "# B\n\nLinks to [[c.md]].")
            .unwrap();
        vault.create_note("c.md", "# C\n\nNo links.").unwrap();

        // From a.md with depth 1, should get a, b, c
        let (nodes, edges) = vault.get_graph_neighbors("a.md", 1).unwrap();
        assert!(nodes.contains(&"a.md".to_string()));
        assert!(nodes.contains(&"b.md".to_string()));
        assert!(nodes.contains(&"c.md".to_string()));

        // Should have edges: a->b, a->c (b->c is depth 2 from a)
        assert!(edges.contains(&("a.md".to_string(), "b.md".to_string())));
        assert!(edges.contains(&("a.md".to_string(), "c.md".to_string())));
    }

    #[test]
    fn get_graph_neighbors_depth_2() {
        let (_dir, vault) = create_test_vault();
        // Create a chain: a -> b -> c -> d
        vault
            .create_note("a.md", "# A\n\nLink to [[b.md]].")
            .unwrap();
        vault
            .create_note("b.md", "# B\n\nLink to [[c.md]].")
            .unwrap();
        vault
            .create_note("c.md", "# C\n\nLink to [[d.md]].")
            .unwrap();
        vault.create_note("d.md", "# D\n\nEnd.").unwrap();

        // From a.md with depth 2, should get a, b, c (not d)
        let (nodes, _edges) = vault.get_graph_neighbors("a.md", 2).unwrap();
        assert!(nodes.contains(&"a.md".to_string()));
        assert!(nodes.contains(&"b.md".to_string()));
        assert!(nodes.contains(&"c.md".to_string()));
        assert!(!nodes.contains(&"d.md".to_string()));
    }

    #[test]
    fn get_graph_neighbors_includes_backlinks() {
        let (_dir, vault) = create_test_vault();
        // Create mutual links: a <-> b
        vault
            .create_note("a.md", "# A\n\nLink to [[b.md]].")
            .unwrap();
        vault
            .create_note("b.md", "# B\n\nLink to [[a.md]].")
            .unwrap();

        // From a.md with depth 1, should get both a and b
        let (nodes, edges) = vault.get_graph_neighbors("a.md", 1).unwrap();

        assert_eq!(nodes.len(), 2);
        assert!(nodes.contains(&"a.md".to_string()));
        assert!(nodes.contains(&"b.md".to_string()));

        // Should have a->b from a's forward links
        assert!(edges.contains(&("a.md".to_string(), "b.md".to_string())));
        // b->a comes from b's forward links when we visit b
        let has_b_to_a = edges.iter().any(|(s, t)| s == "b.md" && t == "a.md");
        assert!(
            has_b_to_a,
            "Expected edge b.md -> a.md not found in {:?}",
            edges
        );
    }

    #[test]
    fn get_graph_neighbors_nonexistent_note() {
        let (_dir, vault) = create_test_vault();

        let result = vault.get_graph_neighbors("nonexistent.md", 1);
        assert!(matches!(result, Err(VaultError::NoteNotFound(_))));
    }
}
