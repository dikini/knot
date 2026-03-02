import MarkdownIt from "markdown-it";
import { MarkdownParser, MarkdownSerializer, defaultMarkdownSerializer } from "prosemirror-markdown";
import { Fragment, Node as ProseMirrorNode } from "prosemirror-model";
import { schema } from "./schema";

function createMarkdownIt(): MarkdownIt {
  const md = new MarkdownIt("commonmark", {
    html: false,
    linkify: false,
    breaks: false,
  });

  md.enable("strikethrough");

  md.block.ruler.before("fence", "math_display", (state, startLine, endLine, silent) => {
    const start = state.bMarks[startLine] + state.tShift[startLine];
    const max = state.eMarks[startLine];
    if (state.src.slice(start, max).trim() !== "$$") {
      return false;
    }

    let nextLine = startLine + 1;
    while (nextLine < endLine) {
      const nextStart = state.bMarks[nextLine] + state.tShift[nextLine];
      const nextMax = state.eMarks[nextLine];
      if (state.src.slice(nextStart, nextMax).trim() === "$$") {
        if (!silent) {
          const token = state.push("math_display", "math-display", 0);
          token.block = true;
          token.content = state.getLines(startLine + 1, nextLine, 0, true).replace(/\n$/, "");
          token.map = [startLine, nextLine + 1];
        }
        state.line = nextLine + 1;
        return true;
      }
      nextLine += 1;
    }

    return false;
  });

  md.inline.ruler.before("link", "wikilink", (state, silent) => {
    const start = state.pos;
    const src = state.src;
    const embed = src[start] === "!";
    const openingOffset = embed ? 1 : 0;

    if (src.slice(start + openingOffset, start + openingOffset + 2) !== "[[") {
      return false;
    }

    const end = src.indexOf("]]", start + openingOffset + 2);
    if (end < 0) {
      return false;
    }

    const inner = src.slice(start + openingOffset + 2, end);
    const parts = inner.split("|", 2);
    const target = (parts[0] ?? "").trim();
    const display = (parts[1] ?? parts[0] ?? "").trim();

    if (!target || !display) {
      return false;
    }

    if (!silent) {
      const open = state.push("wikilink_open", "a", 1);
      open.meta = { target, embed };

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
    block: "code_block",
    noCloseToken: true,
    getAttrs: () => ({ language: null }),
  },
  fence: {
    block: "code_block",
    noCloseToken: true,
    getAttrs: (token) => {
      const language = token.info?.trim().split(/\s+/)[0] || null;
      return { language };
    },
  },
  math_display: {
    block: "math_display",
    noCloseToken: true,
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
    getAttrs: (token) => ({ target: token.meta?.target ?? "", embed: token.meta?.embed === true }),
  },
});

const markdownSerializer = new MarkdownSerializer(
  {
    ...defaultMarkdownSerializer.nodes,
    bullet_list(state, node) {
      state.renderList(node, "  ", () => "- ");
    },
    list_item(state, node, parent, index) {
      const checkboxPrefix =
        node.attrs.task === true ? `[${node.attrs.checked === true ? "x" : " "}] ` : "";
      const firstChild = node.firstChild;

      if (firstChild?.type.name === "paragraph") {
        state.write(checkboxPrefix);
        state.renderInline(firstChild, false);
        state.closeBlock(firstChild);
        for (let childIndex = 1; childIndex < node.childCount; childIndex += 1) {
          state.render(node.child(childIndex), node, childIndex);
        }
        return;
      }

      state.write(checkboxPrefix);
      defaultMarkdownSerializer.nodes.list_item(state, node, parent, index);
    },
    code_block(state, node) {
      state.write("```" + ((node.attrs.language as string | null) ?? "") + "\n");
      state.text(node.textContent, false);
      state.ensureNewLine();
      state.write("```");
      state.closeBlock(node);
    },
    math_display(state, node) {
      state.write("$$\n");
      state.text(node.textContent, false);
      state.ensureNewLine();
      state.write("$$");
      state.closeBlock(node);
    },
    math_inline(state, node) {
      state.write(`$${node.textContent}$`);
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
        return title ? `](${href} "${title}")` : `](${href})`;
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
      open: (_state, mark) => `${mark.attrs.embed ? "!" : ""}[[${String(mark.attrs.target)}|`,
      close: "]]",
      mixable: false,
    },
  }
);

export function parseMarkdownNextDocument(content: string): ProseMirrorNode {
  return normalizeInlineMathNodes(normalizeTaskListItems(markdownParser.parse(content)));
}

export function serializeMarkdownNextDocument(doc: ProseMirrorNode): string {
  return markdownSerializer.serialize(doc);
}

function normalizeTaskListItems(node: ProseMirrorNode): ProseMirrorNode {
  if (node.isText) {
    return node;
  }

  const normalizedChildren: ProseMirrorNode[] = [];
  node.forEach((child) => {
    normalizedChildren.push(normalizeTaskListItems(child));
  });

  if (node.type.name !== "list_item" || normalizedChildren.length === 0) {
    return node.type.create(node.attrs, normalizedChildren, node.marks);
  }

  const firstChild = normalizedChildren[0];
  if (firstChild.type.name !== "paragraph") {
    return node.type.create(node.attrs, normalizedChildren, node.marks);
  }

  const parsedTask = stripTaskMarker(firstChild);
  if (!parsedTask) {
    return node.type.create(node.attrs, normalizedChildren, node.marks);
  }

  const nextChildren = [parsedTask.paragraph, ...normalizedChildren.slice(1)];
  return node.type.create(
    {
      ...node.attrs,
      task: true,
      checked: parsedTask.checked,
    },
    nextChildren,
    node.marks
  );
}

function normalizeInlineMathNodes(node: ProseMirrorNode): ProseMirrorNode {
  if (node.isText) {
    return node;
  }

  const normalizedChildren: ProseMirrorNode[] = [];
  node.forEach((child) => {
    const normalizedChild = normalizeInlineMathNodes(child);
    if (normalizedChild.isText) {
      normalizedChildren.push(...splitInlineMathTextNode(normalizedChild));
      return;
    }
    normalizedChildren.push(normalizedChild);
  });

  return node.type.create(node.attrs, normalizedChildren, node.marks);
}

function splitInlineMathTextNode(node: ProseMirrorNode): ProseMirrorNode[] {
  const text = node.text ?? "";
  if (!text.includes("$")) {
    return [node];
  }

  const segments: ProseMirrorNode[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const start = findInlineMathDelimiter(text, cursor);
    if (start === -1) {
      segments.push(schema.text(text.slice(cursor), node.marks));
      break;
    }

    if (start > cursor) {
      segments.push(schema.text(text.slice(cursor, start), node.marks));
    }

    const end = findInlineMathDelimiter(text, start + 1);
    if (end === -1) {
      segments.push(schema.text(text.slice(start), node.marks));
      break;
    }

    const content = text.slice(start + 1, end);
    if (!content.trim()) {
      segments.push(schema.text(text.slice(start, end + 1), node.marks));
      cursor = end + 1;
      continue;
    }

    segments.push(schema.nodes.math_inline.create(null, schema.text(content)));
    cursor = end + 1;
  }

  return segments.filter((segment) => !segment.isText || (segment.text?.length ?? 0) > 0);
}

function findInlineMathDelimiter(text: string, from: number): number {
  for (let index = from; index < text.length; index += 1) {
    if (text[index] === "$" && text[index - 1] !== "\\") {
      return index;
    }
  }

  return -1;
}

function stripTaskMarker(paragraph: ProseMirrorNode): { checked: boolean; paragraph: ProseMirrorNode } | null {
  const firstChild = paragraph.firstChild;
  if (!firstChild?.isText) {
    return null;
  }

  const match = firstChild.text?.match(/^\[( |x|X)\]\s+/);
  if (!match) {
    return null;
  }

  const nextText = firstChild.text?.slice(match[0].length) ?? "";
  const nextChildren: ProseMirrorNode[] = [];

  if (nextText.length > 0) {
    nextChildren.push(schema.text(nextText, firstChild.marks));
  }
  for (let index = 1; index < paragraph.childCount; index += 1) {
    nextChildren.push(paragraph.child(index));
  }

  return {
    checked: match[1].toLowerCase() === "x",
    paragraph: paragraph.copy(Fragment.fromArray(nextChildren)),
  };
}
