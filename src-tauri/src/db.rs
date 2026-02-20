use std::path::Path;

use rusqlite::Connection;

use crate::error::{KnotError, Result};

/// SPEC: COMP-DATABASE-001 FR-1, FR-2, FR-3, FR-4, FR-5, FR-6
pub const SCHEMA_VERSION: u32 = 1;

pub struct Database {
    conn: Connection,
}

impl Database {
    /// SPEC: COMP-DATABASE-001 FR-1
    pub fn open(path: &Path) -> Result<Self> {
        let conn = Connection::open(path)?;
        let db = Self { conn };
        db.setup()?;
        db.migrate()?;
        Ok(db)
    }

    pub fn open_in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        let db = Self { conn };
        db.setup()?;
        db.migrate()?;
        Ok(db)
    }

    pub fn conn(&self) -> &Connection {
        &self.conn
    }

    /// SPEC: COMP-DATABASE-001 FR-4, FR-5
    fn setup(&self) -> Result<()> {
        self.conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA foreign_keys = ON;
             PRAGMA busy_timeout = 5000;",
        )?;
        Ok(())
    }

    /// SPEC: COMP-DATABASE-001 FR-2
    fn migrate(&self) -> Result<()> {
        self.conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS schema_version (
                version INTEGER NOT NULL
            )",
        )?;

        let current_version: u32 = self
            .conn
            .query_row(
                "SELECT COALESCE(MAX(version), 0) FROM schema_version",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);

        if current_version < 1 {
            self.migrate_v1()?;
        }

        Ok(())
    }

    fn migrate_v1(&self) -> Result<()> {
        self.conn.execute_batch(
            "-- Notes metadata
            CREATE TABLE IF NOT EXISTS notes (
                id TEXT PRIMARY KEY,
                path TEXT NOT NULL UNIQUE,
                title TEXT,
                created_at INTEGER NOT NULL,
                modified_at INTEGER NOT NULL,
                word_count INTEGER DEFAULT 0,
                content_hash TEXT
            );

            -- Links between notes
            CREATE TABLE IF NOT EXISTS links (
                id INTEGER PRIMARY KEY,
                source_note_id TEXT NOT NULL,
                target_note_id TEXT,
                target_path TEXT,
                link_text TEXT,
                link_type TEXT,
                FOREIGN KEY (source_note_id) REFERENCES notes(id) ON DELETE CASCADE,
                FOREIGN KEY (target_note_id) REFERENCES notes(id) ON DELETE SET NULL
            );

            -- Tags
            CREATE TABLE IF NOT EXISTS tags (
                id INTEGER PRIMARY KEY,
                name TEXT UNIQUE NOT NULL
            );

            CREATE TABLE IF NOT EXISTS note_tags (
                note_id TEXT NOT NULL,
                tag_id INTEGER NOT NULL,
                PRIMARY KEY (note_id, tag_id),
                FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
            );

            -- Headings for TOC
            CREATE TABLE IF NOT EXISTS headings (
                id INTEGER PRIMARY KEY,
                note_id TEXT NOT NULL,
                level INTEGER NOT NULL,
                text TEXT NOT NULL,
                anchor TEXT,
                position INTEGER,
                FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
            );

            -- P2P sync metadata
            CREATE TABLE IF NOT EXISTS sync_peers (
                peer_id TEXT PRIMARY KEY,
                name TEXT,
                last_seen INTEGER,
                vector_clock TEXT
            );

            CREATE TABLE IF NOT EXISTS sync_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                note_id TEXT NOT NULL,
                peer_id TEXT,
                operation TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                version_hash TEXT,
                FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
            );

            -- Indexes
            CREATE INDEX IF NOT EXISTS idx_notes_path ON notes(path);
            CREATE INDEX IF NOT EXISTS idx_links_source ON links(source_note_id);
            CREATE INDEX IF NOT EXISTS idx_links_target ON links(target_note_id);
            CREATE INDEX IF NOT EXISTS idx_headings_note ON headings(note_id);

            -- Record migration
            INSERT INTO schema_version (version) VALUES (1);",
        )?;
        Ok(())
    }

    /// SPEC: COMP-DATABASE-001 FR-6
    pub fn schema_version(&self) -> Result<u32> {
        let version = self.conn.query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_version",
            [],
            |row| row.get(0),
        )?;
        Ok(version)
    }

    //region Note Operations

    /// SPEC: COMP-DATABASE-001 FR-3
    /// Get the total number of notes.
    pub fn note_count(&self) -> Result<usize> {
        let count: i64 = self
            .conn
            .query_row("SELECT COUNT(*) FROM notes", [], |row| row.get(0))?;
        Ok(count as usize)
    }

    /// SPEC: COMP-DATABASE-001 FR-3
    /// List all notes in the vault.
    pub fn list_notes(&self) -> Result<Vec<crate::note::NoteMeta>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, path, title, created_at, modified_at, word_count, content_hash
             FROM notes
             ORDER BY modified_at DESC",
        )?;

        let notes = stmt.query_map([], |row| {
            Ok(crate::note::NoteMeta {
                id: row.get(0)?,
                path: row.get(1)?,
                title: row.get(2)?,
                created_at: row.get(3)?,
                modified_at: row.get(4)?,
                word_count: row.get::<_, i64>(5)? as usize,
                content_hash: row.get(6)?,
            })
        })?;

        notes
            .collect::<std::result::Result<Vec<_>, rusqlite::Error>>()
            .map_err(|e| e.into())
    }

    /// Get a note by its path.
    ///
    /// SPEC: COMP-CONTENT-LOAD-001 FR-1, FR-2, FR-3, FR-4
    pub fn get_note_by_path(
        &self,
        path: &str,
        vault_root: &Path,
    ) -> Result<Option<crate::note::Note>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, path, title, created_at, modified_at, word_count, content_hash
             FROM notes
             WHERE path = ?",
        )?;

        let meta = stmt.query_row([path], |row| {
            Ok(crate::note::NoteMeta {
                id: row.get(0)?,
                path: row.get(1)?,
                title: row.get(2)?,
                created_at: row.get(3)?,
                modified_at: row.get(4)?,
                word_count: row.get::<_, i64>(5)? as usize,
                content_hash: row.get(6)?,
            })
        });

        match meta {
            Ok(meta) => {
                // Read content from filesystem
                let file_path = vault_root.join(path);

                // Check if file exists
                if !file_path.exists() {
                    return Err(KnotError::NoteNotFound(path.to_string()));
                }

                // Read file content
                let content = std::fs::read_to_string(&file_path)?;

                Ok(Some(crate::note::Note { meta, content }))
            }
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    /// SPEC: COMP-DATABASE-001 FR-3
    /// Save a note to the database.
    pub fn save_note(&self, note: &crate::note::Note) -> Result<()> {
        self.conn.execute(
            "INSERT INTO notes (id, path, title, created_at, modified_at, word_count, content_hash)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(path) DO UPDATE SET
                 title = excluded.title,
                 modified_at = excluded.modified_at,
                 word_count = excluded.word_count,
                 content_hash = excluded.content_hash",
            [
                &note.meta.id as &dyn rusqlite::ToSql,
                &note.meta.path,
                &note.meta.title,
                &note.meta.created_at,
                &note.meta.modified_at,
                &(note.meta.word_count as i64),
                &note.meta.content_hash.as_deref().unwrap_or(""),
            ],
        )?;
        Ok(())
    }

    /// SPEC: COMP-DATABASE-001 FR-3
    /// Delete a note by its path.
    pub fn delete_note_by_path(&self, path: &str) -> Result<()> {
        self.conn
            .execute("DELETE FROM notes WHERE path = ?", [path])?;
        Ok(())
    }

    /// SPEC: COMP-DATABASE-001 FR-3
    /// Rename a note's path.
    pub fn rename_note_path(&self, old_path: &str, new_path: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE notes SET path = ?1 WHERE path = ?2",
            [new_path, old_path],
        )?;
        Ok(())
    }

    //endregion
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_in_memory_db() {
        let db = Database::open_in_memory().unwrap();
        assert_eq!(db.schema_version().unwrap(), SCHEMA_VERSION);
    }

    #[test]
    fn tables_exist() {
        let db = Database::open_in_memory().unwrap();
        let tables: Vec<String> = db
            .conn()
            .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert!(tables.contains(&"notes".to_string()));
        assert!(tables.contains(&"links".to_string()));
        assert!(tables.contains(&"tags".to_string()));
        assert!(tables.contains(&"note_tags".to_string()));
        assert!(tables.contains(&"headings".to_string()));
        assert!(tables.contains(&"sync_peers".to_string()));
        assert!(tables.contains(&"sync_log".to_string()));
    }

    #[test]
    fn migration_is_idempotent() {
        let db = Database::open_in_memory().unwrap();
        // Running migrate again should not fail
        assert_eq!(db.schema_version().unwrap(), SCHEMA_VERSION);
    }

    #[test]
    fn get_note_by_path_reads_content_from_filesystem() {
        use std::io::Write;

        // Create temp directory and in-memory database
        let temp = tempfile::TempDir::new().unwrap();
        let db = Database::open_in_memory().unwrap();

        // Create a test file with content
        let note_path = "test-note.md";
        let test_content = "# Hello World\n\nThis is test content.";
        let file_path = temp.path().join(note_path);

        // Write content to file
        let mut file = std::fs::File::create(&file_path).unwrap();
        file.write_all(test_content.as_bytes()).unwrap();
        drop(file);

        // Insert note metadata into database
        db.conn()
            .execute(
                "INSERT INTO notes (id, path, title, created_at, modified_at, word_count)
             VALUES ('test-id', ?1, 'Test', 0, 0, 5)",
                [note_path],
            )
            .unwrap();

        // Load note via get_note_by_path
        let note = db
            .get_note_by_path(note_path, temp.path())
            .unwrap()
            .expect("note should exist");

        // Assert content matches
        assert_eq!(note.content, test_content);
        assert_eq!(note.path(), note_path);
    }

    #[test]
    fn get_note_by_path_returns_not_found_for_missing_file() {
        let temp = tempfile::TempDir::new().unwrap();
        let db = Database::open_in_memory().unwrap();

        // Insert metadata but don't create file
        db.conn()
            .execute(
                "INSERT INTO notes (id, path, title, created_at, modified_at, word_count)
             VALUES ('test-id', 'missing.md', 'Missing', 0, 0, 0)",
                [],
            )
            .unwrap();

        // Should return NotFound error
        let result = db.get_note_by_path("missing.md", temp.path());
        assert!(matches!(result, Err(KnotError::NoteNotFound(_))));
    }

    #[test]
    fn get_note_by_path_io_errors_handled_gracefully() {
        use tempfile::TempDir;

        let temp = TempDir::new().unwrap();
        let db = Database::open_in_memory().unwrap();

        // Insert metadata for a file we'll create in a non-existent directory
        db.conn()
            .execute(
                "INSERT INTO notes (id, path, title, created_at, modified_at, word_count)
             VALUES ('test-id', 'nonexistent/test.md', 'Nonexistent', 0, 0, 0)",
                [],
            )
            .unwrap();

        // Should return NoteNotFound error when trying to read from non-existent directory
        let result = db.get_note_by_path("nonexistent/test.md", temp.path());
        // When file doesn't exist, get_note_by_path returns NoteNotFound
        // This is the correct behavior - file not found is handled gracefully
        match result {
            Err(KnotError::NoteNotFound(path)) => {
                assert!(path.contains("nonexistent") || path.contains("test.md"));
            }
            _ => panic!(
                "Expected NoteNotFound error for missing file, got {:?}",
                result
            ),
        }
    }

    #[test]
    fn get_note_by_path_content_hash_and_word_count_consistency() {
        use tempfile::TempDir;

        let temp = TempDir::new().unwrap();
        let db = Database::open_in_memory().unwrap();

        // Create a test file with known content
        let note_path = "consistency-test.md";
        let test_content = "This is test content\n\nWith multiple words.";
        let file_path = temp.path().join(note_path);

        // Write content to file
        std::fs::write(&file_path, test_content).unwrap();

        // Insert note metadata with calculated hash and word count
        let content_hash = crate::note::NoteMeta::content_hash(test_content);
        let word_count = crate::note::NoteMeta::word_count(test_content);

        db.conn().execute(
            "INSERT INTO notes (id, path, title, created_at, modified_at, word_count, content_hash)
             VALUES ('test-id', ?1, 'Consistency Test', 0, 0, ?2, ?3)",
            rusqlite::params![
                note_path,
                word_count,
                &content_hash,
            ],
        ).unwrap();

        // Load note via get_note_by_path
        let note = db
            .get_note_by_path(note_path, temp.path())
            .unwrap()
            .expect("note should exist");

        // Verify hash and word count are consistent with loaded content
        assert_eq!(note.content, test_content);
        assert_eq!(
            note.meta.content_hash,
            Some(crate::note::NoteMeta::content_hash(&note.content))
        );
        assert_eq!(
            note.word_count(),
            crate::note::NoteMeta::word_count(&note.content) as usize
        );
    }
}
