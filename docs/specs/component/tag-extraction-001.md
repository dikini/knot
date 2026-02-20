# Tag Extraction

## Metadata
- ID: `COMP-TAG-EXTRACTION-001`
- Scope: `component`
- Status: `implemented`
- Parent: `COMP-MARKDOWN-001`, `COMP-DATABASE-001`
- Concerns: [CAP]
- Created: `2026-02-19`
- Updated: `2026-02-20`

## Purpose
Extract tags from note content (e.g., `#important`, `#rust`) and store them in the database for organization and filtering.

## Current State
- Tags table exists in database
- Search can filter by `tag:name`
- Automatic tag extraction and sync on save is implemented

## Contract

### Functional Requirements

**FR-1**: Parse tags from markdown content
- Tag format: `#tagname` (hash followed by alphanumeric)
- Tag name rules:
  - Starts with letter
  - Contains letters, numbers, hyphens, underscores
  - Case insensitive (stored as lowercase)
- Tags must be standalone words (not part of URLs, code blocks)

**FR-2**: Exclude tags in certain contexts
- Don't extract from code blocks (``` or `inline`)
- Don't extract from URLs (e.g., `http://example.com#anchor`)
- Don't extract if preceded by backslash (escaped: `\#tag`)

**FR-3**: Store tags on note save
- Extract tags when note is saved
- Save to database (tags table, note_tags join table)
- Remove old tags, add new ones (sync, don't append)
- Update search index with tags

### Future Enhancement (Out of Current Scope)

**FE-1**: Display tags in UI (future)
- Show tag list in sidebar
- Click tag to filter notes
- Tag cloud view

### Interface

```rust
// In markdown.rs
pub fn extract_tags(content: &str) -> Vec<String>;

// In note saving flow
fn sync_tags(&self, note_id: &str, tags: &[String]) -> Result<()>;
```

### Behavior

**Given** content: "# Meeting notes #important #work"
**When** parsed
**Then** returns ["important", "work"]

**Given** content: "```rust #not-a-tag``` and `#real-tag`"
**When** parsed
**Then** returns []

**Given** content: "Check https://example.com#section"
**When** parsed
**Then** returns []

## Design Decisions

| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
| Regex-based parsing | Fast, simple | May miss edge cases |
| Extract on save | Always fresh | Slight overhead on save |
| Lowercase storage | Consistent search | Loses original case |
| Sync (not append) | Removes stale tags | Deletes old tags immediately |

## Acceptance Criteria

- [x] Tags parsed from content
- [x] Code blocks and inline code excluded
- [x] URLs excluded
- [x] Escaped tags excluded
- [x] Tags stored in database on save
- [x] Search index updated with tags
- [x] Case insensitive

## Verification

- `cargo test extract_tags --lib`
- `cargo test --lib`

## Related

- Extends: `COMP-MARKDOWN-001`
- Uses: `COMP-DATABASE-001`
- Enables: Tag-based search, tag cloud
