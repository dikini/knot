use crate::markdown::Heading;
use serde::{Deserialize, Serialize};

/// SPEC: COMP-NOTE-001 FR-7, FR-8, FR-9
/// Metadata about a note stored in the database.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteMeta {
    pub id: String,
    pub path: String,
    pub title: String,
    pub created_at: i64,
    pub modified_at: i64,
    pub word_count: usize,
    pub content_hash: Option<String>,
}

/// A note with both metadata and content.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    #[serde(flatten)]
    pub meta: NoteMeta,
    pub content: String,
}

impl Note {
    /// SPEC: COMP-NOTE-001 FR-3
    /// Create a new note from path and content.
    pub fn new(path: &str, content: &str) -> Self {
        let id = uuid::Uuid::new_v4().to_string();
        let title = NoteMeta::title_from_content(content, path);
        let word_count = NoteMeta::word_count(content) as usize;
        let content_hash = Some(NoteMeta::content_hash(content));

        let now = chrono::Utc::now().timestamp();

        Self {
            meta: NoteMeta {
                id,
                path: path.to_string(),
                title,
                created_at: now,
                modified_at: now,
                word_count,
                content_hash,
            },
            content: content.to_string(),
        }
    }

    /// Get the note ID.
    pub fn id(&self) -> &str {
        &self.meta.id
    }

    /// Get the note path.
    pub fn path(&self) -> &str {
        &self.meta.path
    }

    /// Get the note title.
    pub fn title(&self) -> &str {
        &self.meta.title
    }

    /// Get the note content.
    pub fn content(&self) -> &str {
        &self.content
    }

    /// Get the created timestamp.
    pub fn created_at(&self) -> i64 {
        self.meta.created_at
    }

    /// Get the modified timestamp.
    pub fn modified_at(&self) -> i64 {
        self.meta.modified_at
    }

    /// Get the word count.
    pub fn word_count(&self) -> usize {
        self.meta.word_count
    }

    /// Extract headings from the note content.
    pub fn headings(&self) -> Vec<Heading> {
        crate::markdown::extract_headings(&self.content)
    }
}

impl NoteMeta {
    /// SPEC: COMP-NOTE-001 FR-7
    /// Extract title from the first line of markdown content.
    /// Uses the first `# Heading` or falls back to the filename.
    pub fn title_from_content(content: &str, path: &str) -> String {
        for line in content.lines() {
            let trimmed = line.trim();
            if let Some(heading) = trimmed.strip_prefix("# ") {
                return heading.trim().to_string();
            }
        }
        // Fallback: filename without extension
        std::path::Path::new(path)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Untitled")
            .to_string()
    }

    /// SPEC: COMP-NOTE-001 FR-8
    /// Count words in content.
    pub fn word_count(content: &str) -> i64 {
        content.split_whitespace().count() as i64
    }

    /// SPEC: COMP-NOTE-001 FR-9
    /// Compute a simple hash of content for change detection.
    pub fn content_hash(content: &str) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        let mut hasher = DefaultHasher::new();
        content.hash(&mut hasher);
        format!("{:016x}", hasher.finish())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn title_from_heading() {
        let content = "# My Note\n\nSome content here.";
        assert_eq!(NoteMeta::title_from_content(content, "note.md"), "My Note");
    }

    #[test]
    fn title_from_filename() {
        let content = "No heading here, just text.";
        assert_eq!(
            NoteMeta::title_from_content(content, "my-ideas.md"),
            "my-ideas"
        );
    }

    #[test]
    fn word_count_basic() {
        assert_eq!(NoteMeta::word_count("hello world"), 2);
        assert_eq!(NoteMeta::word_count(""), 0);
        assert_eq!(NoteMeta::word_count("one two three four"), 4);
    }

    #[test]
    fn content_hash_deterministic() {
        let h1 = NoteMeta::content_hash("hello");
        let h2 = NoteMeta::content_hash("hello");
        let h3 = NoteMeta::content_hash("world");
        assert_eq!(h1, h2);
        assert_ne!(h1, h3);
    }
}
