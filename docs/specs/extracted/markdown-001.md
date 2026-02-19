# Markdown Parser

## Metadata
- ID: `COMP-MARKDOWN-001`
- Source: `extracted`
- Component: `markdown`
- Depth: `standard`
- Extracted: `2026-02-19`
- Concerns: [CAP]

## Source Reference
- Codebase: `src-tauri/src/`
- Entry Points:
  - `markdown.rs` (parsing and rendering)
- Lines Analyzed: ~482

## Confidence Assessment
| Requirement | Confidence | Evidence | Needs Review |
|-------------|------------|----------|--------------|
| FR-1: Parse wikilinks | high | Implementation + tests | no |
| FR-2: Parse markdown links | high | Implementation + tests | no |
| FR-3: Extract headings | high | Implementation + tests | no |
| FR-4: Render to HTML | high | Implementation + tests | no |
| FR-5: Support tables | high | Options flag + test | no |
| FR-6: Support task lists | high | Options flag + test | no |
| FR-7: Support strikethrough | high | Options flag | no |
| FR-8: Generate anchors | high | Implementation + tests | no |
| FR-9: Unicode slug support | high | Test `slugify_unicode` | no |
| FR-10: Ignore external links in graph | high | `is_internal_link` function | no |

## Contract

### Functional Requirements

**FR-1**: Parse wikilink syntax `[[Target]]` and `[[Target|Display]]`
- Evidence: `markdown.rs:88-138`, tests `parse_wikilink_simple`, `parse_wikilink_with_display`
- Confidence: high
- Syntax:
  - `[[Target]]` → target=Target, display=Target
  - `[[Target|Display]]` → target=Target, display=Display
- Constraints: No newlines allowed inside wikilinks
- Empty targets: Ignored (`[[]]` is not a valid link)

**FR-2**: Parse standard markdown links `[text](url)`
- Evidence: `markdown.rs:217-257`, test `parse_markdown_link`
- Confidence: high
- Internal links: Relative paths or note names (no protocol)
- External links: Filtered out from graph (http/https/mailto/fragment)

**FR-3**: Extract headings from markdown content
- Evidence: `markdown.rs:171-213`, test `parse_headings`
- Confidence: high
- Levels: H1-H6
- Content: Text and inline code included
- Anchors: URL-safe slugs generated

**FR-4**: Render markdown to HTML
- Evidence: `markdown.rs:259-264`, tests `render_html_basic`, `wikilink_rendered_as_html_link`
- Confidence: high
- Library: pulldown-cmark
- Wikilinks: Converted to standard markdown links before rendering

**FR-5**: Support GitHub-flavored markdown tables
- Evidence: `markdown.rs:60`, test `tables_rendered`
- Confidence: high
- Option: `Options::ENABLE_TABLES`

**FR-6**: Support task lists/checkboxes
- Evidence: `markdown.rs:62`, test `task_lists_rendered`
- Confidence: high
- Option: `Options::ENABLE_TASKLISTS`
- Renders: `<input type="checkbox" checked>`

**FR-7**: Support strikethrough
- Evidence: `markdown.rs:61`
- Confidence: high
- Option: `Options::ENABLE_STRIKETHROUGH`

**FR-8**: Generate URL-safe anchor slugs from headings
- Evidence: `markdown.rs:278-302`, tests `parse_headings`, `slugify_special_chars`
- Confidence: high
- Algorithm:
  - Alphanumeric kept (lowercased)
  - Spaces, hyphens, underscores → hyphen
  - Unicode alphabetic kept (lowercased)
  - Other characters removed
  - Multiple hyphens collapsed

**FR-9**: Support Unicode in slugs (Bulgarian, etc.)
- Evidence: `markdown.rs:287-290`, test `slugify_unicode`
- Confidence: high
- Example: "Бележки за проект" → "бележки-за-проект"

**FR-10**: Distinguish internal from external links
- Evidence: `markdown.rs:304-310`, test `ignore_external_links`
- Confidence: high
- External prefixes: `http://`, `https://`, `mailto:`, `#`
- Only internal links are added to the link graph

### Interface (Rust)

