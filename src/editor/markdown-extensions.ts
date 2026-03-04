import { type Mark, type Node as ProseMirrorNode } from "prosemirror-model";
import type { Processor } from "unified";
import { createMarkdownDiagnostic, type MarkdownDiagnostic } from "./markdown-syntax";
import { schema } from "./schema";

export type MarkdownExtensionClassification = "native_gfm" | "knot_extension" | "future_extension";
export type MarkdownExtensionBackendSupport = "frontend_only" | "backend_optional" | "backend_required";
export type MarkdownExtensionFamilyKey = string;
export type MarkdownExtensionVariantKey = string;

export interface MarkdownExtensionPresentation {
  readonly edit: readonly string[];
  readonly view: readonly string[];
}

export interface MarkdownExtensionSerializer {
  readonly proseMirrorNodeTypes?: readonly string[];
  readonly proseMirrorMarkTypes?: readonly string[];
  readonly serializeProseMirrorNode?: (node: ProseMirrorNode) => string | undefined;
  readonly serializeProseMirrorMark?: (mark: Mark, text: string) => string | undefined;
}

export interface MarkdownExtensionVariant {
  readonly key: MarkdownExtensionVariantKey;
  readonly syntaxForm: string;
  readonly parseRule: string;
  readonly serializeRule: string;
  readonly serializer?: MarkdownExtensionSerializer;
  readonly schemaRepresentation: readonly string[];
  readonly presentation: MarkdownExtensionPresentation;
  readonly backendSupport: MarkdownExtensionBackendSupport;
}

export interface MarkdownExtensionMdastNode {
  readonly type: string;
  readonly children?: readonly MarkdownExtensionMdastNode[];
  readonly value?: string;
  readonly target?: string;
  readonly embed?: boolean;
  readonly label?: string | null;
  readonly explicitLabel?: boolean;
  readonly [key: string]: unknown;
}

export interface MarkdownExtensionInlineBridgeResult {
  readonly diagnostics?: readonly MarkdownDiagnostic[];
  readonly nodes: readonly ProseMirrorNode[];
}

export interface MarkdownExtensionBlockBridgeResult {
  readonly diagnostics?: readonly MarkdownDiagnostic[];
  readonly node: ProseMirrorNode | null;
}

export interface MarkdownExtensionGfmHooks {
  readonly mdastNodeTypes: readonly string[];
  readonly configureProcessor?: (
    processor: Processor<any, any, any, any, any>
  ) => Processor<any, any, any, any, any>;
  readonly transformSyntaxTree?: (tree: MarkdownExtensionMdastNode) => MarkdownExtensionMdastNode;
  readonly serializeSyntaxTree?: (tree: MarkdownExtensionMdastNode) => MarkdownExtensionMdastNode;
  readonly bridgeBlock?: (node: MarkdownExtensionMdastNode) => MarkdownExtensionBlockBridgeResult | undefined;
  readonly bridgeInline?: (
    node: MarkdownExtensionMdastNode,
    marks: readonly Mark[]
  ) => MarkdownExtensionInlineBridgeResult | undefined;
}

export interface MarkdownExtensionFamily {
  readonly key: MarkdownExtensionFamilyKey;
  readonly classification: MarkdownExtensionClassification;
  readonly variants: readonly MarkdownExtensionVariant[];
  readonly gfm?: MarkdownExtensionGfmHooks;
}

export interface MarkdownExtensionRegistry {
  readonly families: readonly MarkdownExtensionFamily[];
  readonly byKey: ReadonlyMap<MarkdownExtensionFamilyKey, MarkdownExtensionFamily>;
}

const SERIALIZED_EXTENSION_PLACEHOLDER_PATTERN = /KNOTX([0-9a-f]{4})/g;
const ESCAPED_EXTENSION_LITERAL_PLACEHOLDER_PATTERN = /KNOTL((?:[0-9a-f]{4})+)/g;

