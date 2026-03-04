import { Fragment, Mark, Node as ProseMirrorNode } from "prosemirror-model";
import { schema } from "./schema";
import {
  bridgeMarkdownExtensionBlockNode,
  bridgeMarkdownExtensionInlineNode,
  defaultMarkdownExtensionRegistry,
  type MarkdownExtensionMdastNode,
  type MarkdownExtensionRegistry,
} from "./markdown-extensions";
import { createMarkdownDiagnostic, type MarkdownDiagnostic } from "./markdown-syntax";

type MdastNode = MarkdownExtensionMdastNode & {
  children?: readonly MdastNode[];
  value?: string;
  depth?: number;
  ordered?: boolean;
  start?: number | null;
  checked?: boolean | null;
  lang?: string | null;
  url?: string;
  title?: string | null;
  alt?: string | null;
  identifier?: string;
  label?: string | null;
};

type DefinitionMap = Map<string, MdastNode>;

export interface MarkdownBridgeResult {
  diagnostics: MarkdownDiagnostic[];
  document: ProseMirrorNode | null;
}

export function bridgeGfmToProseMirror(
  root: unknown,
  extensionRegistry: MarkdownExtensionRegistry = defaultMarkdownExtensionRegistry
): MarkdownBridgeResult {
  if (!isMdastNode(root) || root.type !== "root") {
    return {
      diagnostics: [
        createMarkdownDiagnostic("gfm", "invalid-root", "syntax-tree", "The GFM parser did not return an mdast root.", "error"),
      ],
      document: null,
    };
  }

  const diagnostics: MarkdownDiagnostic[] = [];
  const definitions = collectDefinitions(root);
  const blockNodes: ProseMirrorNode[] = [];

  for (const child of root.children ?? []) {
    if (child.type === "definition") {
      continue;
    }
    const bridged = bridgeBlockNode(child, diagnostics, definitions, extensionRegistry);
    if (bridged) {
      blockNodes.push(bridged);
    }
  }

  if (diagnostics.length > 0) {
    return { diagnostics, document: null };
  }

  const content =
    blockNodes.length > 0
      ? Fragment.fromArray(blockNodes)
      : Fragment.from(schema.node("paragraph"));

  return {
    diagnostics,
    document: schema.node("doc", null, content),
  };
}

function collectDefinitions(root: MdastNode): DefinitionMap {
  const definitions: DefinitionMap = new Map();

  for (const child of root.children ?? []) {
    if (child.type !== "definition" || typeof child.identifier !== "string") {
      continue;
    }
    definitions.set(normalizeIdentifier(child.identifier), child);
  }

  return definitions;
}

function bridgeBlockNode(
  node: MdastNode,
  diagnostics: MarkdownDiagnostic[],
  definitions: DefinitionMap,
  extensionRegistry: MarkdownExtensionRegistry
): ProseMirrorNode | null {
  const extensionNode = bridgeMarkdownExtensionBlockNode(extensionRegistry, node);
  if (extensionNode !== undefined) {
    if (extensionNode.diagnostics) {
      diagnostics.push(...extensionNode.diagnostics);
    }
    return extensionNode.node;
  }

  switch (node.type) {
    case "paragraph":
      return schema.node(
        "paragraph",
        null,
        bridgeInlineContent(node.children ?? [], diagnostics, definitions, extensionRegistry)
      );
    case "heading":
      return schema.node(
        "heading",
        { level: clampHeadingLevel(node.depth) },
        bridgeInlineContent(node.children ?? [], diagnostics, definitions, extensionRegistry)
      );
    case "blockquote": {
      const content = (node.children ?? [])
        .map((child) => bridgeBlockNode(child, diagnostics, definitions, extensionRegistry))
        .filter((child): child is ProseMirrorNode => child !== null);
      return schema.node("blockquote", null, content);
    }
    case "code":
      return schema.node("code_block", { language: node.lang ?? null }, node.value ? schema.text(node.value) : undefined);
    case "list": {
      const items = (node.children ?? [])
        .map((child) => bridgeBlockNode(child, diagnostics, definitions, extensionRegistry))
        .filter((child): child is ProseMirrorNode => child !== null);
      if (items.length === 0) {
        return null;
      }
      if (node.ordered) {
        return schema.node("ordered_list", { order: node.start ?? 1 }, items);
      }
      return schema.node("bullet_list", null, items);
    }
    case "listItem": {
      const childBlocks = (node.children ?? [])
        .map((child) => bridgeBlockNode(child, diagnostics, definitions, extensionRegistry))
        .filter((child): child is ProseMirrorNode => child !== null);
      const firstChild = childBlocks[0];
      const content =
        firstChild?.type.name === "paragraph"
          ? childBlocks
          : [schema.node("paragraph"), ...childBlocks];
      return schema.node(
        "list_item",
        {
          task: typeof node.checked === "boolean",
          checked: node.checked === true,
        },
        content
      );
    }
    case "thematicBreak":
      return schema.node("horizontal_rule");
    case "table":
      return bridgeTableNode(node, diagnostics, definitions, extensionRegistry);
    case "footnoteDefinition":
      return bridgeFootnoteDefinition(node, diagnostics, definitions, extensionRegistry);
    case "html":
      diagnostics.push(
        createMarkdownDiagnostic(
          "gfm",
          "unsupported-html",
          "html",
          "Raw HTML is outside the current markdown bridge surface."
        )
      );
      return null;
    default:
      diagnostics.push(
        createMarkdownDiagnostic(
          "gfm",
          `unsupported-${node.type}`,
          node.type,
          `The GFM bridge does not yet support mdast node type "${node.type}".`
        )
      );
      return null;
  }
}

