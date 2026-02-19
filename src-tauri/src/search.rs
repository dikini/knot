//! Full-text search engine with bilingual (English + Bulgarian) support.
//!
//! Wraps Tantivy with custom tokenizers for English stemming and
//! Bulgarian lowercase tokenization. Content is automatically routed
//! to the appropriate language field based on Cyrillic character detection.

use std::path::Path;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tantivy::collector::TopDocs;
use tantivy::directory::MmapDirectory;
use tantivy::query::QueryParser;
use tantivy::schema::*;
use tantivy::snippet::SnippetGenerator;
use tantivy::tokenizer::{LowerCaser, SimpleTokenizer, Stemmer, TextAnalyzer};
use tantivy::{Index, IndexReader, IndexWriter, TantivyDocument};

use crate::error::Result;

/// A search result returned from a query.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    /// Path of the matching note.
    pub path: String,
    /// Title of the matching note.
    pub title: String,
    /// Snippet with highlighted matches.
    pub snippet: String,
    /// Relevance score.
    pub score: f32,
}

/// Full-text search index with bilingual support.
///
/// Uses separate fields for English and Bulgarian content,
/// with automatic language detection based on Cyrillic character ratio.
pub struct SearchIndex {
    index: Index,
    reader: IndexReader,
    writer: Mutex<IndexWriter>,
    // Field handles for quick access
    field_path: Field,
    field_title: Field,
    field_content_en: Field,
    field_content_bg: Field,
    field_tags: Field,
}

impl SearchIndex {
    /// Build the schema and register custom tokenizers on the given index.
    fn setup(index: &Index) -> (Field, Field, Field, Field, Field) {
        // Register custom tokenizers
        let en_stem = TextAnalyzer::builder(SimpleTokenizer::default())
            .filter(LowerCaser)
            .filter(Stemmer::default()) // English
            .build();
        index.tokenizers().register("en_stem", en_stem);

        let bg_lower = TextAnalyzer::builder(SimpleTokenizer::default())
            .filter(LowerCaser)
            .build();
        index.tokenizers().register("bg_lower", bg_lower);

        // The schema is already built into the index at this point,
        // so we just retrieve the field handles.
        let schema = index.schema();
        let field_path = schema.get_field("path").expect("path field");
        let field_title = schema.get_field("title").expect("title field");
        let field_content_en = schema.get_field("content_en").expect("content_en field");
        let field_content_bg = schema.get_field("content_bg").expect("content_bg field");
        let field_tags = schema.get_field("tags").expect("tags field");

        (
            field_path,
            field_title,
            field_content_en,
            field_content_bg,
            field_tags,
        )
    }

    /// Build the Tantivy schema with bilingual fields.
    fn build_schema() -> Schema {
        let mut builder = SchemaBuilder::default();

        // Path: indexed as a single token (for exact match/delete), stored
        builder.add_text_field("path", STRING | STORED);

        // Title: English-stemmed, stored
        let en_indexing = TextFieldIndexing::default()
            .set_tokenizer("en_stem")
            .set_index_option(IndexRecordOption::WithFreqsAndPositions);
        let en_options = TextOptions::default()
            .set_indexing_options(en_indexing)
            .set_stored();
        builder.add_text_field("title", en_options);

        // English content: stemmed, stored
        let en_content_indexing = TextFieldIndexing::default()
            .set_tokenizer("en_stem")
            .set_index_option(IndexRecordOption::WithFreqsAndPositions);
        let en_content_options = TextOptions::default()
            .set_indexing_options(en_content_indexing)
            .set_stored();
        builder.add_text_field("content_en", en_content_options);

        // Bulgarian content: lowercased (no stemmer available), stored
        let bg_indexing = TextFieldIndexing::default()
            .set_tokenizer("bg_lower")
            .set_index_option(IndexRecordOption::WithFreqsAndPositions);
        let bg_options = TextOptions::default()
            .set_indexing_options(bg_indexing)
            .set_stored();
        builder.add_text_field("content_bg", bg_options);

        // Tags: indexed as single tokens (exact match), stored
        builder.add_text_field("tags", STRING | STORED);

        builder.build()
    }

