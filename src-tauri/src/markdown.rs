//! Markdown parsing engine for BotPane.
//!
//! Handles standard markdown via pulldown-cmark, plus custom wikilink
//! syntax (`[[Target]]` and `[[Target|Display Text]]`).

use pulldown_cmark::{Event, HeadingLevel, LinkType, Options, Parser, Tag, TagEnd};
use serde::{Deserialize, Serialize};

/// A link found in a note's content.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Link {
    /// The target path or note title (e.g. "other-note.md" or "Some Note").
    pub target: String,
    /// The display text shown to the user.
    pub display: String,
    /// The kind of link.
    pub link_type: LinkKind,
}

/// Distinguishes wikilinks from standard markdown links.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum LinkKind {
    /// `[[Target]]` or `[[Target|Display]]`
    Wiki,
    /// `[text](url)` or reference links
    Markdown,
}

/// A heading extracted from markdown content.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Heading {
    /// Heading level (1-6).
    pub level: u32,
    /// The heading text content.
    pub text: String,
    /// URL-safe anchor slug.
    pub anchor: String,
}

/// The result of parsing a markdown note.
#[derive(Debug, Clone)]
pub struct ParsedNote {
    /// All links found in the document.
    pub links: Vec<Link>,
    /// All headings found in the document.
    pub headings: Vec<Heading>,
    /// Rendered HTML.
    pub html: String,
}

/// Parse a markdown document, extracting links, headings, and rendering HTML.
pub fn parse(content: &str) -> ParsedNote {
    let mut links = Vec::new();
    let mut headings = Vec::new();

    // First pass: extract wikilinks from raw text and replace with markdown links.
    let processed = preprocess_wikilinks(content, &mut links);

    // Second pass: parse with pulldown-cmark to extract headings and standard links.
    let options = Options::ENABLE_TABLES
        | Options::ENABLE_STRIKETHROUGH
        | Options::ENABLE_TASKLISTS
        | Options::ENABLE_HEADING_ATTRIBUTES;

    let parser = Parser::new_ext(&processed, options);
    let events: Vec<Event> = parser.collect();

    // Collect wiki link targets to avoid double-counting
    let wiki_targets: std::collections::HashSet<String> = links
        .iter()
        .filter(|l| l.link_type == LinkKind::Wiki)
        .map(|l| l.target.clone())
        .collect();

    extract_headings_from_events(&events, &mut headings);
    extract_markdown_links(&events, &mut links, &wiki_targets);

    // Render to HTML
    let html = render_html(&events);

    ParsedNote {
        links,
        headings,
        html,
    }
}

/// Pre-process wikilinks in raw markdown text.
///
/// Replaces `[[Target]]` with `[Target](Target)` and
/// `[[Target|Display]]` with `[Display](Target)` so that
/// pulldown-cmark can handle them as standard links.
///
/// Also collects the wiki links into the provided vec.
fn preprocess_wikilinks(content: &str, links: &mut Vec<Link>) -> String {
    let mut result = String::with_capacity(content.len());
    let mut chars = content.char_indices().peekable();

    while let Some((i, ch)) = chars.next() {
        if ch == '[' {
            // Check for `[[`
            if let Some(&(_, next_ch)) = chars.peek() {
                if next_ch == '[' {
                    chars.next(); // consume second '['

                    // Find the closing `]]`
                    if let Some((target, display, end)) = find_wikilink_end(content, i + 2) {
                        links.push(Link {
                            target: target.clone(),
                            display: display.clone(),
                            link_type: LinkKind::Wiki,
                        });

                        // Emit as a standard markdown link.
                        // Wrap dest in <> to allow spaces in the URL.
                        result.push('[');
                        result.push_str(&display);
                        result.push_str("](<");
                        result.push_str(&target);
                        result.push_str(">)");

                        // Advance past the closing `]]`
                        while let Some(&(j, _)) = chars.peek() {
                            if j >= end {
                                break;
                            }
                            chars.next();
                        }
                        continue;
                    }
                }
            }
        }
        result.push(ch);
    }

    result
}

/// Find the end of a wikilink starting at `start` (after the `[[`).
/// Returns `(target, display, end_byte_index)` where end_byte_index
/// is the byte position after `]]`.
fn find_wikilink_end(content: &str, start: usize) -> Option<(String, String, usize)> {
    let rest = &content[start..];
    let close = rest.find("]]")?;
    let inner = &rest[..close];

    // Don't allow newlines inside wikilinks
    if inner.contains('\n') {
        return None;
    }

    let (target, display) = if let Some(pipe_pos) = inner.find('|') {
        (inner[..pipe_pos].trim(), inner[pipe_pos + 1..].trim())
    } else {
        (inner.trim(), inner.trim())
    };

    if target.is_empty() {
        return None;
    }

    Some((
        target.to_string(),
        display.to_string(),
        start + close + 2, // past the `]]`
    ))
}

