import type { Mark, Node as ProseMirrorNode } from "prosemirror-model";
import {
  defaultMarkdownExtensionRegistry,
  type MarkdownExtensionMdastNode,
  type MarkdownExtensionRegistry,
} from "./markdown-extensions";
import { serializeGfmMarkdownSyntaxTree } from "./markdown-gfm";
import type { MarkdownReferenceState } from "./markdown-syntax";

type MdastNode = MarkdownExtensionMdastNode;

export function serializeProseMirrorDocumentToGfm(
  doc: ProseMirrorNode,
  extensionRegistry: MarkdownExtensionRegistry = defaultMarkdownExtensionRegistry
): string {
  const tree = serializeProseMirrorDocumentToGfmSyntaxTree(doc, extensionRegistry);
  return serializeGfmMarkdownSyntaxTree(tree, extensionRegistry);
}

export function serializeProseMirrorDocumentToGfmSyntaxTree(
  doc: ProseMirrorNode,
  extensionRegistry: MarkdownExtensionRegistry = defaultMarkdownExtensionRegistry
): MdastNode {
  const content = serializeBlockChildren(doc, extensionRegistry);
  const referenceNodes = serializeReferenceDefinitions(doc);
  return {
    type: "root",
    children: [...content, ...referenceNodes],
  };
}

function serializeBlockChildren(
  parent: ProseMirrorNode,
  extensionRegistry: MarkdownExtensionRegistry
): MdastNode[] {
  const children: MdastNode[] = [];
  parent.forEach((child) => {
    children.push(serializeBlockNode(child, extensionRegistry));
  });
  return children;
}

function serializeBlockNode(
  node: ProseMirrorNode,
  extensionRegistry: MarkdownExtensionRegistry
): MdastNode {
  switch (node.type.name) {
    case "paragraph":
      return {
        type: "paragraph",
        children: serializeInlineChildren(node),
      };
    case "heading":
      return {
        type: "heading",
        depth: Number(node.attrs.level) || 1,
        children: serializeInlineChildren(node),
      };
    case "blockquote":
      return {
        type: "blockquote",
        children: serializeBlockChildren(node, extensionRegistry),
      };
    case "code_block":
      return {
        type: "code",
        lang: typeof node.attrs.language === "string" ? node.attrs.language : null,
        value: node.textContent,
      };
    case "bullet_list":
      return {
        type: "list",
        ordered: false,
        spread: false,
        children: serializeListItems(node, extensionRegistry),
      };
    case "ordered_list":
      return {
        type: "list",
        ordered: true,
        start: Number(node.attrs.order) || 1,
        spread: false,
        children: serializeListItems(node, extensionRegistry),
      };
    case "list_item":
      return {
        type: "listItem",
        checked: node.attrs.task === true ? node.attrs.checked === true : null,
        spread: false,
        children: serializeBlockChildren(node, extensionRegistry),
      };
    case "horizontal_rule":
      return { type: "thematicBreak" };
    case "math_display":
      return {
        type: "math",
        value: node.textContent,
      };
    case "table":
      return {
        type: "table",
        align: serializeTableAlignment(node),
        children: serializeTableRows(node),
      };
    case "footnote_definition":
      return {
        type: "footnoteDefinition",
        identifier: String(node.attrs.id),
        label: node.attrs.label ? String(node.attrs.label) : String(node.attrs.id),
        children: serializeBlockChildren(node, extensionRegistry),
      };
    default:
      return {
        type: "paragraph",
        children: [{ type: "text", value: node.textContent }],
      };
  }
}

function serializeListItems(
  node: ProseMirrorNode,
  extensionRegistry: MarkdownExtensionRegistry
): MdastNode[] {
  const items: MdastNode[] = [];
  node.forEach((child) => {
    items.push(serializeBlockNode(child, extensionRegistry));
  });
  return items;
}

function serializeTableAlignment(node: ProseMirrorNode): Array<null> {
  const firstRow = node.firstChild;
  const width = firstRow?.childCount ?? 0;
  return Array.from({ length: width }, () => null);
}

function serializeTableRows(node: ProseMirrorNode): MdastNode[] {
  const rows: MdastNode[] = [];
  node.forEach((row) => {
    rows.push({
      type: "tableRow",
      children: serializeTableCells(row),
    });
  });
  return rows;
}

