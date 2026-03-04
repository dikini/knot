import { describe, expect, it } from "vitest";
import { compareMarkdownEngines, parseMarkdown, serializeMarkdown } from "./markdown";
import {
  createMarkdownExtensionRegistry,
  defaultMarkdownExtensionRegistry,
  getMarkdownExtensionFamily,
} from "./markdown-extensions";
import { parseGfmMarkdown, serializeGfmMarkdownSyntaxTree } from "./markdown-gfm";

const defaultTableCellAttrs = {
  colspan: 1,
  colwidth: null,
  rowspan: 1,
};

describe("markdown syntax seam", () => {
  it("defines a default extension registry for wikilink and math families", () => {
    const familyKeys = defaultMarkdownExtensionRegistry.families.map((family) => family.key);
    const wikilink = getMarkdownExtensionFamily(defaultMarkdownExtensionRegistry, "wikilink");
    const math = getMarkdownExtensionFamily(defaultMarkdownExtensionRegistry, "math");

    expect(familyKeys).toEqual(["wikilink", "math"]);

    expect(wikilink).toMatchObject({
      key: "wikilink",
      classification: "knot_extension",
      variants: [
        {
          key: "wikilink",
          syntaxForm: "[[target|label]]",
          parseRule: "registry wikilink syntax transform",
          serializeRule: "registry wikilink serializer",
          schemaRepresentation: ["wikilink"],
          presentation: {
            edit: ["wikilink mark"],
            view: ["wikilink anchor"],
          },
          backendSupport: "backend_optional",
        },
        {
          key: "embed",
          syntaxForm: "![[target]]",
          parseRule: "registry wikilink syntax transform",
          serializeRule: "registry embed serializer",
          schemaRepresentation: ["wikilink"],
          presentation: {
            edit: ["wikilink mark"],
            view: ["embedded note render"],
          },
          backendSupport: "backend_optional",
        },
      ],
    });

    expect(math).toMatchObject({
      key: "math",
      classification: "knot_extension",
      variants: [
        {
          key: "inline_math",
          syntaxForm: "$...$",
          parseRule: "registry inline math syntax transform",
          serializeRule: "registry inline math serializer",
          schemaRepresentation: ["math_inline"],
          presentation: {
            edit: ["inline math node"],
            view: ["KaTeX inline render"],
          },
          backendSupport: "backend_optional",
        },
        {
          key: "display_math",
          syntaxForm: "$$...$$",
          parseRule: "registry block math syntax transform",
          serializeRule: "registry display math serializer",
          schemaRepresentation: ["math_display"],
          presentation: {
            edit: ["display math node"],
            view: ["KaTeX display render"],
          },
          backendSupport: "backend_optional",
        },
      ],
    });
  });

  it("keeps the public parse/serialize API stable for existing callers", () => {
    const markdown = "- [x] Done\n- [ ] Todo";
    const expected = "- [x] Done\n- [ ] Todo";

    const doc = parseMarkdown(markdown);

    expect(doc.child(0)?.type.name).toBe("bullet_list");
    expect(doc.child(0)?.child(0)?.attrs.task).toBe(true);
    expect(doc.child(0)?.child(0)?.attrs.checked).toBe(true);
    expect(serializeMarkdown(doc)).toBe(expected);
  });

  it("compares legacy and gfm engines on a representable subset", () => {
    const markdown = [
      "# Migration",
      "",
      "- [x] Done",
      "- Visit [docs](https://example.com/docs)",
      "",
      "This is ~~important~~.",
    ].join("\n");

    const comparison = compareMarkdownEngines(markdown);

    expect(comparison.legacy.engine).toBe("legacy");
    expect(comparison.gfm.engine).toBe("gfm");
    expect(comparison.legacy.diagnostics).toEqual([]);
    expect(comparison.gfm.diagnostics).toEqual([]);
    expect(comparison.gfm.document?.toJSON()).toEqual(comparison.legacy.document?.toJSON());
    expect(comparison.gfm.markdown).toContain("[docs](https://example.com/docs)");
    expect(comparison.gfm.markdown).toContain("~~important~~");
  });

  it("preserves representable GFM reference links and keeps legacy/gfm comparison parity", () => {
    const markdown = [
      "Read [Guide][Docs] and [Docs][docs].",
      "",
      "[docs]: https://example.com/guide \"Guide\"",
    ].join("\n");

    const comparison = compareMarkdownEngines(markdown);
    const gfmSerialized = serializeMarkdown(comparison.gfm.document!);
    const legacySerialized = serializeMarkdown(comparison.legacy.document!);

    expect(comparison.legacy.diagnostics).toEqual([]);
    expect(comparison.gfm.diagnostics).toEqual([]);
    expect(comparison.gfm.document?.toJSON()).toEqual(comparison.legacy.document?.toJSON());
    expect(gfmSerialized).toBe(legacySerialized);
    expect(gfmSerialized).toContain('[docs]: https://example.com/guide "Guide"');
    expect(gfmSerialized).toContain("[Guide](https://example.com/guide \"Guide\")");
    expect(gfmSerialized).toContain("[Docs](https://example.com/guide \"Guide\")");
  });

  it("deduplicates case-only reference definition ids during serialization", () => {
    const markdown = [
      "[Alpha][Docs] [Beta][docs]",
      "",
      "[Docs]: https://example.com/a",
      "[docs]: https://example.com/b",
    ].join("\n");

    const doc = parseMarkdown(markdown);
    const serialized = serializeMarkdown(doc);

    expect(serialized.match(/^\[(Docs|docs)\]:/gm)).toHaveLength(1);
  });

  it("bridges GFM tables into structured table nodes at the migration seam", () => {
    const markdown = [
      "| Feature | Status |",
      "| --- | --- |",
      "| Tables | Pending |",
    ].join("\n");

    const comparison = compareMarkdownEngines(markdown);

    expect(comparison.legacy.document?.child(0)?.type.name).toBe("paragraph");
    expect(comparison.gfm.document).not.toBeNull();
    expect(comparison.gfm.markdown).toBe(markdown);
    expect(comparison.gfm.diagnostics).toEqual([]);
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
                      content: [{ type: "text", text: "Pending" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it("bridges GFM footnote references and definitions into structured nodes at the migration seam", () => {
    const markdown = [
      "Reference[^1]",
      "",
      "[^1]: Footnote body",
    ].join("\n");

    const comparison = compareMarkdownEngines(markdown);

    expect(comparison.legacy.document?.textContent).toContain("Reference[^1]");
    expect(comparison.gfm.document).not.toBeNull();
    expect(comparison.gfm.markdown).toBe(markdown);
    expect(comparison.gfm.diagnostics).toEqual([]);
    expect(comparison.gfm.document?.toJSON()).toEqual({
      type: "doc",
      attrs: {
        referenceDefinitions: {},
        referenceOrder: [],
      },
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Reference" },
            {
              type: "footnote_reference",
              attrs: {
                id: "1",
                label: "1",
              },
            },
          ],
        },
        {
          type: "footnote_definition",
          attrs: {
            id: "1",
            label: "1",
          },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Footnote body" }],
            },
          ],
        },
      ],
    });
  });

  it("threads the extension registry through the GFM seam so math can be turned on explicitly", () => {
    const markdown = "Inline math $E=mc^2$ stays explicit.";
    const withoutExtensions = createMarkdownExtensionRegistry([]);

    const defaultComparison = compareMarkdownEngines(markdown);
    const noExtensionComparison = compareMarkdownEngines(markdown, {
      extensionRegistry: withoutExtensions,
    });

    expect(defaultComparison.gfm.diagnostics).toEqual([]);
    expect(defaultComparison.gfm.document?.toJSON()).toEqual({
      type: "doc",
      attrs: {
        referenceDefinitions: {},
        referenceOrder: [],
      },
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Inline math " },
            {
              type: "math_inline",
              content: [{ type: "text", text: "E=mc^2" }],
            },
            { type: "text", text: " stays explicit." },
          ],
        },
      ],
    });
    expect(noExtensionComparison.gfm.diagnostics).toEqual([]);
    expect(noExtensionComparison.gfm.document?.textContent).toBe(markdown);
  });

  it("accepts future extension family and variant keys without central type updates", () => {
    const registry = createMarkdownExtensionRegistry([
      {
        key: "callout",
        classification: "future_extension",
        variants: [
          {
            key: "aside",
            syntaxForm: "::aside",
            parseRule: "future directive parser",
            serializeRule: "future directive serializer",
            schemaRepresentation: ["callout"],
            presentation: {
              edit: ["callout node"],
              view: ["callout render"],
            },
            backendSupport: "backend_optional",
          },
        ],
      },
    ]);

    expect(getMarkdownExtensionFamily(registry, "callout")).toMatchObject({
      key: "callout",
      variants: [{ key: "aside" }],
    });
  });

  it("uses registered serializer hooks to round-trip current extension syntax from the transformed tree", () => {
    const markdown = "See [[Project Note|Project]] and ![[Spec]] with $E=mc^2$.";
    const parsed = parseGfmMarkdown(markdown);

    expect(serializeGfmMarkdownSyntaxTree(parsed.syntaxTree)).toBe(markdown);
  });

  it("lets the registry own wikilink and embed behavior in the gfm seam", () => {
    const markdown = "Before [[Project Note|Project]] and ![[Spec]].";
    const withoutExtensions = createMarkdownExtensionRegistry([]);

    const withRegistry = parseGfmMarkdown(markdown);
    const withoutRegistry = parseGfmMarkdown(markdown, undefined, withoutExtensions);

    expect(withRegistry.diagnostics).toEqual([]);
    expect(withRegistry.document?.toJSON()).toEqual({
      type: "doc",
      attrs: {
        referenceDefinitions: {},
        referenceOrder: [],
      },
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Before " },
            {
              type: "text",
              text: "Project",
              marks: [{ type: "wikilink", attrs: { target: "Project Note", embed: false } }],
            },
            { type: "text", text: " and " },
            {
              type: "text",
              text: "Spec",
              marks: [{ type: "wikilink", attrs: { target: "Spec", embed: true } }],
            },
            { type: "text", text: "." },
          ],
        },
      ],
    });
    expect(withoutRegistry.diagnostics).toEqual([]);
    expect(withoutRegistry.document?.textContent).toBe(markdown);
  });

  it("does not turn ordinary currency amounts into inline math", () => {
    const markdown = "Price is $5 and tax is $2";

    const parsed = parseGfmMarkdown(markdown);

    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.document?.toJSON()).toEqual({
      type: "doc",
      attrs: {
        referenceDefinitions: {},
        referenceOrder: [],
      },
      content: [{ type: "paragraph", content: [{ type: "text", text: markdown }] }],
    });
  });

  it("derives reference-definition state when parseGfmMarkdown is called directly", () => {
    const markdown = ["Read [Guide][docs].", "", '[docs]: https://example.com/guide "Guide"'].join("\n");

    const parsed = parseGfmMarkdown(markdown);

    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.document?.attrs).toEqual({
      referenceDefinitions: {
        docs: {
          id: "docs",
          href: "https://example.com/guide",
          title: "Guide",
        },
      },
      referenceOrder: ["docs"],
    });
  });

  it("uses mdast-derived reference state in GFM comparisons for valid definition forms outside the legacy regex subset", () => {
    const markdown = ["Read [Guide][docs].", "", "[docs]: https://example.com/guide 'Guide'"].join("\n");

    const comparison = compareMarkdownEngines(markdown);

    expect(comparison.legacy.document?.attrs).toEqual({
      referenceDefinitions: {},
      referenceOrder: [],
    });
    expect(comparison.gfm.document?.attrs).toEqual({
      referenceDefinitions: {
        docs: {
          id: "docs",
          href: "https://example.com/guide",
          title: "Guide",
        },
      },
      referenceOrder: ["docs"],
    });
  });

  it("keeps ordinary escaped text escaped when serializing GFM syntax trees", () => {
    const markdown = String.raw`Escaped \[\[Project Note\]\] stays literal.`;

    const parsed = parseGfmMarkdown(markdown);

    expect(serializeGfmMarkdownSyntaxTree(parsed.syntaxTree)).toBe(markdown);
  });

  it("emits a diagnostic instead of dropping marks around inline math", () => {
    const markdown = "**$E=mc^2$**";

    const parsed = parseGfmMarkdown(markdown);

    expect(parsed.document).toBeNull();
    expect(parsed.diagnostics).toEqual([
      expect.objectContaining({
        code: "unsupported-marked-inline-math",
        engine: "gfm",
        feature: "math",
        severity: "warning",
      }),
    ]);
  });
});