export function createMarkdownExtensionRegistry(
  families: readonly MarkdownExtensionFamily[]
): MarkdownExtensionRegistry {
  return {
    families: [...families],
    byKey: new Map(families.map((family) => [family.key, family])),
  };
}

export function getMarkdownExtensionFamily(
  registry: MarkdownExtensionRegistry,
  key: MarkdownExtensionFamilyKey
): MarkdownExtensionFamily | undefined {
  return registry.byKey.get(key);
}

export function configureMarkdownExtensionProcessor(
  processor: Processor<any, any, any, any, any>,
  registry: MarkdownExtensionRegistry
): Processor<any, any, any, any, any> {
  let configured = processor;
  for (const family of registry.families) {
    if (family.gfm?.configureProcessor) {
      configured = family.gfm.configureProcessor(configured);
    }
  }
  return configured;
}

export function transformMarkdownExtensionSyntaxTree<T extends MarkdownExtensionMdastNode>(
  tree: T,
  registry: MarkdownExtensionRegistry
): T {
  let transformed: MarkdownExtensionMdastNode = tree;
  for (const family of registry.families) {
    if (family.gfm?.transformSyntaxTree) {
      transformed = family.gfm.transformSyntaxTree(transformed);
    }
  }
  return transformed as T;
}

export function serializeMarkdownExtensionSyntaxTree<T extends MarkdownExtensionMdastNode>(
  tree: T,
  registry: MarkdownExtensionRegistry
): T {
  let transformed: MarkdownExtensionMdastNode = tree;
  for (const family of registry.families) {
    if (family.gfm?.serializeSyntaxTree) {
      transformed = family.gfm.serializeSyntaxTree(transformed);
    }
  }
  return transformed as T;
}

export function restoreSerializedMarkdownExtensionSyntax(markdown: string): string {
  return markdown.replace(SERIALIZED_EXTENSION_PLACEHOLDER_PATTERN, (_match, hex: string) =>
    String.fromCodePoint(Number.parseInt(hex, 16))
  );
}

export function escapeSerializedMarkdownExtensionSyntax(markdown: string): string {
  return escapeLiteralWikilinkSyntax(markdown);
}

export function protectEscapedMarkdownExtensionSyntax(markdown: string): string {
  return markdown.replace(/!?(?:\\\[){2}[^\]\n]+(?:\|[^\]\n]+)?(?:\\\]){2}/g, (match) =>
    encodeMarkdownExtensionLiteralPlaceholder(match)
  );
}

export function restoreProtectedMarkdownExtensionSyntax(markdown: string): string {
  return markdown.replace(ESCAPED_EXTENSION_LITERAL_PLACEHOLDER_PATTERN, (_match, encoded: string) =>
    decodePlaceholderSequence(encoded)
  );
}

export function bridgeMarkdownExtensionBlockNode(
  registry: MarkdownExtensionRegistry,
  node: MarkdownExtensionMdastNode
): MarkdownExtensionBlockBridgeResult | undefined {
  for (const family of registry.families) {
    if (!family.gfm?.mdastNodeTypes.includes(node.type)) {
      continue;
    }
    const bridged = family.gfm.bridgeBlock?.(node);
    if (bridged !== undefined) {
      return bridged;
    }
  }
  return undefined;
}

export function bridgeMarkdownExtensionInlineNode(
  registry: MarkdownExtensionRegistry,
  node: MarkdownExtensionMdastNode,
  marks: readonly Mark[]
): MarkdownExtensionInlineBridgeResult | undefined {
  for (const family of registry.families) {
    if (!family.gfm?.mdastNodeTypes.includes(node.type)) {
      continue;
    }
    const bridged = family.gfm.bridgeInline?.(node, marks);
    if (bridged !== undefined) {
      return bridged;
    }
  }
  return undefined;
}