function serializeTableCells(row: ProseMirrorNode): MdastNode[] {
  const cells: MdastNode[] = [];
  row.forEach((cell) => {
    cells.push({
      type: "tableCell",
      children: serializeTableCellChildren(cell),
    });
  });
  return cells;
}

function serializeTableCellChildren(cell: ProseMirrorNode): MdastNode[] {
  const inlineNodes: MdastNode[] = [];
  cell.forEach((child) => {
    if (child.type.name === "paragraph") {
      inlineNodes.push(...serializeInlineChildren(child));
      return;
    }
    // TRACE: DESIGN-gfm-markdown-platform-024 FR-18
    throw new Error(
      `GFM table cells support paragraph content only; received "${child.type.name}".`
    );
  });
  return inlineNodes.length > 0 ? inlineNodes : [{ type: "text", value: "" }];
}

function serializeInlineChildren(parent: ProseMirrorNode): MdastNode[] {
  const children: MdastNode[] = [];
  parent.forEach((child) => {
    children.push(...serializeInlineNode(child));
  });
  return children;
}

function serializeInlineNode(
  node: ProseMirrorNode
): MdastNode[] {
  switch (node.type.name) {
    case "text":
      return serializeTextNode(node);
    case "hard_break":
      return [{ type: "break" }];
    case "image":
      return [
        {
          type: "image",
          url: String(node.attrs.src),
          alt: node.attrs.alt ? String(node.attrs.alt) : null,
          title: node.attrs.title ? String(node.attrs.title) : null,
        },
      ];
    case "footnote_reference":
      return [
        {
          type: "footnoteReference",
          identifier: String(node.attrs.id),
          label: node.attrs.label ? String(node.attrs.label) : String(node.attrs.id),
        },
      ];
    case "math_inline":
      return [
        {
          type: "inlineMath",
          value: node.textContent,
        },
      ];
    default:
      return [{ type: "text", value: node.textContent }];
  }
}

function serializeTextNode(
  node: ProseMirrorNode
): MdastNode[] {
  const text = node.text ?? "";
  const wikilinkMark = node.marks.find((mark) => mark.type.name === "wikilink");
  if (wikilinkMark) {
    return [
      {
        type: wikilinkMark.attrs.embed === true ? "wikilinkEmbed" : "wikilink",
        target: String(wikilinkMark.attrs.target),
        label: text,
        explicitLabel: text !== String(wikilinkMark.attrs.target),
      },
    ];
  }

  return [applyMarksToTextNode({ type: "text", value: text }, node.marks)];
}

function applyMarksToTextNode(baseNode: MdastNode, marks: readonly Mark[]): MdastNode {
  let currentNode = baseNode;

  for (const mark of marks) {
    switch (mark.type.name) {
      case "strong":
        currentNode = { type: "strong", children: [currentNode] };
        break;
      case "em":
        currentNode = { type: "emphasis", children: [currentNode] };
        break;
      case "strike":
        currentNode = { type: "delete", children: [currentNode] };
        break;
      case "code":
        currentNode = { type: "inlineCode", value: baseNode.value ?? "" };
        break;
      case "link":
        currentNode = {
          type: "link",
          url: String(mark.attrs.href),
          title: mark.attrs.title ? String(mark.attrs.title) : null,
          children: [currentNode],
        };
        break;
      default:
        break;
    }
  }

  return currentNode;
}

function serializeReferenceDefinitions(doc: ProseMirrorNode): MdastNode[] {
  const attrs = doc.attrs as Partial<MarkdownReferenceState>;
  const definitions = attrs.referenceDefinitions ?? {};
  const order = attrs.referenceOrder ?? Object.values(definitions).map((definition) => definition.id);
  const seen = new Set<string>();
  const nodes: MdastNode[] = [];

  for (const id of order) {
    const key = id.trim().toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const definition = definitions[key];
    if (!definition) {
      continue;
    }

    nodes.push({
      type: "definition",
      identifier: definition.id,
      label: definition.id,
      url: definition.href,
      title: definition.title,
    });
  }

  return nodes;
}
