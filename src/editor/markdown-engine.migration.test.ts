import { describe, it, expect } from "vitest";
import * as markdownModule from "./markdown";
import { parseMarkdown, serializeMarkdown } from "./markdown";
import { schema } from "./schema";

function collectLinkMarks(markdownText: string): Array<{ text: string; href: string }> {
  const doc = parseMarkdown(markdownText);
  const links: Array<{ text: string; href: string }> = [];

  doc.descendants((node) => {
    if (!node.isText || !node.text) return;

    const linkMark = node.marks.find((mark) => mark.type.name === "link");
    if (!linkMark) return;

    links.push({ text: node.text, href: String(linkMark.attrs.href) });
  });

  return links;
}

describe("Markdown engine migration (TDD)", () => {
  describe("single engine contract", () => {
    it("exposes stable parse/serialize entrypoints", () => {
      expect(typeof (markdownModule as Record<string, unknown>).parseMarkdown).toBe("function");
      expect(typeof (markdownModule as Record<string, unknown>).serializeMarkdown).toBe("function");
    });
  });

  describe("reference link support", () => {
    it("parses full reference links and resolves href from definitions", () => {
      const md = [
        "A [Google][g] reference.",
        "",
        "[g]: https://google.com \"Google\"",
      ].join("\n");

      const links = collectLinkMarks(md);
      expect(links).toEqual([{ text: "Google", href: "https://google.com" }]);
    });

    it("parses collapsed and shortcut reference links", () => {
      const md = [
        "Use [g][] and [docs].",
        "",
        "[g]: https://google.com",
        "[docs]: https://example.com/docs",
      ].join("\n");

      const links = collectLinkMarks(md);
      expect(links).toEqual([
        { text: "g", href: "https://google.com" },
        { text: "docs", href: "https://example.com/docs" },
      ]);
    });

    it("preserves reference link definitions on round-trip serialization", () => {
      const md = [
        "A [Google][g] reference.",
        "",
        "[g]: https://google.com \"Google\"",
      ].join("\n");

      const doc = parseMarkdown(md);
      const serialized = serializeMarkdown(doc);

      expect(serialized).toContain("[Google](https://google.com \"Google\")");
      expect(serialized).toContain("[g]: https://google.com \"Google\"");
    });

    it("supports reference link parsing", () => {
      const md = [
        "A [Google][g] reference.",
        "",
        "[g]: https://google.com \"Google\"",
      ].join("\n");

      const doc = parseMarkdown(md);
      const links: Array<{ text: string; href: string }> = [];
      doc.descendants((node) => {
        if (!node.isText || !node.text) return;
        const linkMark = node.marks.find((mark) => mark.type.name === "link");
        if (!linkMark) return;
        links.push({ text: node.text, href: String(linkMark.attrs.href) });
      });

      expect(links).toEqual([{ text: "Google", href: "https://google.com" }]);
    });

    it("supports wikilinks", () => {
      const doc = parseMarkdown("[[Project Note|Project]]");
      const wikilinks: Array<{ text: string; target: string }> = [];

      doc.descendants((node) => {
        if (!node.isText || !node.text) return;
        const wikilinkMark = node.marks.find((mark) => mark.type.name === "wikilink");
        if (!wikilinkMark) return;
        wikilinks.push({ text: node.text, target: String(wikilinkMark.attrs.target) });
      });

      expect(wikilinks).toEqual([{ text: "Project", target: "Project Note" }]);
    });

    it("BUG-WIKILINK-ESCAPE-001: does not escape plain wikilink text when serializing", () => {
      const doc = schema.node("doc", null, [
        schema.node("paragraph", null, [schema.text("[[Neural Networks]]")]),
      ]);

      const markdown = serializeMarkdown(doc);
      expect(markdown).toContain("[[Neural Networks]]");
      expect(markdown).not.toContain("\\[\\[");
    });
  });
});