export function serializeMarkdownExtensionProseMirrorNode(
  registry: MarkdownExtensionRegistry,
  node: ProseMirrorNode
): string | undefined {
  for (const family of registry.families) {
    for (const variant of family.variants) {
      if (!variant.serializer?.proseMirrorNodeTypes?.includes(node.type.name)) {
        continue;
      }
      const serialized = variant.serializer.serializeProseMirrorNode?.(node);
      if (serialized !== undefined) {
        return serialized;
      }
    }
  }
  return undefined;
}

export function serializeMarkdownExtensionProseMirrorMark(
  registry: MarkdownExtensionRegistry,
  mark: Mark,
  text: string
): string | undefined {
  for (const family of registry.families) {
    for (const variant of family.variants) {
      if (!variant.serializer?.proseMirrorMarkTypes?.includes(mark.type.name)) {
        continue;
      }
      const serialized = variant.serializer.serializeProseMirrorMark?.(mark, text);
      if (serialized !== undefined) {
        return serialized;
      }
    }
  }
  return undefined;
}

function createMathExtensionFamily(): MarkdownExtensionFamily {
  return {
    key: "math",
    classification: "knot_extension",
    variants: [
      {
        key: "inline_math",
        syntaxForm: "$...$",
        parseRule: "registry inline math syntax transform",
        serializeRule: "registry inline math serializer",
        serializer: {
          proseMirrorNodeTypes: ["math_inline"],
          serializeProseMirrorNode: (node) => `$${node.textContent}$`,
        },
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
        serializer: {
          proseMirrorNodeTypes: ["math_display"],
          serializeProseMirrorNode: (node) => `$$\n${node.textContent}\n$$`,
        },
        schemaRepresentation: ["math_display"],
        presentation: {
          edit: ["display math node"],
          view: ["KaTeX display render"],
        },
        backendSupport: "backend_optional",
      },
    ],
    gfm: {
      mdastNodeTypes: ["inlineMath", "math"],
      transformSyntaxTree: (tree) => transformMathSyntaxTree(tree),
      serializeSyntaxTree: (tree) => serializeMathSyntaxTree(tree),
      bridgeBlock: (node) => {
        if (node.type !== "math") {
          return undefined;
        }
        return {
          node: schema.node("math_display", null, node.value ? schema.text(node.value) : undefined),
        };
      },
      bridgeInline: (node, marks) => {
        if (node.type !== "inlineMath") {
          return undefined;
        }

        const value = node.value ?? "";
        if (marks.length > 0) {
          return {
            diagnostics: [
              createMarkdownDiagnostic(
                "gfm",
                "unsupported-marked-inline-math",
                "math",
                "Inline math inside marked content is not supported by the GFM bridge yet."
              ),
            ],
            nodes: [schema.text(`$${value}$`, marks)],
          };
        }

        return {
          nodes: [schema.node("math_inline", null, value ? schema.text(value) : undefined)],
        };
      },
    },
  };
}

function createWikilinkExtensionFamily(): MarkdownExtensionFamily {
  return {
    key: "wikilink",
    classification: "knot_extension",
    variants: [
      {
        key: "wikilink",
        syntaxForm: "[[target|label]]",
        parseRule: "registry wikilink syntax transform",
        serializeRule: "registry wikilink serializer",
        serializer: {
          proseMirrorMarkTypes: ["wikilink"],
          serializeProseMirrorMark: (mark, text) => {
            if (mark.attrs.embed) {
              return undefined;
            }
            return `[[${String(mark.attrs.target)}|${text}]]`;
          },
        },
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
        serializer: {
          proseMirrorMarkTypes: ["wikilink"],
          serializeProseMirrorMark: (mark, text) => {
            if (mark.attrs.embed !== true) {
              return undefined;
            }
            return `![[${String(mark.attrs.target)}|${text}]]`;
          },
        },
        schemaRepresentation: ["wikilink"],
        presentation: {
          edit: ["wikilink mark"],
          view: ["embedded note render"],
        },
        backendSupport: "backend_optional",
      },
    ],
    gfm: {
      mdastNodeTypes: ["wikilink", "wikilinkEmbed"],
      transformSyntaxTree: (tree) => transformWikilinkSyntaxTree(tree),
      serializeSyntaxTree: (tree) => serializeWikilinkSyntaxTree(tree),
      bridgeInline: (node, marks) => {
        if (node.type !== "wikilink" && node.type !== "wikilinkEmbed") {
          return undefined;
        }

        const target = typeof node.target === "string" ? node.target : "";
        const label = typeof node.label === "string" && node.label.length > 0 ? node.label : target;
        return {
          nodes: [
            schema.text(label, [
              ...marks,
              schema.mark("wikilink", {
                target,
                embed: node.type === "wikilinkEmbed",
              }),
            ]),
          ],
        };
      },
    },
  };
}