/// Extract headings from markdown content.
pub fn extract_headings(content: &str) -> Vec<Heading> {
    let options = Options::ENABLE_TABLES
        | Options::ENABLE_STRIKETHROUGH
        | Options::ENABLE_TASKLISTS
        | Options::ENABLE_HEADING_ATTRIBUTES;

    let parser = Parser::new_ext(content, options);
    let events: Vec<Event> = parser.collect();
    
    let mut headings = Vec::new();
    extract_headings_from_events(&events, &mut headings);
    headings
}

/// Extract headings from parsed pulldown-cmark events.
fn extract_headings_from_events(events: &[Event], headings: &mut Vec<Heading>) {
    let mut in_heading: Option<u32> = None;
    let mut heading_text = String::new();

    for event in events {
        match event {
            Event::Start(Tag::Heading { level, .. }) => {
                in_heading = Some(heading_level_to_u32(level));
                heading_text.clear();
            }
            Event::End(TagEnd::Heading(_)) => {
                if let Some(level) = in_heading.take() {
                    let text = heading_text.trim().to_string();
                    let anchor = slugify(&text);
                    headings.push(Heading {
                        level,
                        text,
                        anchor,
                    });
                }
            }
            Event::Text(t) | Event::Code(t) if in_heading.is_some() => {
                heading_text.push_str(t);
            }
            _ => {}
        }
    }
}

/// Extract standard markdown links from parsed events.
/// Skips links whose target matches a wiki link (already collected).
fn extract_markdown_links(
    events: &[Event],
    links: &mut Vec<Link>,
    wiki_targets: &std::collections::HashSet<String>,
) {
    let mut in_link: Option<String> = None;
    let mut link_text = String::new();

    for event in events {
        match event {
            Event::Start(Tag::Link {
                link_type,
                dest_url,
                ..
            }) => {
                // Skip autolinks (bare URLs)
                if *link_type != LinkType::Autolink {
                    in_link = Some(dest_url.to_string());
                    link_text.clear();
                }
            }
            Event::End(TagEnd::Link) => {
                if let Some(target) = in_link.take() {
                    let display = link_text.trim().to_string();
                    // Only collect internal links, skip wiki-converted ones
                    if is_internal_link(&target) && !wiki_targets.contains(&target) {
                        links.push(Link {
                            target,
                            display,
                            link_type: LinkKind::Markdown,
                        });
                    }
                }
            }
            Event::Text(t) | Event::Code(t) if in_link.is_some() => {
                link_text.push_str(t);
            }
            _ => {}
        }
    }
}

/// Render pulldown-cmark events to HTML.
fn render_html(events: &[Event]) -> String {
    let mut html = String::new();
    pulldown_cmark::html::push_html(&mut html, events.iter().cloned());
    html
}

/// Convert a HeadingLevel to a u32 (1-6).
fn heading_level_to_u32(level: &HeadingLevel) -> u32 {
    match level {
        HeadingLevel::H1 => 1,
        HeadingLevel::H2 => 2,
        HeadingLevel::H3 => 3,
        HeadingLevel::H4 => 4,
        HeadingLevel::H5 => 5,
        HeadingLevel::H6 => 6,
    }
}

