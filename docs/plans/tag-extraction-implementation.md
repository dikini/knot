# Implementation Plan: Tag Extraction

## Metadata

- Spec: `docs/specs/component/tag-extraction-001.md`
- Generated: 2026-02-19
- Approach: sequential
- Worktree: `.worktrees/tag-extraction`

## Summary

- Total tasks: 5
- Size: 1 small, 4 medium
- Critical path: All tasks (sequential)

## Tasks

### Phase 1: Foundation

| ID     | Task                                           | Size | Depends | Spec Ref |
| ------ | ---------------------------------------------- | ---- | ------- | -------- |
| TE-001 | Add tag extraction function to markdown module | M    | -       | FR-1     |

### Phase 2: Core Features

| ID     | Task                          | Size | Depends | Spec Ref | Concerns |
| ------ | ----------------------------- | ---- | ------- | -------- | -------- |
| TE-002 | Implement context filtering   | M    | TE-001  | FR-2     | REL      |
| TE-003 | Integrate tag sync on save    | M    | TE-002  | FR-3     | CONS     |
| TE-004 | Update search index with tags | M    | TE-003  | FR-3     | OBS      |

### Phase 3: Testing

| ID     | Task                    | Size | Depends                        | Spec Ref |
| ------ | ----------------------- | ---- | ------------------------------ | -------- |
| TE-005 | Add comprehensive tests | M    | TE-001, TE-002, TE-003, TE-004 | All FRs  |

## Dependency DAG

```
TE-001 → TE-002 → TE-003 → TE-004 → TE-005
```

## Concern Coverage

| Concern  | Tasks  | Verification                              |
| -------- | ------ | ----------------------------------------- |
| REL-001  | TE-002 | Test: Code blocks and URLs excluded       |
| CONS-001 | TE-003 | Test: Tags sync on save, old tags removed |
| OBS-001  | TE-004 | Test: Search index updated with tags      |

## Task Details

### TE-001: Add tag extraction function to markdown module

**Spec Ref:** FR-1
**Acceptance:** Function extracts tags from content
**Implementation:**

- Location: `src-tauri/src/markdown.rs`
- Function signature: `pub fn extract_tags(content: &str) -> Vec<String>`
- Regex pattern: `#(?P<tag>[a-zA-Z][a-zA-Z0-9_-]*)`
- Filter standalone tags (word boundaries)
- Convert to lowercase
- Remove duplicates
- Return sorted vector

### TE-002: Implement context filtering

**Spec Ref:** FR-2
**Acceptance:** Tags excluded from code blocks, URLs, escaped tags
**Implementation:**

- Parse markdown to identify code blocks (`code` and `inline code`)
- Parse URLs to identify anchors (e.g., `http://example.com#section`)
- Handle escaped tags (`\#tag`)
- Modify `extract_tags` to filter out these cases
- Use markdown parser or regex for code block detection

### TE-003: Integrate tag sync on save

**Spec Ref:** FR-3
**Acceptance:** Tags synced to database on note save
**Implementation:**

- Location: `src-tauri/src/notes.rs` or `src-tauri/src/vault.rs`
- Function: `fn sync_tags(&self, note_id: &str, tags: &[String]) -> Result<()>`
- Call `extract_tags` when saving note
- Delete old tags from `note_tags` table
- Insert new tags to `tags` table (if not exists)
- Insert mappings to `note_tags` table
- Use transaction for atomicity

### TE-004: Update search index with tags

**Spec Ref:** FR-3
**Acceptance:** Search index includes tag fields
**Implementation:**

- Location: `src-tauri/src/search.rs`
- Modify note document schema to include `tags` field
- Update `index_note` to add tags to document
- Tag filtering already supported via `tag:name` syntax
- Re-index notes to include tags

### TE-005: Add comprehensive tests

**Spec Ref:** All FRs
**Acceptance:** All tests pass, edge cases covered
**Implementation:**

- Test suite in `src-tauri/tests/tag_extraction_test.rs` or in-module
- Test cases:
  - Basic tag extraction: `# Meeting notes #important #work`
  - Case insensitivity: `#Important` vs `#important`
  - Code blocks excluded: ` ```rust #not-a-tag ``` ` and ` \`#real-tag\` `
  - URLs excluded: `Check https://example.com#section`
  - Escaped tags: `This is not \\#escaped`
  - Empty content: No tags
  - No tags in content: Empty vector
  - Duplicate tags: Deduped
  - Tag sync: Old tags removed, new tags added
  - Transaction rollback on error

## Test Coverage Plan

| Functional Requirement       | Test ID | Test Function                         |
| ---------------------------- | ------- | ------------------------------------- |
| FR-1: Parse tags             | TE-005  | `test_extract_tags_basic`             |
| FR-1: Tag name rules         | TE-005  | `test_tag_name_rules`                 |
| FR-2: Code blocks excluded   | TE-005  | `test_code_blocks_excluded`           |
| FR-2: URLs excluded          | TE-005  | `test_urls_excluded`                  |
| FR-2: Escaped tags           | TE-005  | `test_escaped_tags`                   |
| FR-3: Store on save          | TE-005  | `test_tags_stored_on_save`            |
| FR-3: Sync tags (not append) | TE-005  | `test_tags_sync_not_append`           |
| FR-3: Update search index    | TE-005  | `test_search_index_updated_with_tags` |

## Success Criteria

- [ ] `extract_tags` function extracts tags correctly
- [ ] Code blocks, URLs, escaped tags excluded
- [ ] Tags stored in database on save
- [ ] Old tags removed, new tags added
- [ ] Search index updated with tags
- [ ] All tests pass
- [ ] SPEC markers added to code

## Verification

```bash
cargo test
cargo clippy
cargo fmt
```

Test:

1. Save note with tags → tags extracted
2. Save note again with different tags → old tags removed, new tags added
3. Search by `tag:name` → returns notes with tag
4. Note with `#tag` in code block → tag not extracted

## Next Steps

- **bk-tdd**: Execute tasks TE-005 (write tests first)
- **bk-implement-rust**: Execute tasks TE-001 through TE-004
- **bk-verify**: Generate compliance report