    /// Open or create a search index at the given directory path.
    pub fn open(path: &Path) -> Result<Self> {
        std::fs::create_dir_all(path)?;
        let schema = Self::build_schema();
        let dir = MmapDirectory::open(path).map_err(|e| {
            tantivy::TantivyError::InvalidArgument(format!("failed to open index directory: {e}"))
        })?;
        let index = Index::open_or_create(dir, schema)?;
        let (field_path, field_title, field_content_en, field_content_bg, field_tags) =
            Self::setup(&index);
        let writer = index.writer(50_000_000)?;
        let reader = index.reader()?;

        Ok(Self {
            index,
            reader,
            writer: Mutex::new(writer),
            field_path,
            field_title,
            field_content_en,
            field_content_bg,
            field_tags,
        })
    }

    /// Create a search index in RAM (for testing).
    pub fn open_in_memory() -> Result<Self> {
        let schema = Self::build_schema();
        let index = Index::create_in_ram(schema);
        let (field_path, field_title, field_content_en, field_content_bg, field_tags) =
            Self::setup(&index);
        let writer = index.writer(50_000_000)?;
        let reader = index.reader()?;

        Ok(Self {
            index,
            reader,
            writer: Mutex::new(writer),
            field_path,
            field_title,
            field_content_en,
            field_content_bg,
            field_tags,
        })
    }

    /// Index a note, replacing any existing document with the same path.
    ///
    /// Content is automatically split into English and Bulgarian fields
    /// based on Cyrillic character detection.
    pub fn index_note(
        &self,
        path: &str,
        title: &str,
        content: &str,
        tags: &[String],
    ) -> Result<()> {
        let writer = self.writer.lock().unwrap();

        // Delete old document with this path
        let path_term = Term::from_field_text(self.field_path, path);
        writer.delete_term(path_term);

        // Split content line-by-line into language-specific fields
        let mut en_lines = Vec::new();
        let mut bg_lines = Vec::new();
        for line in content.lines() {
            if is_cyrillic(line) {
                bg_lines.push(line);
            } else {
                en_lines.push(line);
            }
        }
        let en_content = en_lines.join("\n");
        let bg_content = bg_lines.join("\n");

        let mut doc = TantivyDocument::new();
        doc.add_text(self.field_path, path);
        doc.add_text(self.field_title, title);
        doc.add_text(self.field_content_en, &en_content);
        doc.add_text(self.field_content_bg, &bg_content);

        for tag in tags {
            doc.add_text(self.field_tags, tag);
        }

        writer.add_document(doc)?;
        Ok(())
    }

    /// Remove a note from the index by path.
    pub fn remove_note(&self, path: &str) -> Result<()> {
        let writer = self.writer.lock().unwrap();
        let path_term = Term::from_field_text(self.field_path, path);
        writer.delete_term(path_term);
        Ok(())
    }

    /// Commit pending changes and reload the reader.
    pub fn commit(&self) -> Result<()> {
        let mut writer = self.writer.lock().unwrap();
        writer.commit()?;
        self.reader.reload()?;
        Ok(())
    }

    /// Search the index and return ranked results with snippets.
    ///
    /// Supports advanced query syntax:
    /// - `tag:name` - filter by tag
    /// - `"exact phrase"` - phrase search
    /// - `-exclude` - exclude term (NOT)
    /// - `AND`, `OR`, `NOT` - boolean operators
    pub fn search(&self, query_str: &str, limit: usize) -> Result<Vec<SearchResult>> {
        let searcher = self.reader.searcher();

        let query = self.parse_advanced_query(query_str)?;

        let top_docs = searcher.search(&query, &TopDocs::with_limit(limit))?;

        // Build snippet generator for English content field
        let snippet_gen = SnippetGenerator::create(&searcher, &*query, self.field_content_en)?;

        let mut results = Vec::with_capacity(top_docs.len());
        for (score, doc_address) in top_docs {
            let doc: TantivyDocument = searcher.doc(doc_address)?;

            let path = doc
                .get_first(self.field_path)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let title = doc
                .get_first(self.field_title)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let snippet = snippet_gen.snippet_from_doc(&doc);
            let snippet_text = snippet.to_html();

            results.push(SearchResult {
                path,
                title,
                snippet: snippet_text,
                score,
            });
        }

        Ok(results)
    }