function bridgeInlineContent(
  children: readonly MdastNode[],
  diagnostics: MarkdownDiagnostic[],
  definitions: DefinitionMap,
  extensionRegistry: MarkdownExtensionRegistry,
  marks: readonly Mark[] = []
): ProseMirrorNode[] {
  const content: ProseMirrorNode[] = [];

  for (const child of children) {
    content.push(...bridgeInlineNode(child, diagnostics, definitions, extensionRegistry, marks));
  }

  return content;
}

function bridgeInlineNode(
  node: MdastNode,
  diagnostics: MarkdownDiagnostic[],
  definitions: DefinitionMap,
  extensionRegistry: MarkdownExtensionRegistry,
  marks: readonly Mark[]
): ProseMirrorNode[] {
  const extensionNodes = bridgeMarkdownExtensionInlineNode(extensionRegistry, node, marks);
  if (extensionNodes !== undefined) {
    if (extensionNodes.diagnostics) {
      diagnostics.push(...extensionNodes.diagnostics);
    }
    return [...extensionNodes.nodes];
  }

  switch (node.type) {
    case "text":
      return node.value ? [schema.text(node.value, marks)] : [];
    case "strong":
      return bridgeInlineContent(node.children ?? [], diagnostics, definitions, extensionRegistry, [
        ...marks,
        schema.mark("strong"),
      ]);
    case "emphasis":
      return bridgeInlineContent(node.children ?? [], diagnostics, definitions, extensionRegistry, [
        ...marks,
        schema.mark("em"),
      ]);
    case "delete":
      return bridgeInlineContent(node.children ?? [], diagnostics, definitions, extensionRegistry, [
        ...marks,
        schema.mark("strike"),
      ]);
    case "inlineCode":
      return node.value ? [schema.text(node.value, [...marks, schema.mark("code")])] : [];
    case "break":
      return [schema.node("hard_break", null, undefined, marks)];
    case "image":
      if (!node.url) {
        return [];
      }
      return [
        schema.node(
          "image",
          {
            src: node.url,
            alt: node.alt ?? null,
            title: node.title ?? null,
          },
          undefined,
          marks
        ),
      ];
    case "link":
      if (!node.url) {
        return bridgeInlineContent(node.children ?? [], diagnostics, definitions, extensionRegistry, marks);
      }
      return bridgeInlineContent(node.children ?? [], diagnostics, definitions, extensionRegistry, [
        ...marks,
        schema.mark("link", {
          href: node.url,
          title: node.title ?? null,
          refId: null,
        }),
      ]);
    case "linkReference": {
      const identifier = typeof node.identifier === "string" ? normalizeIdentifier(node.identifier) : "";
      const definition = definitions.get(identifier);
      if (!definition?.url) {
        diagnostics.push(
          createMarkdownDiagnostic(
            "gfm",
            "missing-reference-definition",
            "reference-link",
            `Reference link "${node.identifier ?? ""}" could not be resolved from the parsed definitions.`
          )
        );
        return bridgeInlineContent(node.children ?? [], diagnostics, definitions, extensionRegistry, marks);
      }
      return bridgeInlineContent(node.children ?? [], diagnostics, definitions, extensionRegistry, [
        ...marks,
        schema.mark("link", {
          href: definition.url,
          title: definition.title ?? null,
          refId: null,
        }),
      ]);
    }
    case "footnoteReference":
      if (!node.identifier) {
        return [];
      }
      return [
        schema.node("footnote_reference", {
          id: node.identifier,
          label: node.label ?? node.identifier,
        }),
      ];
    default:
      diagnostics.push(
        createMarkdownDiagnostic(
          "gfm",
          `unsupported-inline-${node.type}`,
          node.type,
          `The GFM bridge does not yet support inline mdast node type "${node.type}".`
        )
      );
      return [];
  }
}

