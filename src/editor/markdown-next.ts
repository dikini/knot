import MarkdownIt from "markdown-it";
import { MarkdownParser, MarkdownSerializer, defaultMarkdownSerializer } from "prosemirror-markdown";
import { Node as ProseMirrorNode } from "prosemirror-model";
import { schema } from "./schema";

function createMarkdownIt(): MarkdownIt {
  const md = new MarkdownIt("commonmark", {
    html: false,
    linkify: false,
    breaks: false,
  });

  md.enable("strikethrough");

  md.inline.ruler.before("link", "wikilink", (state, silent) => {
    const start = state.pos;
    const src = state.src;

    if (src.slice(start, start + 2) !== "[[") {
      return false;
    }

    const end = src.indexOf("]]", start + 2);
    if (end < 0) {
      return false;
    }

    const inner = src.slice(start + 2, end);
    const parts = inner.split("|", 2);
    const target = (parts[0] ?? "").trim();
    const display = (parts[1] ?? parts[0] ?? "").trim();

    if (!target || !display) {
      return false;
    }

    if (!silent) {
      const open = state.push("wikilink_open", "a", 1);
      open.meta = { target };

      const text = state.push("text", "", 0);
      text.content = display;

      state.push("wikilink_close", "a", -1);
    }

    state.pos = end + 2;
    return true;
  });

  return md;
}

const markdownTokenizer = createMarkdownIt();

const markdownParser = new MarkdownParser(schema, markdownTokenizer, {
  blockquote: { block: "blockquote" },
  paragraph: { block: "paragraph" },
  list_item: { block: "list_item" },
  bullet_list: { block: "bullet_list" },
  ordered_list: {
    block: "ordered_list",
    getAttrs: (token) => {
      const start = token.attrGet("start");
      return { order: start ? Number.parseInt(start, 10) : 1 };
    },
  },
  heading: {
    block: "heading",
    getAttrs: (token) => ({ level: Number.parseInt(token.tag.slice(1), 10) }),
  },
  code_block: {
    node: "code_block",
    noCloseToken: true,
    getAttrs: () => ({ language: null }),
  },
  fence: {
    node: "code_block",
    noCloseToken: true,
    getAttrs: (token) => {
      const language = token.info?.trim().split(/\s+/)[0] || null;
      return { language };
    },
  },
  hr: { node: "horizontal_rule" },
  image: {
    node: "image",
    getAttrs: (token) => ({
      src: token.attrGet("src"),
      title: token.attrGet("title"),
      alt: token.content || null,
    }),
  },
  hardbreak: { node: "hard_break" },
  em: { mark: "em" },
  strong: { mark: "strong" },
  link: {
    mark: "link",
    getAttrs: (token) => ({
      href: token.attrGet("href"),
      title: token.attrGet("title"),
      refId: token.attrGet("data-ref-id"),
    }),
  },
  code_inline: { mark: "code", noCloseToken: true },
  s: { mark: "strike" },
  wikilink: {
    mark: "wikilink",
    getAttrs: (token) => ({ target: token.meta?.target ?? "" }),
  },
});

const markdownSerializer = new MarkdownSerializer(
  {
    ...defaultMarkdownSerializer.nodes,
    code_block(state, node) {
      state.write("```" + ((node.attrs.language as string | null) ?? "") + "\n");
      state.text(node.textContent, false);
      state.ensureNewLine();
      state.write("```");
      state.closeBlock(node);
    },
  },
  {
    ...defaultMarkdownSerializer.marks,
    link: {
      open: (_state, mark) => {
        const refId = mark.attrs.refId as string | null;
        if (refId) {
          return "[";
        }
        return "[";
      },
      close: (_state, mark) => {
        const refId = mark.attrs.refId as string | null;
        if (refId) {
          return `][${refId}]`;
        }

        const href = mark.attrs.href as string;
        const title = mark.attrs.title as string | null;
        return title ? `](${href} \"${title}\")` : `](${href})`;
      },
      mixable: false,
    },
    strike: {
      open: "~~",
      close: "~~",
      mixable: true,
      expelEnclosingWhitespace: true,
    },
    wikilink: {
      open: (_state, mark) => `[[${String(mark.attrs.target)}|`,
      close: "]]",
      mixable: false,
    },
  }
);

export function parseMarkdownNextDocument(content: string): ProseMirrorNode {
  return markdownParser.parse(content);
}

export function serializeMarkdownNextDocument(doc: ProseMirrorNode): string {
  return markdownSerializer.serialize(doc);
}