// SPEC-PENDING: COMP-MARKDOWN-PLATFORM-024 FR-9/FR-10 extension registration seam.
export const defaultMarkdownExtensionRegistry = createMarkdownExtensionRegistry([
  createWikilinkExtensionFamily(),
  createMathExtensionFamily(),
]);

function transformMathSyntaxTree(node: MarkdownExtensionMdastNode): MarkdownExtensionMdastNode {
  const transformedChildren = node.children?.map((child) => transformMathSyntaxTree(child));

  if (node.type === "paragraph") {
    const blockMath = toBlockMathNode(node, transformedChildren);
    if (blockMath) {
      return blockMath;
    }
  }

  if (transformedChildren === undefined) {
    return node;
  }

  return {
    ...node,
    children: transformedChildren.flatMap((child) => expandInlineMathNode(child)),
  };
}

function serializeMathSyntaxTree(node: MarkdownExtensionMdastNode): MarkdownExtensionMdastNode {
  const transformedChildren = node.children?.map((child) => serializeMathSyntaxTree(child));

  if (node.type === "inlineMath") {
    return { type: "text", value: `$${node.value ?? ""}$` };
  }

  if (node.type === "math") {
    return { type: "html", value: `$$\n${node.value ?? ""}\n$$` };
  }

  if (transformedChildren === undefined) {
    return node;
  }

  return { ...node, children: transformedChildren };
}

function transformWikilinkSyntaxTree(node: MarkdownExtensionMdastNode): MarkdownExtensionMdastNode {
  const transformedChildren = node.children?.map((child) => transformWikilinkSyntaxTree(child));

  if (node.type === "text" && typeof node.value === "string") {
    const protectedLiteralParts = expandProtectedWikilinkLiteralText(node.value);
    if (protectedLiteralParts !== null) {
      return {
        type: "fragment",
        children: protectedLiteralParts,
      };
    }

    const parts = expandWikilinkNode(node.value);
    if (parts.length === 1 && parts[0]?.type === "text") {
      return { ...node, value: parts[0].value };
    }

    return {
      type: "fragment",
      children: parts,
    };
  }

  if (transformedChildren === undefined) {
    return node;
  }

  return {
    ...node,
    children: transformedChildren.flatMap((child) =>
      child.type === "fragment" ? (child.children ?? []) : [child]
    ),
  };
}

function serializeWikilinkSyntaxTree(node: MarkdownExtensionMdastNode): MarkdownExtensionMdastNode {
  const transformedChildren = node.children?.map((child) => serializeWikilinkSyntaxTree(child));

  if (node.type === "text" && typeof node.value === "string") {
    if (node.escapedWikilinkSyntax === true) {
      return { ...node, value: encodeMarkdownExtensionLiteralPlaceholder(escapeLiteralWikilinkSyntax(node.value)) };
    }
    return { ...node, value: escapeLiteralWikilinkSyntax(node.value) };
  }

  if (node.type === "wikilink" || node.type === "wikilinkEmbed") {
    const target = typeof node.target === "string" ? node.target : "";
    const label = typeof node.label === "string" && node.label.length > 0 ? node.label : target;
    const prefix = node.type === "wikilinkEmbed" ? "!" : "";
    const hasExplicitLabel = node.explicitLabel === true && label !== target;
    return {
      type: "text",
      value: encodeSerializedMarkdownExtensionSyntax(
        hasExplicitLabel ? `${prefix}[[${target}|${label}]]` : `${prefix}[[${target}]]`
      ),
    };
  }

  if (transformedChildren === undefined) {
    return node;
  }

  return { ...node, children: transformedChildren };
}

