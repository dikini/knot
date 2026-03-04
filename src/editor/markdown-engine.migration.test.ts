import { describe, it, expect } from "vitest";
import * as markdownModule from "./markdown";
import { compareMarkdownEngines, parseMarkdown, serializeMarkdown } from "./markdown";
import { schema } from "./schema";

const defaultTableCellAttrs = {
  colspan: 1,
  colwidth: null,
  rowspan: 1,
};

function collectMarkData<T>(
  markdownText: string,
  markName: string,
  map: (text: string, attrs: Record<string, unknown>) => T
): T[] {
  const doc = parseMarkdown(markdownText);
  const collected: T[] = [];

  doc.descendants((node) => {
    if (!node.isText || !node.text) return;

    const mark = node.marks.find((entry) => entry.type.name === markName);
    if (!mark) return;

    collected.push(map(node.text, mark.attrs as Record<string, unknown>));
  });

  return collected;
}

function collectLinkMarks(markdownText: string): Array<{ text: string; href: string }> {
  return collectMarkData(markdownText, "link", (text, attrs) => ({
    text,
    href: String(attrs.href),
  }));
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

  describe("MDP-002 GFM baseline fixtures", () => {
    it("GFM-TABLE-001: preserves canonical pipe-table markdown instead of collapsing it into paragraph text", () => {
      const md = [
        "| Feature | Status |",
        "| --- | --- |",
        "| Tables | Planned |",
        "| Footnotes | Planned |",
      ].join("\n");

      const comparison = compareMarkdownEngines(md);

      expect(comparison.legacy.document?.child(0)?.type.name).toBe("paragraph");
      expect(comparison.gfm.document?.child(0)?.type.name).toBe("table");
      expect(comparison.gfm.document?.toJSON()).toEqual({
        type: "doc",
        attrs: {
          referenceDefinitions: {},
          referenceOrder: [],
        },
        content: [
          {
            type: "table",
            content: [
              {
                type: "table_row",
                content: [
                  {
                    type: "table_header",
                    attrs: defaultTableCellAttrs,
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: "Feature" }],
                      },
                    ],
                  },
                  {
                    type: "table_header",
                    attrs: defaultTableCellAttrs,
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: "Status" }],
                      },
                    ],
                  },
                ],
              },
              {
                type: "table_row",
                content: [
                  {
                    type: "table_cell",
                    attrs: defaultTableCellAttrs,
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: "Tables" }],
                      },
                    ],
                  },
                  {
                    type: "table_cell",
                    attrs: defaultTableCellAttrs,
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: "Planned" }],
                      },
                    ],
                  },
                ],
              },
              {
                type: "table_row",
                content: [
                  {
                    type: "table_cell",
                    attrs: defaultTableCellAttrs,
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: "Footnotes" }],
                      },
                    ],
                  },
                  {
                    type: "table_cell",
                    attrs: defaultTableCellAttrs,
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: "Planned" }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });
      expect(comparison.gfm.markdown).toBe(md);
    });

    it("GFM-AUTOLINK-001: parses autolinks through the public API after the GFM cutover", () => {
      const md = "Visit https://example.com/docs for the migration guide.";
      const doc = parseMarkdown(md);
      const serialized = serializeMarkdown(doc);

      expect(doc.child(0)?.textContent).toBe("Visit https://example.com/docs for the migration guide.");
      expect(collectLinkMarks(md)).toEqual([
        { text: "https://example.com/docs", href: "https://example.com/docs" },
      ]);
      expect(serialized).toContain("https://example.com/docs");
    });

    it("GFM-FOOTNOTE-001: exposes structured footnotes through the public parse path", () => {
      const md = [
        "Footnote reference.[^1]",
        "",
        "[^1]: Footnote body with [docs](https://example.com/docs).",
      ].join("\n");

      const publicDoc = parseMarkdown(md);
      const comparison = compareMarkdownEngines(md);
      const footnoteReferences: Array<{ id: string; label: string }> = [];
      const footnoteDefinitions: Array<{ id: string; label: string; text: string }> = [];

      comparison.gfm.document?.descendants((node) => {
        if (node.type.name === "footnote_reference") {
          footnoteReferences.push({
            id: String(node.attrs.id),
            label: String(node.attrs.label),
          });
        }

        if (node.type.name === "footnote_definition") {
          footnoteDefinitions.push({
            id: String(node.attrs.id),
            label: String(node.attrs.label),
            text: node.textContent,
          });
        }
      });

      expect(footnoteReferences).toEqual([{ id: "1", label: "1" }]);
      expect(footnoteDefinitions).toEqual([
        {
          id: "1",
          label: "1",
          text: "Footnote body with docs.",
        },
      ]);
      expect(publicDoc.child(0)?.child(1)?.type.name).toBe("footnote_reference");
      expect(publicDoc.child(1)?.type.name).toBe("footnote_definition");
      expect(comparison.gfm.markdown).toBe(md);
    });
  });

  describe("MDP-002 mixed native and extension fixtures", () => {
    it("GFM-MIXED-001: preserves table, inline math, and footnote semantics together at the GFM seam", () => {
      const md = [
        "| Note | Formula |",
        "| --- | --- |",
        "| Project | $E=mc^2$[^calc] |",
        "",
        "[^calc]: See https://example.com/calc for derivation.",
      ].join("\n");

      const comparison = compareMarkdownEngines(md);

      expect(comparison.legacy.document?.child(0)?.type.name).toBe("paragraph");
      expect(comparison.gfm.document?.child(0)?.type.name).toBe("table");
      const gfmDoc = comparison.gfm.document;
      const mathNodes: string[] = [];
      const footnoteReferences: Array<{ id: string; label: string }> = [];

      gfmDoc?.descendants((node) => {
        if (node.type.name === "math_inline") {
          mathNodes.push(node.textContent);
        }

        if (node.type.name === "footnote_reference") {
          footnoteReferences.push({
            id: String(node.attrs.id),
            label: String(node.attrs.label),
          });
        }
      });

      expect(mathNodes).toEqual(["E=mc^2"]);
      expect(footnoteReferences).toEqual([{ id: "calc", label: "calc" }]);
      expect(comparison.gfm.markdown).toBe(md);
    });
  });
});
