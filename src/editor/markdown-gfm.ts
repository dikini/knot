import { schema } from "./schema";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import type { Root } from "mdast";
import { unified } from "unified";
import { bridgeGfmToProseMirror } from "./markdown-bridge";
import {
  configureMarkdownExtensionProcessor,
  defaultMarkdownExtensionRegistry,
  escapeSerializedMarkdownExtensionSyntax,
  protectEscapedMarkdownExtensionSyntax,
  restoreProtectedMarkdownExtensionSyntax,
  restoreSerializedMarkdownExtensionSyntax,
  serializeMarkdownExtensionSyntaxTree,
  transformMarkdownExtensionSyntaxTree,
  type MarkdownExtensionRegistry,
  type MarkdownExtensionMdastNode,
} from "./markdown-extensions";
import type { MarkdownEngineResult, MarkdownReferenceState, ReferenceDefinition } from "./markdown-syntax";

export function parseGfmMarkdown(
  content: string,
  referenceState: MarkdownReferenceState | undefined = undefined,
  extensionRegistry: MarkdownExtensionRegistry = defaultMarkdownExtensionRegistry
): MarkdownEngineResult {
  const gfmParser = configureMarkdownExtensionProcessor(unified().use(remarkParse).use(remarkGfm), extensionRegistry);
  const syntaxTree = transformMarkdownExtensionSyntaxTree(
    gfmParser.parse(protectEscapedMarkdownExtensionSyntax(content)),
    extensionRegistry
  );
  const bridge = bridgeGfmToProseMirror(syntaxTree, extensionRegistry);
  const resolvedReferenceState = referenceState ?? deriveReferenceStateFromSyntaxTree(syntaxTree);
  const document =
    bridge.document === null
      ? null
      : schema.node("doc", resolvedReferenceState, bridge.document.content);

  return {
    engine: "gfm",
    markdown: content,
    document,
    diagnostics: bridge.diagnostics,
    syntaxTree,
  };
}

export function serializeGfmMarkdownSyntaxTree(
  tree: unknown,
  extensionRegistry: MarkdownExtensionRegistry = defaultMarkdownExtensionRegistry
): string {
  const serializableTree = serializeMarkdownExtensionSyntaxTree(tree as MarkdownExtensionMdastNode, extensionRegistry);
  const gfmStringifier = configureMarkdownExtensionProcessor(
    unified()
      .use(remarkStringify, {
        bullet: "-",
        fences: true,
        listItemIndent: "one",
        rule: "-",
        ruleRepetition: 3,
      })
      .use(remarkGfm, {
        tablePipeAlign: false,
        tableCellPadding: false,
      }),
    extensionRegistry
  );
  const file = gfmStringifier.stringify(serializableTree as unknown as Root);
  const serialized = file.toString().replace(/\n$/, "");
  return restoreProtectedMarkdownExtensionSyntax(
    restoreSerializedMarkdownExtensionSyntax(escapeSerializedMarkdownExtensionSyntax(serialized))
  );
}

function deriveReferenceStateFromSyntaxTree(root: MarkdownExtensionMdastNode): MarkdownReferenceState {
  const referenceDefinitions: Record<string, ReferenceDefinition> = {};
  const referenceOrder: string[] = [];
  const seenOrder = new Set<string>();

  if (!Array.isArray(root.children)) {
    return { referenceDefinitions, referenceOrder };
  }

  for (const child of root.children) {
    if (child.type !== "definition") {
      continue;
    }

    const id = typeof child.identifier === "string" ? child.identifier.trim() : "";
    const href = typeof child.url === "string" ? child.url : "";
    if (!id || !href) {
      continue;
    }

    const normalized = normalizeReferenceId(id);
    referenceDefinitions[normalized] = {
      id,
      href,
      title: typeof child.title === "string" ? child.title : null,
    };
    if (seenOrder.has(normalized)) {
      continue;
    }
    seenOrder.add(normalized);
    referenceOrder.push(id);
  }

  return { referenceDefinitions, referenceOrder };
}

function normalizeReferenceId(value: string): string {
  return value.trim().toLowerCase();
}