function encodeSerializedMarkdownExtensionSyntax(value: string): string {
  return Array.from(value, (character) => `KNOTX${character.codePointAt(0)!.toString(16).padStart(4, "0")}`).join("");
}

function encodeMarkdownExtensionLiteralPlaceholder(value: string): string {
  return `KNOTL${Array.from(value, (character) => character.codePointAt(0)!.toString(16).padStart(4, "0")).join("")}`;
}

function decodeMarkdownExtensionLiteralPlaceholder(value: string): string {
  return unescapeProtectedMarkdownExtensionLiteral(restoreProtectedMarkdownExtensionSyntax(value));
}

function escapeLiteralWikilinkSyntax(value: string): string {
  return value.replace(/!?\[\[[^\]\n]+(?:\|[^\]\n]+)?\]\]/g, (match) => match.replace(/\[/g, "\\[").replace(/\]/g, "\\]"));
}

function unescapeProtectedMarkdownExtensionLiteral(value: string): string {
  return value.replace(/\\(?=[\[\]])/g, "");
}

function decodePlaceholderSequence(encoded: string): string {
  let result = "";
  for (let index = 0; index < encoded.length; index += 4) {
    result += String.fromCodePoint(Number.parseInt(encoded.slice(index, index + 4), 16));
  }
  return result;
}

function expandProtectedWikilinkLiteralText(value: string): MarkdownExtensionMdastNode[] | null {
  const matches = Array.from(value.matchAll(ESCAPED_EXTENSION_LITERAL_PLACEHOLDER_PATTERN));
  if (matches.length === 0) {
    return null;
  }

  const parts: MarkdownExtensionMdastNode[] = [];
  let cursor = 0;

  for (const match of matches) {
    const start = match.index ?? 0;
    if (start > cursor) {
      parts.push({ type: "text", value: value.slice(cursor, start) });
    }
    parts.push({
      type: "text",
      value: decodeMarkdownExtensionLiteralPlaceholder(match[0]),
      escapedWikilinkSyntax: true,
    });
    cursor = start + match[0].length;
  }

  if (cursor < value.length) {
    parts.push({ type: "text", value: value.slice(cursor) });
  }

  return parts;
}

function toBlockMathNode(
  node: MarkdownExtensionMdastNode,
  children: readonly MarkdownExtensionMdastNode[] | undefined
): MarkdownExtensionMdastNode | null {
  if ((children ?? []).length !== 1 || children?.[0]?.type !== "text") {
    return null;
  }

  const value = children[0].value ?? "";
  const match = value.match(/^\$\$\n([\s\S]+)\n\$\$$/);
  if (!match) {
    return null;
  }

  return {
    ...node,
    type: "math",
    value: match[1],
    children: undefined,
  };
}

function expandInlineMathNode(node: MarkdownExtensionMdastNode): readonly MarkdownExtensionMdastNode[] {
  if (node.type !== "text" || typeof node.value !== "string" || !node.value.includes("$")) {
    return [node];
  }

  const parts: MarkdownExtensionMdastNode[] = [];
  let cursor = 0;

  while (cursor < node.value.length) {
    const start = findInlineMathStart(node.value, cursor);
    if (start === -1) {
      parts.push({ ...node, value: node.value.slice(cursor) });
      break;
    }

    if (start > cursor) {
      parts.push({ ...node, value: node.value.slice(cursor, start) });
    }

    const end = findInlineMathEnd(node.value, start + 1);
    if (end === -1) {
      parts.push({ ...node, value: node.value.slice(start) });
      break;
    }

    const content = node.value.slice(start + 1, end);
    if (!isInlineMathContent(content)) {
      parts.push({ ...node, value: node.value.slice(start, end + 1) });
      cursor = end + 1;
      continue;
    }

    parts.push({ type: "inlineMath", value: content });
    cursor = end + 1;
  }

  return parts.filter((part) => part.type !== "text" || (part.value?.length ?? 0) > 0);
}