    /// Parse an advanced query string into a Tantivy query.
    ///
    /// Supports:
    /// - `tag:name` - filter by tag
    /// - `"exact phrase"` - phrase search
    /// - `-exclude` or `NOT exclude` - exclude term
    /// - `term1 AND term2` - both must match
    /// - `term1 OR term2` - either can match
    fn parse_advanced_query(&self, query_str: &str) -> Result<Box<dyn tantivy::query::Query>> {
        use tantivy::query::{BooleanQuery, Occur, TermQuery};
        use tantivy::schema::IndexRecordOption;

        let query_str = query_str.trim();
        if query_str.is_empty() {
            // Return a query that matches nothing
            return Ok(Box::new(TermQuery::new(
                Term::from_field_text(self.field_path, ""),
                IndexRecordOption::Basic,
            )));
        }

        // Parse the query into components
        let components = self.parse_query_components(query_str)?;

        // Build boolean query from components
        let mut clauses: Vec<(Occur, Box<dyn tantivy::query::Query>)> = Vec::new();

        for component in components {
            match component {
                QueryComponent::Include { term, is_phrase } => {
                    let query = self.build_term_query(&term, is_phrase)?;
                    clauses.push((Occur::Must, query));
                }
                QueryComponent::Exclude { term, is_phrase } => {
                    let query = self.build_term_query(&term, is_phrase)?;
                    clauses.push((Occur::MustNot, query));
                }
                QueryComponent::Tag { tag } => {
                    let term = Term::from_field_text(self.field_tags, &tag);
                    let query = Box::new(TermQuery::new(term, IndexRecordOption::Basic));
                    clauses.push((Occur::Must, query));
                }
                QueryComponent::OrGroup { components } => {
                    let mut or_clauses: Vec<(Occur, Box<dyn tantivy::query::Query>)> = Vec::new();
                    for comp in components {
                        if let QueryComponent::Include { term, is_phrase } = comp {
                            let query = self.build_term_query(&term, is_phrase)?;
                            or_clauses.push((Occur::Should, query));
                        }
                    }
                    if !or_clauses.is_empty() {
                        clauses.push((Occur::Must, Box::new(BooleanQuery::new(or_clauses))));
                    }
                }
            }
        }

        if clauses.is_empty() {
            // Fallback to simple text search
            let query_parser = QueryParser::for_index(
                &self.index,
                vec![
                    self.field_title,
                    self.field_content_en,
                    self.field_content_bg,
                ],
            );
            let query = query_parser
                .parse_query(query_str)
                .map_err(|e| tantivy::TantivyError::InvalidArgument(e.to_string()))?;
            return Ok(query);
        }

        Ok(Box::new(BooleanQuery::new(clauses)))
    }

    /// Build a term query across title and content fields.
    fn build_term_query(
        &self,
        term: &str,
        is_phrase: bool,
    ) -> Result<Box<dyn tantivy::query::Query>> {
        use tantivy::query::{BooleanQuery, Occur, PhraseQuery};

        if is_phrase {
            // Build phrase queries for each content field
            let mut clauses: Vec<(Occur, Box<dyn tantivy::query::Query>)> = Vec::new();

            // Phrase in title
            let title_terms: Vec<Term> = term
                .split_whitespace()
                .map(|t| Term::from_field_text(self.field_title, t))
                .collect();
            if !title_terms.is_empty() {
                clauses.push((Occur::Should, Box::new(PhraseQuery::new(title_terms))));
            }

            // Phrase in English content
            let en_terms: Vec<Term> = term
                .split_whitespace()
                .map(|t| Term::from_field_text(self.field_content_en, t))
                .collect();
            if !en_terms.is_empty() {
                clauses.push((Occur::Should, Box::new(PhraseQuery::new(en_terms))));
            }

            // Phrase in Bulgarian content
            let bg_terms: Vec<Term> = term
                .split_whitespace()
                .map(|t| Term::from_field_text(self.field_content_bg, t))
                .collect();
            if !bg_terms.is_empty() {
                clauses.push((Occur::Should, Box::new(PhraseQuery::new(bg_terms))));
            }

            Ok(Box::new(BooleanQuery::new(clauses)))
        } else {
            // Simple term query across all text fields
            // Use the QueryParser for proper tokenization of the term
            let query_parser = QueryParser::for_index(
                &self.index,
                vec![
                    self.field_title,
                    self.field_content_en,
                    self.field_content_bg,
                ],
            );
            let query = query_parser
                .parse_query(term)
                .map_err(|e| tantivy::TantivyError::InvalidArgument(e.to_string()))?;
            Ok(query)
        }
    }

