# Full-Text Search Engine

## Metadata
- ID: `COMP-SEARCH-001`
- Source: `extracted`
- Component: `search`
- Depth: `standard`
- Extracted: `2026-02-19`
- Concerns: [CAP, REL]

## Source Reference
- Codebase: `src-tauri/src/`
- Entry Points:
  - `search.rs` (SearchIndex implementation)
  - `commands/search.rs` (Tauri commands)
- Lines Analyzed: ~880

## Confidence Assessment
| Requirement | Confidence | Evidence | Needs Review |
|-------------|------------|----------|--------------|
| FR-1: Open/create index | high | Implementation + tests | no |
| FR-2: Index note | high | Implementation + tests | no |
| FR-3: Remove note from index | high | Implementation + tests | no |
| FR-4: Search with ranking | high | Implementation + tests | no |
| FR-5: Bilingual content detection | high | Implementation + tests | no |
| FR-6: Advanced query syntax | high | Implementation + tests | no |
| FR-7: Search snippets | high | Implementation in `search()` | no |
| FR-8: Suggestions | medium | Implementation in `search_suggestions` | no |

## Contract

### Functional Requirements

**FR-1**: Open or create a search index at a directory path
- Evidence: `search.rs:124-146`, tests `create_index_in_directory`, `create_index_in_memory`
- Confidence: high
- Behavior: Creates directory if needed, registers custom tokenizers, opens Tantivy index
- Memory variant: `open_in_memory()` for testing

**FR-2**: Index a note (add or replace)
- Evidence: `search.rs:169-211`, tests `index_and_count_documents`, `reindex_note_replaces_old`
- Confidence: high
- Behavior:
  - Deletes old document with same path
  - Splits content by language (Cyrillic detection)
  - Adds to index with path, title, content fields
- Language detection: >30% Cyrillic characters → Bulgarian field

**FR-3**: Remove a note from the index
- Evidence: `search.rs:214-219`, test `remove_note_from_index`
- Confidence: high
- Behavior: Deletes by path term, requires commit to take effect

**FR-4**: Search notes and return ranked results
- Evidence: `search.rs:229-274`, tests `search_finds_matching_notes`, `search_respects_limit`, etc.
- Confidence: high
- Parameters: `query: &str`, `limit: usize`
- Returns: Vec of `SearchResult { path, title, snippet, score }`
- Ranking: BM25 relevance score

**FR-5**: Bilingual content detection and routing
- Evidence: `search.rs:582-600`, `index_note:189-197`, tests `is_cyrillic_detection`, `search_bulgarian_content`
- Confidence: high
- Algorithm: Count Cyrillic chars / total alphabetic chars > 0.3 → Bulgarian
- Separate fields: `content_en` (stemmed), `content_bg` (lowercased only)

**FR-6**: Advanced query syntax support
- Evidence: `search.rs:284-560`, multiple test cases
- Confidence: high
- Supported syntax:
  - `"exact phrase"` - phrase search
  - `-term` or `NOT term` - exclusion
  - `term1 OR term2` - either term
  - `term1 AND term2` - both terms (implicit)
  - `tag:name` - filter by tag

**FR-7**: Generate highlighted snippets for search results
- Evidence: `search.rs:244-263`
- Confidence: high
- Uses Tantivy SnippetGenerator with HTML highlighting

**FR-8**: Get search suggestions as user types
- Evidence: `commands/search.rs:40-66`
- Confidence: medium
- Behavior: Searches and extracts unique titles
- Returns: Array of note titles matching query

### Interface (Rust)

```rust
/// A search result returned from a query.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub path: String,
    pub title: String,
    pub snippet: String,
    pub score: f32,
}

/// Full-text search index with bilingual support.
pub struct SearchIndex {
    index: Index,
    reader: IndexReader,
    writer: Mutex<IndexWriter>,
    field_path: Field,
    field_title: Field,
    field_content_en: Field,
    field_content_bg: Field,
    field_tags: Field,
}

impl SearchIndex {
    pub fn open(path: &Path) -> Result<Self>;
    pub fn open_in_memory() -> Result<Self>;
    
    pub fn index_note(
        &self,
        path: &str,
        title: &str,
        content: &str,
        tags: &[String],
    ) -> Result<()>;
    
    pub fn remove_note(&self, path: &str) -> Result<()>;
    pub fn commit(&self) -> Result<()>;
    pub fn search(&self, query_str: &str, limit: usize) -> Result<Vec<SearchResult>>;
    pub fn close(&self) -> Result<()>;
}

// Tauri Commands
#[tauri::command]
pub async fn search_notes(
    query: String,
    limit: Option<usize>,
    state: State<'_, AppState>
) -> Result<Vec<SearchResult>, String>;

#[tauri::command]
pub async fn search_suggestions(
    query: String,
    limit: Option<usize>,
    state: State<'_, AppState>
) -> Result<Vec<String>, String>;
```

