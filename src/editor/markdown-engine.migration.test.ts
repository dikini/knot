import { describe, it, expect } from "vitest";
import * as markdownModule from "./markdown";
import { parseMarkdown, parseMarkdownWithEngine, serializeMarkdown } from "./markdown";

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
  describe("adapter boundary contract", () => {
    it("exposes a markdown engine adapter factory", () => {
      expect(typeof (markdownModule as Record<string, unknown>).createMarkdownAdapter).toBe("function");
    });

    it("exposes parser routing entrypoints for legacy and new engines", () => {
      expect(typeof (markdownModule as Record<string, unknown>).parseMarkdownWithEngine).toBe("function");
      expect(typeof (markdownModule as Record<string, unknown>).serializeMarkdownWithEngine).toBe("function");
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

      expect(serialized).toContain("[Google][g]");
      expect(serialized).toContain("[g]: https://google.com \"Google\"");
    });

    it("supports reference link parsing through next-engine route", () => {
      const md = [
        "A [Google][g] reference.",
        "",
        "[g]: https://google.com \"Google\"",
      ].join("\n");

      const doc = parseMarkdownWithEngine(md, "next");
      const links: Array<{ text: string; href: string }> = [];
      doc.descendants((node) => {
        if (!node.isText || !node.text) return;
        const linkMark = node.marks.find((mark) => mark.type.name === "link");
        if (!linkMark) return;
        links.push({ text: node.text, href: String(linkMark.attrs.href) });
      });

      expect(links).toEqual([{ text: "Google", href: "https://google.com" }]);
    });

    it("supports wikilinks through next-engine route", () => {
      const doc = parseMarkdownWithEngine("[[Project Note|Project]]", "next");
      const wikilinks: Array<{ text: string; target: string }> = [];

      doc.descendants((node) => {
        if (!node.isText || !node.text) return;
        const wikilinkMark = node.marks.find((mark) => mark.type.name === "wikilink");
        if (!wikilinkMark) return;
        wikilinks.push({ text: node.text, target: String(wikilinkMark.attrs.target) });
      });

      expect(wikilinks).toEqual([{ text: "Project", target: "Project Note" }]);
    });
  });
});