function isMdastNode(value: unknown): value is MdastNode {
  return typeof value === "object" && value !== null && "type" in value;
}

function clampHeadingLevel(depth: number | undefined): number {
  if (!depth || Number.isNaN(depth)) {
    return 1;
  }
  return Math.max(1, Math.min(6, depth));
}

function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

function bridgeTableNode(
  node: MdastNode,
  diagnostics: MarkdownDiagnostic[],
  definitions: DefinitionMap,
  extensionRegistry: MarkdownExtensionRegistry
): ProseMirrorNode | null {
  const rows = (node.children ?? [])
    .map((child, index) => bridgeTableRow(child, index === 0, diagnostics, definitions, extensionRegistry))
    .filter((child): child is ProseMirrorNode => child !== null);

  if (rows.length === 0) {
    return null;
  }

  return schema.node("table", null, rows);
}

function bridgeTableRow(
  node: MdastNode,
  isHeaderRow: boolean,
  diagnostics: MarkdownDiagnostic[],
  definitions: DefinitionMap,
  extensionRegistry: MarkdownExtensionRegistry
): ProseMirrorNode | null {
  if (node.type !== "tableRow") {
    diagnostics.push(
      createMarkdownDiagnostic(
        "gfm",
        `unsupported-table-child-${node.type}`,
        node.type,
        `Table nodes must contain table rows, but encountered "${node.type}".`
      )
    );
    return null;
  }

  const cells = (node.children ?? [])
    .map((child) => bridgeTableCell(child, isHeaderRow, diagnostics, definitions, extensionRegistry))
    .filter((child): child is ProseMirrorNode => child !== null);

  if (cells.length === 0) {
    return null;
  }

  return schema.node("table_row", null, cells);
}

function bridgeTableCell(
  node: MdastNode,
  isHeaderRow: boolean,
  diagnostics: MarkdownDiagnostic[],
  definitions: DefinitionMap,
  extensionRegistry: MarkdownExtensionRegistry
): ProseMirrorNode | null {
  if (node.type !== "tableCell") {
    diagnostics.push(
      createMarkdownDiagnostic(
        "gfm",
        `unsupported-table-cell-${node.type}`,
        node.type,
        `Table rows must contain table cells, but encountered "${node.type}".`
      )
    );
    return null;
  }

  const paragraph = schema.node(
    "paragraph",
    null,
    bridgeInlineContent(node.children ?? [], diagnostics, definitions, extensionRegistry)
  );
  const cellType = isHeaderRow ? "table_header" : "table_cell";

  return schema.node(cellType, null, [paragraph]);
}

function bridgeFootnoteDefinition(
  node: MdastNode,
  diagnostics: MarkdownDiagnostic[],
  definitions: DefinitionMap,
  extensionRegistry: MarkdownExtensionRegistry
): ProseMirrorNode | null {
  if (!node.identifier) {
    return null;
  }

  const blocks = (node.children ?? [])
    .map((child) => bridgeBlockNode(child, diagnostics, definitions, extensionRegistry))
    .filter((child): child is ProseMirrorNode => child !== null);

  return schema.node(
    "footnote_definition",
    {
      id: node.identifier,
      label: node.label ?? node.identifier,
    },
    blocks.length > 0 ? blocks : [schema.node("paragraph")]
  );
}
