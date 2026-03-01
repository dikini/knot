/**
 * ProseMirror schema for semantic markdown editing
 * 
 * This schema supports:
 * - Standard markdown nodes (headings, lists, code blocks, etc.)
 * - Marks (bold, italic, code, links)
 * - Wikilinks [[Note Name]]
 * - Media embeds (images, videos)
 */

import { Schema, DOMOutputSpec, Node as ProseMirrorNode, Mark } from "prosemirror-model";

const nodes = {
  doc: {
    attrs: {
      referenceDefinitions: { default: {} },
      referenceOrder: { default: [] },
    },
    content: "block+",
  },

  paragraph: {
    content: "inline*",
    group: "block",
    parseDOM: [{ tag: "p" }],
    toDOM(): DOMOutputSpec {
      return ["p", 0];
    },
  },

  heading: {
    attrs: { level: { default: 1 } },
    content: "inline*",
    group: "block",
    defining: true,
    parseDOM: [
      { tag: "h1", attrs: { level: 1 } },
      { tag: "h2", attrs: { level: 2 } },
      { tag: "h3", attrs: { level: 3 } },
      { tag: "h4", attrs: { level: 4 } },
      { tag: "h5", attrs: { level: 5 } },
      { tag: "h6", attrs: { level: 6 } },
    ],
    toDOM(node: ProseMirrorNode): DOMOutputSpec {
      return ["h" + node.attrs.level, 0];
    },
  },

  blockquote: {
    content: "block+",
    group: "block",
    defining: true,
    parseDOM: [{ tag: "blockquote" }],
    toDOM(): DOMOutputSpec {
      return ["blockquote", 0];
    },
  },

  code_block: {
    content: "text*",
    marks: "",
    group: "block",
    code: true,
    defining: true,
    attrs: { language: { default: null } },
    parseDOM: [
      {
        tag: "pre",
        preserveWhitespace: "full" as const,
        getAttrs: (node: HTMLElement) => ({
          language: node.getAttribute("data-language"),
        }),
      },
    ],
    toDOM(node: ProseMirrorNode): DOMOutputSpec {
      return [
        "pre",
        node.attrs.language ? { "data-language": node.attrs.language } : {},
        ["code", 0],
      ];
    },
  },

  bullet_list: {
    content: "list_item+",
    group: "block",
    parseDOM: [{ tag: "ul" }],
    toDOM(): DOMOutputSpec {
      return ["ul", 0];
    },
  },

  ordered_list: {
    content: "list_item+",
    group: "block",
    attrs: { order: { default: 1 } },
    parseDOM: [
      {
        tag: "ol",
        getAttrs: (dom: HTMLElement) => ({
          order: dom.hasAttribute("start") ? parseInt(dom.getAttribute("start") || "1", 10) : 1,
        }),
      },
    ],
    toDOM(node: ProseMirrorNode): DOMOutputSpec {
      return node.attrs.order === 1
        ? ["ol", 0]
        : ["ol", { start: node.attrs.order }, 0];
    },
  },

  list_item: {
    attrs: {
      task: { default: false },
      checked: { default: false },
    },
    content: "paragraph block*",
    defining: true,
    parseDOM: [{ tag: "li" }],
    toDOM(node: ProseMirrorNode): DOMOutputSpec {
      const attrs =
        node.attrs.task === true
          ? {
              "data-task": "true",
              "data-checked": node.attrs.checked === true ? "true" : "false",
            }
          : {};
      return ["li", attrs, 0];
    },
  },

  image: {
    inline: true,
    attrs: {
      src: {},
      alt: { default: null },
      title: { default: null },
    },
    group: "inline",
    draggable: true,
    parseDOM: [
      {
        tag: "img[src]",
        getAttrs: (dom: HTMLElement) => ({
          src: dom.getAttribute("src"),
          title: dom.getAttribute("title"),
          alt: dom.getAttribute("alt"),
        }),
      },
    ],
    toDOM(node: ProseMirrorNode): DOMOutputSpec {
      const { src, alt, title } = node.attrs;
      return ["img", { src, alt, title }];
    },
  },

  hard_break: {
    inline: true,
    group: "inline",
    selectable: false,
    parseDOM: [{ tag: "br" }],
    toDOM(): DOMOutputSpec {
      return ["br"];
    },
  },

  horizontal_rule: {
    group: "block",
    parseDOM: [{ tag: "hr" }],
    toDOM(): DOMOutputSpec {
      return ["hr"];
    },
  },

  text: {
    group: "inline",
  },
};

const marks = {
  strong: {
    parseDOM: [
      { tag: "strong" },
      { tag: "b", getAttrs: (node: HTMLElement) => node.style.fontWeight !== "normal" && null },
      { style: "font-weight=400", clearMark: (m: Mark) => m.type.name === "strong" },
      { style: "font-weight", getAttrs: (value: string) => /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null },
    ],
    toDOM(): DOMOutputSpec {
      return ["strong", 0];
    },
  },

  em: {
    parseDOM: [
      { tag: "em" },
      { tag: "i", getAttrs: (node: HTMLElement) => node.style.fontStyle !== "normal" && null },
      { style: "font-style=italic" },
    ],
    toDOM(): DOMOutputSpec {
      return ["em", 0];
    },
  },

  code: {
    parseDOM: [{ tag: "code" }],
    toDOM(): DOMOutputSpec {
      return ["code", 0];
    },
  },

  link: {
    attrs: {
      href: {},
      title: { default: null },
      refId: { default: null },
    },
    inclusive: false,
    parseDOM: [
      {
        tag: "a[href]",
        getAttrs: (dom: HTMLElement) => ({
          href: dom.getAttribute("href"),
          title: dom.getAttribute("title"),
          refId: dom.getAttribute("data-ref-id"),
        }),
      },
    ],
    toDOM(mark: Mark): DOMOutputSpec {
      const { href, title, refId } = mark.attrs;
      return ["a", refId ? { href, title, "data-ref-id": refId } : { href, title }, 0];
    },
  },

  strike: {
    parseDOM: [
      { tag: "s" },
      { tag: "del" },
      { tag: "strike" },
      { style: "text-decoration=line-through" },
    ],
    toDOM(): DOMOutputSpec {
      return ["s", 0];
    },
  },

  // Custom wikilink mark for [[Note Name]] syntax
  wikilink: {
    attrs: {
      target: {},
    },
    inclusive: false,
    parseDOM: [
      {
        tag: "a[data-wikilink]",
        getAttrs: (dom: HTMLElement) => ({
          target: dom.getAttribute("data-wikilink"),
        }),
      },
    ],
    toDOM(mark: Mark): DOMOutputSpec {
      return [
        "a",
        {
          "data-wikilink": mark.attrs.target,
          class: "wikilink",
          href: `#${mark.attrs.target}`,
        },
        0,
      ];
    },
  },
};

export const schema = new Schema({ nodes, marks });
