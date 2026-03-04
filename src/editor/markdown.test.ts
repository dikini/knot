import { describe, it, expect } from "vitest";
import { compareMarkdownEngines, parseMarkdown, serializeMarkdown } from "./markdown";

describe("Markdown Parser", () => {
  describe("Parse Markdown", () => {
    it("should parse a simple paragraph", () => {
      const doc = parseMarkdown("This is a paragraph");

      expect(doc.type.name).toBe("doc");
      expect(doc.childCount).toBe(1);
      expect(doc.child(0).type.name).toBe("paragraph");
      expect(doc.child(0).textContent).toBe("This is a paragraph");
    });

    it("should parse multiple paragraphs", () => {
      const doc = parseMarkdown("First paragraph\n\nSecond paragraph");

      expect(doc.childCount).toBe(2);
      expect(doc.child(0).textContent).toBe("First paragraph");
      expect(doc.child(1).textContent).toBe("Second paragraph");
    });

    it("should parse headings", () => {
      const doc = parseMarkdown("# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6");

      expect(doc.childCount).toBe(6);
      expect(doc.child(0).type.name).toBe("heading");
      expect(doc.child(0).attrs.level).toBe(1);
      expect(doc.child(0).textContent).toBe("H1");

      expect(doc.child(1).attrs.level).toBe(2);
      expect(doc.child(1).textContent).toBe("H2");

      expect(doc.child(2).attrs.level).toBe(3);
      expect(doc.child(2).textContent).toBe("H3");

      expect(doc.child(3).attrs.level).toBe(4);
      expect(doc.child(3).textContent).toBe("H4");

      expect(doc.child(4).attrs.level).toBe(5);
      expect(doc.child(4).textContent).toBe("H5");

      expect(doc.child(5).attrs.level).toBe(6);
      expect(doc.child(5).textContent).toBe("H6");
    });

    it("should parse code blocks", () => {
      const doc = parseMarkdown("```javascript\nconst x = 1;\n```");

      expect(doc.childCount).toBe(1);
      expect(doc.child(0).type.name).toBe("code_block");
      expect(doc.child(0).attrs.language).toBe("javascript");
      expect(doc.child(0).textContent).toBe("const x = 1;");
    });

    it("should parse empty code block without creating empty text nodes", () => {
      const markdown = "```\n\n```";

      expect(() => parseMarkdown(markdown)).not.toThrow();
      const doc = parseMarkdown(markdown);
      const serialized = serializeMarkdown(doc);
      expect(serialized).toContain("```");
    });

    it("should parse code blocks without language", () => {
      const doc = parseMarkdown("```\ncode\n```");

      expect(doc.childCount).toBe(1);
      expect(doc.child(0).type.name).toBe("code_block");
      expect(doc.child(0).attrs.language).toBeNull();
      expect(doc.child(0).textContent).toBe("code");
    });

    it("should parse horizontal rules", () => {
      const doc = parseMarkdown("---");

      expect(doc.childCount).toBe(1);
      expect(doc.child(0).type.name).toBe("horizontal_rule");
    });

    it("should parse horizontal rules with different styles", () => {
      const doc1 = parseMarkdown("***");
      const doc2 = parseMarkdown("___");

      expect(doc1.child(0).type.name).toBe("horizontal_rule");
      expect(doc2.child(0).type.name).toBe("horizontal_rule");
    });

    it("should parse blockquotes", () => {
      const doc = parseMarkdown("> This is a quote");

      expect(doc.childCount).toBe(1);
      expect(doc.child(0).type.name).toBe("blockquote");
      expect(doc.child(0).child(0).textContent).toBe("This is a quote");
    });

    it("should parse multi-line blockquotes", () => {
      const doc = parseMarkdown("> First line\n> Second line");

      expect(doc.childCount).toBe(1);
      expect(doc.child(0).type.name).toBe("blockquote");
      expect(doc.child(0).textContent).toBe("First line\nSecond line");
    });

    it("should parse bullet lists", () => {
      const doc = parseMarkdown("- Item 1\n- Item 2\n- Item 3");

      expect(doc.childCount).toBe(1);
      expect(doc.child(0).type.name).toBe("bullet_list");
      expect(doc.child(0).childCount).toBe(3);
      expect(doc.child(0).child(0).textContent).toBe("Item 1");
      expect(doc.child(0).child(1).textContent).toBe("Item 2");
      expect(doc.child(0).child(2).textContent).toBe("Item 3");
    });

    it("should parse bullet lists with different markers", () => {
      const doc1 = parseMarkdown("- Item");
      const doc2 = parseMarkdown("* Item");
      const doc3 = parseMarkdown("+ Item");

      expect(doc1.child(0).type.name).toBe("bullet_list");
      expect(doc2.child(0).type.name).toBe("bullet_list");
      expect(doc3.child(0).type.name).toBe("bullet_list");
    });

    it("should parse ordered lists", () => {
      const doc = parseMarkdown("1. First\n2. Second\n3. Third");

      expect(doc.childCount).toBe(1);
      expect(doc.child(0).type.name).toBe("ordered_list");
      expect(doc.child(0).childCount).toBe(3);
      expect(doc.child(0).child(0).textContent).toBe("First");
      expect(doc.child(0).child(1).textContent).toBe("Second");
      expect(doc.child(0).child(2).textContent).toBe("Third");
    });

    it("should parse GitHub task lists with checked state", () => {
      const doc = parseMarkdown("- [x] Done\n- [ ] Todo");

      expect(doc.childCount).toBe(1);
      expect(doc.child(0).type.name).toBe("bullet_list");
      expect(doc.child(0).child(0).attrs.task).toBe(true);
      expect(doc.child(0).child(0).attrs.checked).toBe(true);
      expect(doc.child(0).child(0).textContent).toBe("Done");
      expect(doc.child(0).child(1).attrs.task).toBe(true);
      expect(doc.child(0).child(1).attrs.checked).toBe(false);
      expect(doc.child(0).child(1).textContent).toBe("Todo");
    });

    it("should parse GFM tables through the public markdown API", () => {
      const doc = parseMarkdown([
        "| Feature | Status |",
        "| --- | --- |",
        "| Tables | Ready |",
      ].join("\n"));

      expect(doc.childCount).toBe(1);
      expect(doc.child(0).type.name).toBe("table");
      expect(doc.child(0).child(0)?.type.name).toBe("table_row");
      expect(doc.child(0).child(1)?.child(1)?.textContent).toBe("Ready");
    });

    it("should parse GFM footnotes through the public markdown API", () => {
      const doc = parseMarkdown([
        "Reference[^1]",
        "",
        "[^1]: Footnote body",
      ].join("\n"));

      expect(doc.childCount).toBe(2);
      expect(doc.child(0).type.name).toBe("paragraph");
      expect(doc.child(0).child(1)?.type.name).toBe("footnote_reference");
      expect(doc.child(1).type.name).toBe("footnote_definition");
      expect(doc.child(1).textContent).toContain("Footnote body");
    });

    it("should parse nested formatting inside GFM table cells", () => {
      const doc = parseMarkdown([
        "| Feature | Details |",
        "| --- | --- |",
        "| Tables | **Bold** and [docs](https://example.com) |",
      ].join("\n"));

      const detailsCell = doc.child(0).child(1)?.child(1);
      const paragraph = detailsCell?.child(0);
      const boldText = paragraph?.child(0);
      const linkText = paragraph?.child(2);

      expect(detailsCell?.type.name).toBe("table_cell");
      expect(boldText?.marks.some((mark) => mark.type.name === "strong")).toBe(true);
      expect(linkText?.marks.some((mark) => mark.type.name === "link")).toBe(true);
    });

    it("should parse nested formatting inside footnote definitions", () => {
      const doc = parseMarkdown([
        "Reference[^1]",
        "",
        "[^1]: **Bold** footnote with [docs](https://example.com).",
      ].join("\n"));

      const paragraph = doc.child(1)?.child(0);
      const boldText = paragraph?.child(0);
      const linkText = paragraph?.child(2);

      expect(doc.child(1)?.type.name).toBe("footnote_definition");
      expect(boldText?.marks.some((mark) => mark.type.name === "strong")).toBe(true);
      expect(linkText?.marks.some((mark) => mark.type.name === "link")).toBe(true);
    });

    it("should parse multiline footnote definitions with nested lists", () => {
      const doc = parseMarkdown([
        "Reference[^1]",
        "",
        "[^1]: First paragraph",
        "",
        "    - Child 1",
        "    - Child 2",
      ].join("\n"));

      expect(doc.child(1)?.type.name).toBe("footnote_definition");
      expect(doc.child(1)?.child(0)?.type.name).toBe("paragraph");
      expect(doc.child(1)?.child(1)?.type.name).toBe("bullet_list");
      expect(doc.child(1)?.child(1)?.childCount).toBe(2);
    });

    it("should parse mixed inline marks inside a single table cell", () => {
      const doc = parseMarkdown([
        "| Feature | Details |",
        "| --- | --- |",
        "| Tables | **Bold** *italic* ~~strike~~ `code` [docs](https://example.com) |",
      ].join("\n"));

      const paragraph = doc.child(0).child(1)?.child(1)?.child(0);
      expect(paragraph?.child(0)?.marks.some((mark) => mark.type.name === "strong")).toBe(true);
      expect(paragraph?.child(2)?.marks.some((mark) => mark.type.name === "em")).toBe(true);
      expect(paragraph?.child(4)?.marks.some((mark) => mark.type.name === "strike")).toBe(true);
      expect(paragraph?.child(6)?.marks.some((mark) => mark.type.name === "code")).toBe(true);
      expect(paragraph?.child(8)?.marks.some((mark) => mark.type.name === "link")).toBe(true);
    });

    it("should treat raw HTML as literal text on the public markdown API", () => {
      const doc = parseMarkdown("<span>unsafe</span>");

      expect(doc.childCount).toBe(1);
      expect(doc.child(0)?.type.name).toBe("paragraph");
      expect(doc.child(0)?.textContent).toBe("<span>unsafe</span>");
    });

    it("should parse inline formatting - bold", () => {
      const doc = parseMarkdown("This is **bold** text");

      expect(doc.child(0).textContent).toBe("This is bold text");
    });

    it("should parse inline formatting - italic", () => {
      const doc = parseMarkdown("This is *italic* text");

      expect(doc.child(0).textContent).toBe("This is italic text");
    });

    it("should parse inline formatting - code", () => {
      const doc = parseMarkdown("This is `code` text");

      expect(doc.child(0).textContent).toBe("This is code text");
    });

    it("should parse inline math as a dedicated math node", () => {
      const doc = parseMarkdown("Energy is $E=mc^2$ in prose.");

      expect(doc.child(0).type.name).toBe("paragraph");
      expect(doc.child(0).child(1)?.type.name).toBe("math_inline");
      expect(doc.child(0).child(1)?.textContent).toBe("E=mc^2");
    });

    it("should parse block math fences delimited by double dollars", () => {
      const doc = parseMarkdown("$$\nx^2 + y^2 = z^2\n$$");

      expect(doc.child(0).type.name).toBe("math_display");
      expect(doc.child(0).textContent).toBe("x^2 + y^2 = z^2");
    });

    it("should parse inline formatting - strikethrough", () => {
      const doc = parseMarkdown("This is ~~strikethrough~~ text");

      expect(doc.child(0).textContent).toBe("This is strikethrough text");
    });

    it("should parse inline formatting - bold and italic", () => {
      const doc = parseMarkdown("This is ***bolditalic*** text");

      expect(doc.child(0).textContent).toBe("This is bolditalic text");
    });

    it("should parse links", () => {
      const doc = parseMarkdown("[link text](https://example.com)");

      expect(doc.child(0).textContent).toBe("link text");
    });

    it("should parse wikilinks", () => {
      const doc = parseMarkdown("[[Note Name]]");

      expect(doc.child(0).textContent).toBe("Note Name");
    });

    it("should parse wikilinks with display text", () => {
      const doc = parseMarkdown("[[Note Name|Display Text]]");

      expect(doc.child(0).textContent).toBe("Display Text");
    });

    it("should parse embedded wikilinks", () => {
      const doc = parseMarkdown("![[Note Name]]");
      const linkNode = doc.child(0).child(0);

      expect(doc.child(0).textContent).toBe("Note Name");
      expect(linkNode.marks[0]?.type.name).toBe("wikilink");
      expect(linkNode.marks[0]?.attrs.target).toBe("Note Name");
      expect(linkNode.marks[0]?.attrs.embed).toBe(true);
    });

    it("should parse embedded wikilinks with display text", () => {
      const doc = parseMarkdown("![[Note Name|Display Text]]");
      const linkNode = doc.child(0).child(0);

      expect(doc.child(0).textContent).toBe("Display Text");
      expect(linkNode.marks[0]?.type.name).toBe("wikilink");
      expect(linkNode.marks[0]?.attrs.target).toBe("Note Name");
      expect(linkNode.marks[0]?.attrs.embed).toBe(true);
    });

    it("should handle empty lines", () => {
      const doc = parseMarkdown("Paragraph\n\n\nParagraph");
      expect(doc.childCount).toBe(2);
    });

    it("should handle mixed content", () => {
      const doc = parseMarkdown(
        "# Title\n\nParagraph with **bold** and *italic*.\n\n- List item 1\n- List item 2"
      );

      expect(doc.childCount).toBe(3);
      expect(doc.child(0).type.name).toBe("heading");
      expect(doc.child(1).type.name).toBe("paragraph");
      expect(doc.child(2).type.name).toBe("bullet_list");
    });
  });

  describe("Serialize Markdown", () => {
    it("should serialize a simple paragraph", () => {
      const doc = parseMarkdown("This is a paragraph");
      const serialized = serializeMarkdown(doc);

      expect(serialized).toBe("This is a paragraph");
    });

    it("should serialize headings", () => {
      const doc = parseMarkdown("# Heading");
      const serialized = serializeMarkdown(doc);

      expect(serialized).toBe("# Heading");
    });

    it("should serialize code blocks", () => {
      const doc = parseMarkdown("```javascript\nconst x = 1;\n```");
      const serialized = serializeMarkdown(doc);

      expect(serialized).toContain("```javascript");
      expect(serialized).toContain("const x = 1;");
      expect(serialized).toContain("```");
    });

    it("should preserve inline math on round-trip", () => {
      const markdown = "Energy is $E=mc^2$ in prose.";
      const doc = parseMarkdown(markdown);
      const serialized = serializeMarkdown(doc);

      expect(serialized).toContain("$E=mc^2$");
    });

    it("should preserve block math on round-trip", () => {
      const markdown = "$$\nx^2 + y^2 = z^2\n$$";
      const doc = parseMarkdown(markdown);
      const serialized = serializeMarkdown(doc);

      expect(serialized).toContain("$$");
      expect(serialized).toContain("x^2 + y^2 = z^2");
    });

    // TRACE: DESIGN-mermaid-diagrams-001
    it("should preserve mermaid fenced blocks on round-trip", () => {
      const markdown = "```mermaid\ngraph TD\n  A-->B\n```";
      const doc = parseMarkdown(markdown);
      const serialized = serializeMarkdown(doc);

      expect(serialized).toContain("```mermaid");
      expect(serialized).toContain("graph TD");
      expect(serialized).toContain("A-->B");
      expect(serialized).toContain("```");
    });

    it("should serialize blockquotes", () => {
      const doc = parseMarkdown("> Quote text");
      const serialized = serializeMarkdown(doc);

      expect(serialized).toBe("> Quote text");
    });

    it("should serialize bullet lists", () => {
      const doc = parseMarkdown("- Item 1\n- Item 2");
      const serialized = serializeMarkdown(doc);

      expect(serialized).toContain("- Item 1");
      expect(serialized).toContain("- Item 2");
    });

    it("should serialize ordered lists", () => {
      const doc = parseMarkdown("1. First\n2. Second");
      const serialized = serializeMarkdown(doc);

      expect(serialized).toContain("1. First");
      expect(serialized).toContain("2. Second");
    });

    it("should serialize task lists with checked state intact", () => {
      const markdown = "- [x] Done\n- [ ] Todo";
      const doc = parseMarkdown(markdown);
      const serialized = serializeMarkdown(doc);

      expect(serialized).toContain("- [x] Done");
      expect(serialized).toContain("- [ ] Todo");
    });

    it("should serialize GFM tables from the public markdown API", () => {
      const markdown = [
        "| Feature | Status |",
        "| --- | --- |",
        "| Tables | Ready |",
      ].join("\n");
      const doc = parseMarkdown(markdown);
      const serialized = serializeMarkdown(doc);

      expect(serialized).toBe([
        "|Feature|Status|",
        "|-|-|",
        "|Tables|Ready|",
      ].join("\n"));
    });

    it("should serialize GFM footnotes from the public markdown API", () => {
      const markdown = [
        "Reference[^1]",
        "",
        "[^1]: Footnote body",
      ].join("\n");
      const doc = parseMarkdown(markdown);
      const serialized = serializeMarkdown(doc);

      expect(serialized).toBe(markdown);
    });

    it("should serialize nested formatting inside GFM table cells", () => {
      const markdown = [
        "| Feature | Details |",
        "| --- | --- |",
        "| Tables | **Bold** and [docs](https://example.com) |",
      ].join("\n");
      const doc = parseMarkdown(markdown);
      const serialized = serializeMarkdown(doc);

      expect(serialized).toContain("**Bold**");
      expect(serialized).toContain("[docs](https://example.com)");
      expect(serialized).toContain("|Tables|");
    });

    it("should serialize nested formatting inside footnote definitions", () => {
      const markdown = [
        "Reference[^1]",
        "",
        "[^1]: **Bold** footnote with [docs](https://example.com).",
      ].join("\n");
      const doc = parseMarkdown(markdown);
      const serialized = serializeMarkdown(doc);

      expect(serialized).toContain("[^1]:");
      expect(serialized).toContain("**Bold**");
      expect(serialized).toContain("[docs](https://example.com)");
    });

    it("should serialize multiline footnote definitions with nested lists", () => {
      const markdown = [
        "Reference[^1]",
        "",
        "[^1]: First paragraph",
        "",
        "    - Child 1",
        "    - Child 2",
      ].join("\n");
      const doc = parseMarkdown(markdown);
      const serialized = serializeMarkdown(doc);

      expect(serialized).toContain("[^1]: First paragraph");
      expect(serialized).toContain("- Child 1");
      expect(serialized).toContain("- Child 2");
    });

    it("should serialize mixed inline marks inside a single table cell", () => {
      const markdown = [
        "| Feature | Details |",
        "| --- | --- |",
        "| Tables | **Bold** *italic* ~~strike~~ `code` [docs](https://example.com) |",
      ].join("\n");
      const doc = parseMarkdown(markdown);
      const serialized = serializeMarkdown(doc);

      expect(serialized).toContain("**Bold**");
      expect(serialized).toContain("*italic*");
      expect(serialized).toContain("~~strike~~");
      expect(serialized).toContain("`code`");
      expect(serialized).toContain("[docs](https://example.com)");
    });

    it("should reject block content inside table cells during serialization", () => {
      const doc = parseMarkdown([
        "| Feature | Details |",
        "| --- | --- |",
        "| Tables | First line |",
      ].join("\n"));

      const table = doc.child(0);
      const detailsCell = table.child(1)?.child(1);
      const blockquote = doc.type.schema.nodes.blockquote.create(
        null,
        doc.type.schema.nodes.paragraph.create(null, [doc.type.schema.text("Quoted detail")])
      );
      const list = doc.type.schema.nodes.bullet_list.create(null, [
        doc.type.schema.nodes.list_item.create(
          { task: false, checked: false },
          [doc.type.schema.nodes.paragraph.create(null, [doc.type.schema.text("Item detail")])]
        ),
      ]);
      const enrichedCell = detailsCell.type.create(detailsCell.attrs, [
        detailsCell.child(0),
        blockquote,
        list,
      ]);
      const enrichedRow = table.child(1).type.create(table.child(1).attrs, [
        table.child(1).child(0),
        enrichedCell,
      ]);
      const enrichedTable = table.type.create(table.attrs, [table.child(0), enrichedRow]);
      const enrichedDoc = doc.type.create(doc.attrs, [enrichedTable]);

      expect(() => serializeMarkdown(enrichedDoc)).toThrow(
        /table cells support paragraph content only/i
      );
    });

    it("should preserve raw HTML as literal text when serialized", () => {
      const markdown = "<span>unsafe</span>";
      const doc = parseMarkdown(markdown);
      const serialized = serializeMarkdown(doc);

      expect(serialized).toBe(markdown);
    });

    it("should serialize horizontal rules", () => {
      const doc = parseMarkdown("---");
      const serialized = serializeMarkdown(doc);

      expect(serialized).toBe("---");
    });

    it("should preserve inline formatting", () => {
      const doc = parseMarkdown("**bold** *italic* `code` ~~strike~~");
      const serialized = serializeMarkdown(doc);

      expect(serialized).toContain("**bold**");
      expect(serialized).toContain("*italic*");
      expect(serialized).toContain("`code`");
      expect(serialized).toContain("~~strike~~");
    });

    it("should serialize links", () => {
      const doc = parseMarkdown("[text](https://example.com)");
      const serialized = serializeMarkdown(doc);

      expect(serialized).toContain("[text](https://example.com)");
    });

    it("should serialize wikilinks", () => {
      const doc = parseMarkdown("[[Note Name]]");
      const serialized = serializeMarkdown(doc);

      expect(serialized).toContain("[[Note Name]]");
    });

    it("should serialize wikilinks with display text", () => {
      const doc = parseMarkdown("[[Note|Display]]");
      const serialized = serializeMarkdown(doc);

      expect(serialized).toContain("[[Note|Display]]");
    });

    it("should serialize embedded wikilinks", () => {
      const doc = parseMarkdown("![[Note Name]]");
      const serialized = serializeMarkdown(doc);

      expect(serialized).toContain("![[Note Name]]");
    });

    it("should serialize embedded wikilinks with display text", () => {
      const doc = parseMarkdown("![[Note|Display]]");
      const serialized = serializeMarkdown(doc);

      expect(serialized).toContain("![[Note|Display]]");
    });
  });

  describe("Round-trip Tests", () => {
    it("should preserve content after parse-serialize-parse cycle", () => {
      const original =
        "# Title\n\nParagraph with **bold** and *italic*.\n\n- List item 1\n- List item 2";

      const doc1 = parseMarkdown(original);
      const serialized = serializeMarkdown(doc1);
      const doc2 = parseMarkdown(serialized);

      expect(doc1.textContent).toBe(doc2.textContent);
    });

    it("should handle complex markdown structures", () => {
      const original =
        "# Main Title\n\n## Subtitle\n\nThis is a paragraph with **bold**, *italic*, and `code`.\n\n> A blockquote\n\n```javascript\nconst x = 1;\n```\n\n- List item 1\n- List item 2\n\n1. First\n2. Second\n\n---\n\nFinal paragraph.";

      const doc = parseMarkdown(original);
      const serialized = serializeMarkdown(doc);

      expect(serialized).toContain("# Main Title");
      expect(serialized).toContain("## Subtitle");
      expect(serialized).toContain("**bold**");
      expect(serialized).toContain("*italic*");
      expect(serialized).toContain("`code`");
      expect(serialized).toContain("> A blockquote");
      expect(serialized).toContain("```javascript");
      expect(serialized).toContain("- List item 1");
      expect(serialized).toContain("- List item 2");
    });
  });

  describe("Edge Cases", () => {
    it("should create a valid empty paragraph doc for empty content", () => {
      const doc = parseMarkdown("");
      expect(doc.type.name).toBe("doc");
      expect(doc.childCount).toBe(1);
      expect(doc.child(0).type.name).toBe("paragraph");
      expect(doc.child(0).textContent).toBe("");
    });

    it("should handle empty string", () => {
      const doc = parseMarkdown("  text  ");
      expect(doc.childCount).toBeGreaterThan(0);
    });

    it("should handle only whitespace", () => {
      const doc = parseMarkdown("  \n  text  \n  ");
      expect(doc.childCount).toBeGreaterThan(0);
    });

    it("should handle unclosed code blocks", () => {
      const doc = parseMarkdown("```javascript\nconst x = 1;");

      expect(doc.childCount).toBe(1);
      expect(doc.child(0).type.name).toBe("code_block");
    });

    it("should handle inline formatting without closing delimiter", () => {
      const doc = parseMarkdown("This is **bold but not closed");

      expect(doc.child(0).textContent).toContain("This is **bold but not closed");
    });

    it("should handle nested lists", () => {
      const doc = parseMarkdown("- Parent\n  - Child 1\n  - Child 2");

      expect(doc.childCount).toBe(1);
      expect(doc.child(0).type.name).toBe("bullet_list");
    });

    it("should handle multiple horizontal rules", () => {
      const doc = parseMarkdown("---\n\n---\n\n---");

      expect(doc.childCount).toBe(3);
      doc.forEach((child) => {
        expect(child.type.name).toBe("horizontal_rule");
      });
    });

    it("should report raw HTML as unsupported on the GFM seam while public parsing stays literal", () => {
      const markdown = "<aside>unsafe</aside>";
      const comparison = compareMarkdownEngines(markdown);

      expect(comparison.gfm.document).toBeNull();
      expect(comparison.gfm.diagnostics.some((diagnostic) => diagnostic.code === "unsupported-html")).toBe(true);
      expect(comparison.legacy.document?.textContent).toBe(markdown);
      expect(parseMarkdown(markdown).textContent).toBe(markdown);
    });
  });
});