function findInlineMathStart(text: string, from: number): number {
  for (let index = from; index < text.length; index += 1) {
    if (text[index] !== "$" || text[index - 1] === "\\") {
      continue;
    }

    const next = text[index + 1] ?? "";
    if (next.length === 0 || /\s/.test(next) || /\d/.test(next) || next === "$") {
      continue;
    }

    return index;
  }

  return -1;
}

function findInlineMathEnd(text: string, from: number): number {
  for (let index = from; index < text.length; index += 1) {
    if (text[index] !== "$" || text[index - 1] === "\\") {
      continue;
    }

    const previous = text[index - 1] ?? "";
    if (previous.length === 0 || /\s/.test(previous)) {
      continue;
    }

    return index;
  }

  return -1;
}

function isInlineMathContent(content: string): boolean {
  if (!content.trim()) {
    return false;
  }

  if (/^\d+(?:[.,]\d+)?$/.test(content.trim())) {
    return false;
  }

  return true;
}

function expandWikilinkNode(value: string): readonly MarkdownExtensionMdastNode[] {
  if (!value.includes("[[")) {
    return [{ type: "text", value }];
  }

  const parts: MarkdownExtensionMdastNode[] = [];
  let cursor = 0;

  while (cursor < value.length) {
    const next = findWikilinkStart(value, cursor);
    if (next === -1) {
      parts.push({ type: "text", value: value.slice(cursor) });
      break;
    }

    if (next > cursor) {
      parts.push({ type: "text", value: value.slice(cursor, next) });
    }

    const parsed = parseWikilinkAt(value, next);
    if (!parsed) {
      parts.push({ type: "text", value: value.slice(next, next + 2) });
      cursor = next + 2;
      continue;
    }

    parts.push(parsed.node);
    cursor = parsed.nextCursor;
  }

  return parts.filter((part) => part.type !== "text" || (part.value?.length ?? 0) > 0);
}

function findWikilinkStart(value: string, from: number): number {
  for (let index = from; index < value.length - 1; index += 1) {
    if (value[index] !== "[" || value[index + 1] !== "[") {
      continue;
    }
    if (value[index - 1] === "\\") {
      continue;
    }
    return value[index - 1] === "!" ? index - 1 : index;
  }

  return -1;
}

function parseWikilinkAt(
  value: string,
  start: number
): { nextCursor: number; node: MarkdownExtensionMdastNode } | null {
  const embed = value[start] === "!";
  const openIndex = embed ? start + 1 : start;

  if (value.slice(openIndex, openIndex + 2) !== "[[") {
    return null;
  }

  const closeIndex = value.indexOf("]]", openIndex + 2);
  if (closeIndex === -1) {
    return null;
  }

  const raw = value.slice(openIndex + 2, closeIndex).trim();
  if (raw.length === 0) {
    return null;
  }

  const separatorIndex = raw.indexOf("|");
  const target = (separatorIndex === -1 ? raw : raw.slice(0, separatorIndex)).trim();
  const label = (separatorIndex === -1 ? raw : raw.slice(separatorIndex + 1)).trim();
  if (target.length === 0) {
    return null;
  }

  return {
    nextCursor: closeIndex + 2,
    node: {
      type: embed ? "wikilinkEmbed" : "wikilink",
      target,
      embed,
      label: label.length > 0 ? label : target,
      explicitLabel: separatorIndex !== -1,
      value: value.slice(start, closeIndex + 2),
    },
  };
}
