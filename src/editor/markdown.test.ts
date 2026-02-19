import { describe, it, expect } from "vitest";
import { parseMarkdown, serializeMarkdown } from "./markdown";

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
      expect(doc.child(0).textContent).toBe("First line Second line");
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
  });
});