    /// Parse query string into components.
    fn parse_query_components(&self, query_str: &str) -> Result<Vec<QueryComponent>> {
        let mut components = Vec::new();
        let chars = query_str.chars().peekable();
        let mut current_term = String::new();
        let mut in_quotes = false;
        let mut negate_next = false;

        for ch in chars {
            match ch {
                '"' => {
                    if in_quotes {
                        // End of phrase
                        if !current_term.is_empty() {
                            if negate_next {
                                components.push(QueryComponent::Exclude {
                                    term: current_term.clone(),
                                    is_phrase: true,
                                });
                                negate_next = false;
                            } else {
                                components.push(QueryComponent::Include {
                                    term: current_term.clone(),
                                    is_phrase: true,
                                });
                            }
                            current_term.clear();
                        }
                        in_quotes = false;
                    } else {
                        // Start of phrase
                        if !current_term.is_empty() {
                            // Save any pending term
                            self.add_term_component(&mut components, &current_term, negate_next);
                            current_term.clear();
                            negate_next = false;
                        }
                        in_quotes = true;
                    }
                }
                '-' if !in_quotes && current_term.is_empty() => {
                    // Negation operator
                    negate_next = true;
                }
                ' ' if !in_quotes => {
                    if !current_term.is_empty() {
                        self.add_term_component(&mut components, &current_term, negate_next);
                        current_term.clear();
                        negate_next = false;
                    }
                }
                _ => {
                    current_term.push(ch);
                }
            }
        }

        // Don't forget the last term
        if !current_term.is_empty() {
            self.add_term_component(&mut components, &current_term, negate_next);
        }

        // Post-process to handle AND/OR
        Ok(self.process_boolean_operators(components))
    }

    fn add_term_component(&self, components: &mut Vec<QueryComponent>, term: &str, negate: bool) {
        let term = term.trim();
        if term.is_empty() {
            return;
        }

        // Check for tag filter
        if let Some(tag) = term.strip_prefix("tag:") {
            components.push(QueryComponent::Tag {
                tag: tag.to_string(),
            });
            return;
        }

        // Check for boolean keywords
        if term.eq_ignore_ascii_case("AND")
            || term.eq_ignore_ascii_case("OR")
            || term.eq_ignore_ascii_case("NOT")
        {
            components.push(QueryComponent::Include {
                term: term.to_string(),
                is_phrase: false,
            });
            return;
        }

        if negate {
            components.push(QueryComponent::Exclude {
                term: term.to_string(),
                is_phrase: false,
            });
        } else {
            components.push(QueryComponent::Include {
                term: term.to_string(),
                is_phrase: false,
            });
        }
    }

    fn process_boolean_operators(&self, components: Vec<QueryComponent>) -> Vec<QueryComponent> {
        let mut result = Vec::new();
        let mut i = 0;

        while i < components.len() {
            match &components[i] {
                QueryComponent::Include { term, .. } if term.eq_ignore_ascii_case("OR") => {
                    // Create OR group with previous and next component
                    if let Some(prev) = result.pop() {
                        if i + 1 < components.len() {
                            let next = components[i + 1].clone();
                            result.push(QueryComponent::OrGroup {
                                components: vec![prev, next],
                            });
                            i += 2;
                            continue;
                        } else {
                            result.push(prev);
                        }
                    }
                }
                QueryComponent::Include { term, .. } if term.eq_ignore_ascii_case("AND") => {
                    // AND is implicit, just skip it
                }
                QueryComponent::Include { term, .. } if term.eq_ignore_ascii_case("NOT") => {
                    // NOT before a term negates it
                    if i + 1 < components.len() {
                        if let QueryComponent::Include { term: t, is_phrase } = &components[i + 1] {
                            result.push(QueryComponent::Exclude {
                                term: t.clone(),
                                is_phrase: *is_phrase,
                            });
                            i += 2;
                            continue;
                        }
                    }
                }
                _ => {
                    result.push(components[i].clone());
                }
            }
            i += 1;
        }

        result
    }

    /// Close the search index and release resources.
    pub fn close(&self) -> Result<()> {
        // Commit any pending changes
        let mut writer = self.writer.lock().map_err(|_| {
            crate::error::KnotError::Other("Failed to lock search writer".to_string())
        })?;
        writer.commit()?;
        Ok(())
    }
}

#[derive(Debug, Clone)]
enum QueryComponent {
    Include { term: String, is_phrase: bool },
    Exclude { term: String, is_phrase: bool },
    Tag { tag: String },
    OrGroup { components: Vec<QueryComponent> },
}