### Interface (TypeScript)

```typescript
export interface SearchResult {
  path: string;
  title: string;
  excerpt: string;
  score: number;
}

// API functions
export async function searchNotes(
  query: string,
  limit?: number
): Promise<SearchResult[]>;

export async function searchSuggestions(
  query: string,
  limit?: number
): Promise<string[]>;
```

### Behavior

**Given** an index with English note "Rust Guide" containing "Rust is great"
**When** searching for "rust"
**Then** returns the note with positive score and snippet containing "<b>Rust</b>"

**Given** an index with Bulgarian note "Бележка" containing "Програмиране на Rust"
**When** searching for "програмиране" (lowercase Bulgarian)
**Then** returns the Bulgarian note (case-insensitive match)

**Given** indexed notes about Rust and Python
**When** searching for "programming -Python"
**Then** returns only the Rust note (exclusion works)

**Given** indexed notes with tags
**When** searching for "tag:rust"
**Then** returns only notes tagged with "rust"

**Given** a note indexed at "test.md"
**When** re-indexing "test.md" with different content
**Then** only one document exists (replacement works)

## Design Decisions (Inferred)

| Decision | Evidence | Confidence |
|----------|----------|------------|
| Tantivy for full-text search | `search.rs` imports | high |
| Separate fields for English/Bulgarian | `field_content_en`, `field_content_bg` | high |
| English: SimpleTokenizer + LowerCaser + Stemmer | `search.rs:54-57` | high |
| Bulgarian: SimpleTokenizer + LowerCaser only (no stemmer) | `search.rs:60-62` | high |
| 50MB writer buffer | `search.rs:133` | medium |
| MmapDirectory for persistence | `search.rs:127-130` | high |
| 30% threshold for Cyrillic detection | `search.rs:599` | medium |
| Path stored as STRING (single token) for exact match/delete | `search.rs:88` | high |
| Commit on close | `search.rs:563-569` | high |

## Uncertainties

- [ ] Is 30% Cyrillic threshold appropriate for all content types?
  - **Suggestion**: Make this configurable in `VaultConfig.search.cyrillic_threshold` (0.0-1.0)
  - Default could remain 0.3, but users with different content mixes can tune it
- [ ] Should we support more languages? Currently only English and Bulgarian
- [ ] Tags are indexed but how are they populated from note content? Not clear from code
- [ ] What happens if commit fails during close? No error recovery strategy
- [ ] Writer buffer size (50MB) - is this appropriate for mobile?

## Proposed Configuration

Add to `VaultConfig` (see `COMP-DATABASE-001`):

```rust
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SearchConfig {
    /// Threshold for Cyrillic character ratio to classify content as Bulgarian
    /// Range: 0.0-1.0, default: 0.3
    #[serde(default = "default_cyrillic_threshold")]
    pub cyrillic_threshold: f64,
    
    /// Maximum search results to return
    #[serde(default = "default_search_limit")]
    pub default_limit: usize,
    
    /// Writer buffer size in MB (affects memory usage)
    #[serde(default = "default_writer_buffer_mb")]
    pub writer_buffer_mb: usize,
}

fn default_cyrillic_threshold() -> f64 { 0.3 }
fn default_search_limit() -> usize { 20 }
fn default_writer_buffer_mb() -> usize { 50 }
```

This allows users to:
- Lower threshold (e.g., 0.1) if they write mostly English with occasional Bulgarian names
- Raise threshold (e.g., 0.6) if they write technical Bulgarian content with many English loanwords

## Acceptance Criteria (Derived from Tests)

- [ ] Index can be created in directory and memory
- [ ] Documents can be indexed and counted
- [ ] Notes can be removed from index
- [ ] Re-indexing replaces old document
- [ ] Search finds matching notes by content
- [ ] Search returns empty for no match
- [ ] Search respects result limit
- [ ] Search is case-insensitive
- [ ] Cyrillic content is detected correctly (>30% threshold)
- [ ] Bulgarian content can be searched (lowercased)
- [ ] Exact phrase search with quotes works
- [ ] Exclusion with `-term` works
- [ ] NOT operator works
- [ ] OR operator works
- [ ] Tag filtering with `tag:name` works

## Related
- Extracted from: `src-tauri/src/search.rs`, `src-tauri/src/commands/search.rs`
- Depends on: Tantivy crate, `COMP-MARKDOWN-001` (for content)
- Used by: `COMP-VAULT-001`, Frontend search UI