/// Generate a URL-safe anchor slug from heading text.
fn slugify(text: &str) -> String {
    text.chars()
        .map(|c| {
            if c.is_alphanumeric() {
                c.to_lowercase().next().unwrap_or(c)
            } else if c == ' ' || c == '-' || c == '_' {
                '-'
            } else {
                // Keep Unicode letters (Bulgarian, etc.) as-is
                if c.is_alphabetic() {
                    c.to_lowercase().next().unwrap_or(c)
                } else {
                    '\0' // will be filtered out
                }
            }
        })
        .filter(|c| *c != '\0')
        .collect::<String>()
        // Collapse multiple dashes
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

/// Check if a link target is internal (not an external URL).
fn is_internal_link(target: &str) -> bool {
    !target.starts_with("http://")
        && !target.starts_with("https://")
        && !target.starts_with("mailto:")
        && !target.starts_with('#')
}

/// Extract tags (#tagname) from markdown content.
/// Returns lowercase tag names without the # prefix.
/// Excludes tags in code blocks and URLs.
pub fn extract_tags(content: &str) -> Vec<String> {
    let mut tags = Vec::new();
    let mut in_code_block = false;

    for line in content.lines() {
        // Track code blocks
        if line.trim_start().starts_with("```") {
            in_code_block = !in_code_block;
            continue;
        }

        if in_code_block {
            continue;
        }

        // Find tags in this line
        // Simple approach: find all #word patterns, then filter
        for word in line.split_whitespace() {
            if let Some(tag) = extract_tag_from_word(word) {
                let tag_lower = tag.to_lowercase();
                if !tags.contains(&tag_lower) {
                    tags.push(tag_lower);
                }
            }
        }
    }

    tags
}

fn extract_tag_from_word(word: &str) -> Option<String> {
    // Remove punctuation from end (but not from beginning, to handle escaped tags)
    let trimmed = word.trim_end_matches(|c: char| !c.is_alphanumeric() && c != '_');

    // Find the position of # in the word
    let hash_pos = trimmed.find('#')?;

    // Check if the # is escaped (preceded by \)
    if hash_pos > 0 && trimmed.chars().nth(hash_pos - 1) == Some('\\') {
        return None;
    }

    // Check if this looks like a URL (contains :// or starts with http/https)
    if trimmed.contains("://") || trimmed.starts_with("http") {
        return None;
    }

    // Extract the part after #
    let after_hash = &trimmed[hash_pos + 1..];

    // Tag must not be empty
    if after_hash.is_empty() {
        return None;
    }

    // First character must be a letter
    let first_char = after_hash.chars().next()?;
    if !first_char.is_alphabetic() {
        return None;
    }

    // Rest must be alphanumeric, hyphen, or underscore
    if !after_hash.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
        return None;
    }

    Some(after_hash.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_wikilink_simple() {
        let result = parse("See [[Other Note]] for details.");
        assert_eq!(result.links.len(), 1);
        assert_eq!(result.links[0].target, "Other Note");
        assert_eq!(result.links[0].display, "Other Note");
        assert_eq!(result.links[0].link_type, LinkKind::Wiki);
    }

    #[test]
    fn parse_wikilink_with_display() {
        let result = parse("Check [[projects/todo.md|my todo list]] here.");
        assert_eq!(result.links.len(), 1);
        assert_eq!(result.links[0].target, "projects/todo.md");
        assert_eq!(result.links[0].display, "my todo list");
        assert_eq!(result.links[0].link_type, LinkKind::Wiki);
    }

    #[test]
    fn parse_multiple_wikilinks() {
        let result = parse("Link to [[A]] and [[B]] and [[C]].");
        let wiki_links: Vec<_> = result
            .links
            .iter()
            .filter(|l| l.link_type == LinkKind::Wiki)
            .collect();
        assert_eq!(wiki_links.len(), 3);
        assert_eq!(wiki_links[0].target, "A");
        assert_eq!(wiki_links[1].target, "B");
        assert_eq!(wiki_links[2].target, "C");
    }

    #[test]
    fn parse_markdown_link() {
        let result = parse("See [related](notes/related.md) for info.");
        assert_eq!(result.links.len(), 1);
        assert_eq!(result.links[0].target, "notes/related.md");
        assert_eq!(result.links[0].display, "related");
        assert_eq!(result.links[0].link_type, LinkKind::Markdown);
    }

    #[test]
    fn ignore_external_links() {
        let result = parse("[Google](https://google.com) and [mail](mailto:x@y.com)");
        assert!(result.links.is_empty());
    }

    #[test]
    fn parse_headings() {
        let content = "# Title\n\nSome text.\n\n## Section One\n\n### Sub-section\n";
        let result = parse(content);
        assert_eq!(result.headings.len(), 3);

        assert_eq!(result.headings[0].level, 1);
        assert_eq!(result.headings[0].text, "Title");
        assert_eq!(result.headings[0].anchor, "title");

        assert_eq!(result.headings[1].level, 2);
        assert_eq!(result.headings[1].text, "Section One");
        assert_eq!(result.headings[1].anchor, "section-one");

        assert_eq!(result.headings[2].level, 3);
        assert_eq!(result.headings[2].text, "Sub-section");
        assert_eq!(result.headings[2].anchor, "sub-section");
    }

    #[test]
    fn heading_with_code() {
        let result = parse("## Using `async` in Rust\n");
        assert_eq!(result.headings.len(), 1);
        assert_eq!(result.headings[0].text, "Using async in Rust");
    }

    #[test]
    fn render_html_basic() {
        let result = parse("# Hello\n\nA paragraph with **bold**.");
        assert!(result.html.contains("<h1>"));
        assert!(result.html.contains("<strong>bold</strong>"));
        assert!(result.html.contains("<p>"));
    }

    #[test]
    fn wikilink_rendered_as_html_link() {
        let result = parse("See [[My Note]] here.");
        // pulldown-cmark renders the <url> syntax with the raw URL
        assert!(result.html.contains("My Note</a>"));
        assert!(result.html.contains("href="));
    }

    #[test]
    fn empty_wikilink_ignored() {
        let result = parse("Empty [[]] here.");
        let wiki: Vec<_> = result
            .links
            .iter()
            .filter(|l| l.link_type == LinkKind::Wiki)
            .collect();
        assert!(wiki.is_empty());
    }

    #[test]
    fn wikilink_with_newline_ignored() {
        let result = parse("Bad [[multi\nline]] link.");
        let wiki: Vec<_> = result
            .links
            .iter()
            .filter(|l| l.link_type == LinkKind::Wiki)
            .collect();
        assert!(wiki.is_empty());
    }

    #[test]
    fn mixed_links_and_headings() {
        let content = "\
# Project Notes

See [[Design Doc]] for architecture.

## Implementation

Use [the crate](deps/helper.md) for utilities.
Also check [[API Reference|API docs]].
";
        let result = parse(content);

        assert_eq!(result.headings.len(), 2);
        assert_eq!(result.headings[0].text, "Project Notes");
        assert_eq!(result.headings[1].text, "Implementation");

        assert_eq!(result.links.len(), 3);
        // Wikilinks come first (from preprocessing)
        assert_eq!(result.links[0].target, "Design Doc");
        assert_eq!(result.links[0].link_type, LinkKind::Wiki);

        assert_eq!(result.links[1].target, "API Reference");
        assert_eq!(result.links[1].display, "API docs");
        assert_eq!(result.links[1].link_type, LinkKind::Wiki);

        assert_eq!(result.links[2].target, "deps/helper.md");
        assert_eq!(result.links[2].link_type, LinkKind::Markdown);
    }

    #[test]
    fn slugify_unicode() {
        // Bulgarian heading
        assert_eq!(slugify("Бележки за проект"), "бележки-за-проект");
    }

    #[test]
    fn slugify_special_chars() {
        assert_eq!(slugify("Hello, World! #1"), "hello-world-1");
    }

    #[test]
    fn task_lists_rendered() {
        let result = parse("- [x] Done\n- [ ] Todo\n");
        assert!(result.html.contains("checked"));
        assert!(result.html.contains("type=\"checkbox\""));
    }

    #[test]
    fn tables_rendered() {
        let content = "| A | B |\n|---|---|\n| 1 | 2 |\n";
        let result = parse(content);
        assert!(result.html.contains("<table>"));
    }

    #[test]
    fn extract_tags_basic() {
        let content = "# Meeting notes #important #work";
        let tags = extract_tags(content);
        assert_eq!(tags, vec!["important", "work"]);
    }

    #[test]
    fn extract_tags_excludes_code_blocks() {
        let content = "```\n#not-a-tag\n```\n#real-tag";
        let tags = extract_tags(content);
        assert_eq!(tags, vec!["real-tag"]);
    }

    #[test]
    fn extract_tags_lowercase() {
        let content = "#Important #WORK";
        let tags = extract_tags(content);
        assert_eq!(tags, vec!["important", "work"]);
    }

    #[test]
    fn extract_tags_excludes_urls() {
        let content = "See https://example.com#anchor and #real-tag";
        let tags = extract_tags(content);
        assert_eq!(tags, vec!["real-tag"]);
    }

    #[test]
    fn extract_tags_with_hyphens_and_underscores() {
        let content = "#my-tag #my_tag #tag123";
        let tags = extract_tags(content);
        assert_eq!(tags, vec!["my-tag", "my_tag", "tag123"]);
    }

    #[test]
    fn extract_tags_excludes_invalid_start() {
        let content = "#123tag #tag";
        let tags = extract_tags(content);
        assert_eq!(tags, vec!["tag"]);
    }

    #[test]
    fn extract_tags_deduplicates() {
        let content = "#tag #TAG #tag";
        let tags = extract_tags(content);
        assert_eq!(tags, vec!["tag"]);
    }

    #[test]
    fn extract_tags_with_punctuation() {
        let content = "This is #important! Really #urgent.";
        let tags = extract_tags(content);
        assert_eq!(tags, vec!["important", "urgent"]);
    }
}