/// Returns true if more than 30% of alphabetic characters in the text are Cyrillic.
fn is_cyrillic(text: &str) -> bool {
    let mut alpha_count = 0u32;
    let mut cyrillic_count = 0u32;

    for ch in text.chars() {
        if ch.is_alphabetic() {
            alpha_count += 1;
            if ('\u{0400}'..='\u{04FF}').contains(&ch) {
                cyrillic_count += 1;
            }
        }
    }

    if alpha_count == 0 {
        return false;
    }

    (cyrillic_count as f64 / alpha_count as f64) > 0.3
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_index_in_directory() {
        let dir = tempfile::TempDir::new().unwrap();
        let idx = SearchIndex::open(dir.path()).unwrap();
        // Verify we can access the schema fields
        let schema = idx.index.schema();
        assert!(schema.get_field("path").is_ok());
        assert!(schema.get_field("title").is_ok());
        assert!(schema.get_field("content_en").is_ok());
        assert!(schema.get_field("content_bg").is_ok());
        assert!(schema.get_field("tags").is_ok());
    }

    #[test]
    fn create_index_in_memory() {
        let idx = SearchIndex::open_in_memory().unwrap();
        let schema = idx.index.schema();
        assert!(schema.get_field("path").is_ok());
        assert!(schema.get_field("title").is_ok());
        assert!(schema.get_field("content_en").is_ok());
        assert!(schema.get_field("content_bg").is_ok());
        assert!(schema.get_field("tags").is_ok());
    }

    #[test]
    fn index_and_count_documents() {
        let idx = SearchIndex::open_in_memory().unwrap();
        idx.index_note("a.md", "Alpha", "Hello world", &[]).unwrap();
        idx.index_note("b.md", "Beta", "Goodbye world", &[])
            .unwrap();
        idx.commit().unwrap();

        let searcher = idx.reader.searcher();
        assert_eq!(searcher.num_docs(), 2);
    }

    #[test]
    fn remove_note_from_index() {
        let idx = SearchIndex::open_in_memory().unwrap();
        idx.index_note("a.md", "Alpha", "Hello world", &[]).unwrap();
        idx.index_note("b.md", "Beta", "Goodbye world", &[])
            .unwrap();
        idx.commit().unwrap();

        idx.remove_note("a.md").unwrap();
        idx.commit().unwrap();

        let searcher = idx.reader.searcher();
        assert_eq!(searcher.num_docs(), 1);
    }

    #[test]
    fn reindex_note_replaces_old() {
        let idx = SearchIndex::open_in_memory().unwrap();
        idx.index_note("a.md", "Alpha", "Hello world", &[]).unwrap();
        idx.commit().unwrap();

        // Re-index with different content
        idx.index_note("a.md", "Alpha Updated", "New content", &[])
            .unwrap();
        idx.commit().unwrap();

        let searcher = idx.reader.searcher();
        assert_eq!(searcher.num_docs(), 1);

        // Verify the title was updated
        let results = idx.search("Alpha Updated", 10).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].title, "Alpha Updated");
    }

    #[test]
    fn search_finds_matching_notes() {
        let idx = SearchIndex::open_in_memory().unwrap();
        idx.index_note(
            "rust.md",
            "Rust Guide",
            "Rust is a systems programming language",
            &[],
        )
        .unwrap();
        idx.index_note(
            "python.md",
            "Python Guide",
            "Python is a scripting language",
            &[],
        )
        .unwrap();
        idx.commit().unwrap();

        let results = idx.search("rust", 10).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].path, "rust.md");
        assert_eq!(results[0].title, "Rust Guide");
        assert!(results[0].score > 0.0);
    }

    #[test]
    fn search_returns_empty_for_no_match() {
        let idx = SearchIndex::open_in_memory().unwrap();
        idx.index_note("a.md", "Alpha", "Hello world", &[]).unwrap();
        idx.commit().unwrap();

        let results = idx.search("nonexistent", 10).unwrap();
        assert!(results.is_empty());
    }

    #[test]
    fn search_respects_limit() {
        let idx = SearchIndex::open_in_memory().unwrap();
        for i in 0..10 {
            idx.index_note(
                &format!("note{i}.md"),
                &format!("Note {i}"),
                "Common keyword searchable content here",
                &[],
            )
            .unwrap();
        }
        idx.commit().unwrap();

        let results = idx.search("searchable", 3).unwrap();
        assert_eq!(results.len(), 3);
    }

    #[test]
    fn search_case_insensitive() {
        let idx = SearchIndex::open_in_memory().unwrap();
        idx.index_note(
            "microservices.md",
            "Microservices",
            "Microservices architecture decomposes a system",
            &[],
        )
        .unwrap();
        idx.commit().unwrap();

        // Search for lowercase - should find it
        let results = idx.search("microservices", 10).unwrap();
        assert_eq!(results.len(), 1, "Should find with lowercase");

        // Search for capitalized - should also find it
        let results = idx.search("Microservices", 10).unwrap();
        assert_eq!(results.len(), 1, "Should find with capitalized");
    }

    #[test]
    fn search_single_term() {
        let idx = SearchIndex::open_in_memory().unwrap();
        idx.index_note("a.md", "Alpha", "Hello world", &[]).unwrap();
        idx.commit().unwrap();

        // Simple single term search
        let results = idx.search("Alpha", 10).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].path, "a.md");
    }

    #[test]
    fn is_cyrillic_detection() {
        assert!(is_cyrillic("Здравей свят"));
        assert!(is_cyrillic("Програмиране на Rust"));
        assert!(!is_cyrillic("Hello world"));
        assert!(!is_cyrillic("Hello Свят world foo bar baz")); // less than 30% Cyrillic
        assert!(is_cyrillic("Здравей свят hello")); // more than 30% Cyrillic
    }

    #[test]
    fn search_bulgarian_content() {
        let idx = SearchIndex::open_in_memory().unwrap();

        // Index a Bulgarian note
        idx.index_note("bg.md", "Бележка", "Програмиране на Rust е забавно", &[])
            .unwrap();

        // Index an English note
        idx.index_note("en.md", "English Note", "Programming in Rust is fun", &[])
            .unwrap();
        idx.commit().unwrap();

        // Search for Bulgarian word should find the Bulgarian note
        let results = idx.search("програмиране", 10).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].path, "bg.md");
    }

    #[test]
    fn search_exact_phrase() {
        let idx = SearchIndex::open_in_memory().unwrap();
        idx.index_note("a.md", "Note A", "The quick brown fox jumps", &[])
            .unwrap();
        idx.index_note("b.md", "Note B", "The quick red fox runs", &[])
            .unwrap();
        idx.commit().unwrap();

        // Exact phrase search
        let results = idx.search("\"brown fox\"", 10).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].path, "a.md");
    }

    #[test]
    fn search_exclude_term() {
        let idx = SearchIndex::open_in_memory().unwrap();
        idx.index_note("a.md", "Rust Guide", "Learn Rust programming", &[])
            .unwrap();
        idx.index_note("b.md", "Python Guide", "Learn Python programming", &[])
            .unwrap();
        idx.commit().unwrap();

        // Search for "programming" but exclude "Python"
        let results = idx.search("programming -Python", 10).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].path, "a.md");
    }

    #[test]
    fn search_not_operator() {
        let idx = SearchIndex::open_in_memory().unwrap();
        idx.index_note("a.md", "Rust Guide", "Learn Rust programming", &[])
            .unwrap();
        idx.index_note("b.md", "Python Guide", "Learn Python programming", &[])
            .unwrap();
        idx.commit().unwrap();

        // Search for "programming" but NOT "Python"
        let results = idx.search("programming NOT Python", 10).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].path, "a.md");
    }

    #[test]
    fn search_or_operator() {
        let idx = SearchIndex::open_in_memory().unwrap();
        idx.index_note("a.md", "Rust Guide", "Learn Rust programming", &[])
            .unwrap();
        idx.index_note("b.md", "Python Guide", "Learn Python programming", &[])
            .unwrap();
        idx.index_note("c.md", "JS Guide", "Learn JavaScript programming", &[])
            .unwrap();
        idx.commit().unwrap();

        // Search for "Rust OR Python" - should find both
        let results = idx.search("Rust OR Python", 10).unwrap();
        assert_eq!(results.len(), 2);
        let paths: Vec<String> = results.iter().map(|r| r.path.clone()).collect();
        assert!(paths.contains(&"a.md".to_string()));
        assert!(paths.contains(&"b.md".to_string()));
    }

    #[test]
    fn search_by_tag() {
        let idx = SearchIndex::open_in_memory().unwrap();
        idx.index_note(
            "a.md",
            "Note A",
            "Content about Rust",
            &["rust".to_string(), "programming".to_string()],
        )
        .unwrap();
        idx.index_note(
            "b.md",
            "Note B",
            "Content about Python",
            &["python".to_string(), "programming".to_string()],
        )
        .unwrap();
        idx.commit().unwrap();

        // Search by tag
        let results = idx.search("tag:rust", 10).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].path, "a.md");
    }
}