```rust
/// A link found in a note's content.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Link {
    pub target: String,
    pub display: String,
    pub link_type: LinkKind,
}

/// Distinguishes wikilinks from standard markdown links.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum LinkKind {
    Wiki,      // [[Target]] or [[Target|Display]]
    Markdown,  // [text](url)
}

/// A heading extracted from markdown content.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Heading {
    pub level: u32,      // 1-6
    pub text: String,
    pub anchor: String,  // URL-safe slug
}

/// The result of parsing a markdown note.
#[derive(Debug, Clone)]
pub struct ParsedNote {
    pub links: Vec<Link>,
    pub headings: Vec<Heading>,
    pub html: String,
}

/// Parse a markdown document, extracting links, headings, and rendering HTML.
pub fn parse(content: &str) -> ParsedNote;

/// Extract headings from markdown content.
pub fn extract_headings(content: &str) -> Vec<Heading>;

// Internal functions (exposed for advanced use)
fn preprocess_wikilinks(content: &str, links: &mut Vec<Link>) -> String;
fn extract_headings_from_events(events: &[Event], headings: &mut Vec<Heading>);
fn extract_markdown_links(
    events: &[Event],
    links: &mut Vec<Link>,
    wiki_targets: &HashSet<String>,
);
fn render_html(events: &[Event]) -> String;
fn slugify(text: &str) -> String;
fn is_internal_link(target: &str) -> bool;
```

### Behavior

**Given** content "See [[Other Note]] for details."
**When** `parse()` is called
**Then** returns one Wiki link with target="Other Note", display="Other Note"

**Given** content "Check [[projects/todo.md|my todo list]] here."
**When** `parse()` is called
**Then** returns one Wiki link with target="projects/todo.md", display="my todo list"

**Given** content with heading "# Title\n\n## Section One"
**When** `parse()` is called
**Then** returns headings [H1 "Title" anchor="title", H2 "Section One" anchor="section-one"]

**Given** content "[Google](https://google.com)"
**When** `parse()` is called
**Then** returns no links (external filtered)

**Given** content "# Hello\n\nA paragraph with **bold**."
**When** `parse()` is called
**Then** html contains `<h1>`, `<strong>bold</strong>`, `<p>`

**Given** content "Empty [[]] here."
**When** `parse()` is called
**Then** returns no wikilinks (empty target ignored)

**Given** content "Bad [[multi\nline]] link."
**When** `parse()` is called
**Then** returns no wikilinks (newlines not allowed)

## Design Decisions (Inferred)

| Decision | Evidence | Confidence |
|----------|----------|------------|
| pulldown-cmark for markdown parsing | `markdown.rs:6` | high |
| Two-pass parsing (wikilinks first, then markdown) | `markdown.rs:56-86` | high |
| Wikilinks converted to `<url>` markdown syntax | `markdown.rs:116-120` | medium |
| Autolinks excluded from link extraction | `markdown.rs:233` | high |
| Wiki targets tracked to avoid double-counting | `markdown.rs:68-73` | high |
| Heading level as u32 (not enum) | `markdown.rs:32` | medium |
| Tables, strikethrough, tasklists enabled | `markdown.rs:60-63` | high |
| Heading attributes enabled | `markdown.rs:63` | high |
| Bulgarian Unicode preserved in anchors | `markdown.rs:288-290` | high |

## Uncertainties

- [ ] Should wiki link targets be normalized (e.g., add .md if missing)?
- [ ] How to handle wiki links to notes in subdirectories? Currently stored as-is
- [ ] Embedded images `![alt](url)` - should these be tracked?
- [ ] Reference-style links `[text][ref]` - are these handled correctly?
- [ ] Should anchors handle more Unicode ranges beyond Cyrillic?

## Acceptance Criteria (Derived from Tests)

- [ ] Simple wikilink parsed correctly (`parse_wikilink_simple`)
- [ ] Wikilink with display text parsed correctly (`parse_wikilink_with_display`)
- [ ] Multiple wikilinks in same content (`parse_multiple_wikilinks`)
- [ ] Markdown links parsed correctly (`parse_markdown_link`)
- [ ] External links ignored for graph (`ignore_external_links`)
- [ ] Headings extracted with correct levels (`parse_headings`)
- [ ] Inline code in headings handled (`heading_with_code`)
- [ ] HTML rendering works (`render_html_basic`)
- [ ] Wikilinks render as HTML links (`wikilink_rendered_as_html_link`)
- [ ] Empty wikilinks ignored (`empty_wikilink_ignored`)
- [ ] Multi-line wikilinks ignored (`wikilink_with_newline_ignored`)
- [ ] Mixed links and headings work together (`mixed_links_and_headings`)
- [ ] Bulgarian text in anchors works (`slugify_unicode`)
- [ ] Special characters removed from anchors (`slugify_special_chars`)
- [ ] Task lists render checkboxes (`task_lists_rendered`)
- [ ] Tables render as HTML tables (`tables_rendered`)

## Related
- Extracted from: `src-tauri/src/markdown.rs`
- Depends on: pulldown-cmark crate
- Used by: `COMP-NOTE-001`, `COMP-GRAPH-001`, Frontend preview rendering
