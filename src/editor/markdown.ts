/**
 * Markdown Parser and Serializer for ProseMirror
 *
 * Single-engine implementation based on the markdown-next pipeline.
 */

import { Node as ProseMirrorNode } from "prosemirror-model";
import type { MarkdownExtensionRegistry } from "./markdown-extensions";
import { defaultMarkdownExtensionRegistry } from "./markdown-extensions";
import { serializeProseMirrorDocumentToGfm } from "./markdown-prosemirror-gfm";
import { schema } from "./schema";
import { parseGfmMarkdown } from "./markdown-gfm";
import { parseMarkdownNextDocument } from "./markdown-next";
import type {
  MarkdownEngineComparison,
  MarkdownEngineResult,
  MarkdownReferenceState,
  ReferenceDefinition,
} from "./markdown-syntax";

export type {
  MarkdownDiagnostic,
  MarkdownDiagnosticSeverity,
  MarkdownEngineComparison,
  MarkdownEngineName,
  MarkdownEngineResult,
  MarkdownReferenceState,
  ReferenceDefinition,
} from "./markdown-syntax";

export interface ParseOptions {
  preserveWhitespace?: boolean;
  collectReferenceDefinitions?: boolean;
  referenceDefinitions?: Record<string, ReferenceDefinition>;
  referenceOrder?: string[];
  extensionRegistry?: MarkdownExtensionRegistry;
}

export function parseMarkdown(content: string, options: ParseOptions = {}): ProseMirrorNode {
  const comparison = compareMarkdownEngines(content, options);
  if (comparison.gfm.document !== null && comparison.gfm.diagnostics.length === 0) {
    return comparison.gfm.document;
  }
  return comparison.legacy.document!;
}

export function serializeMarkdown(doc: ProseMirrorNode): string {
  return normalizeEscapedLiteralHtml(
    normalizeEscapedWikilinks(
      serializeProseMirrorDocumentToGfm(
        doc,
        defaultMarkdownExtensionRegistry
      )
    )
  );
}

export function compareMarkdownEngines(content: string, options: ParseOptions = {}): MarkdownEngineComparison {
  const referenceState = resolveReferenceState(content, options);
  return {
    legacy: parseLegacyMarkdown(content, referenceState),
    gfm: parseGfmMarkdown(content, undefined, options.extensionRegistry),
  };
}

function parseLegacyMarkdown(content: string, referenceState: MarkdownReferenceState): MarkdownEngineResult & {
  document: ProseMirrorNode;
} {
  const parsed = parseMarkdownNextDocument(content);
  return {
    engine: "legacy",
    markdown: content,
    document: schema.node("doc", referenceState, parsed.content),
    diagnostics: [],
  };
}

function normalizeReferenceId(value: string): string {
  return value.trim().toLowerCase();
}

function sanitizeHref(rawHref: string): string {
  const href = rawHref.trim();
  if (href.startsWith("<") && href.endsWith(">")) {
    return href.slice(1, -1);
  }
  return href;
}

function extractReferenceDefinitions(lines: string[]): {
  definitions: ReferenceDefinition[];
  remainingLines: string[];
} {
  const definitions: ReferenceDefinition[] = [];
  const remainingLines: string[] = [];

  for (const line of lines) {
    const match = line.match(/^\s*\[([^\]]+)\]:\s*(\S+)(?:\s+"([^"]*)")?\s*$/);
    if (!match) {
      remainingLines.push(line);
      continue;
    }

    const id = match[1].trim();
    const href = sanitizeHref(match[2]);
    const title = match[3] ?? null;
    if (!id || !href) {
      remainingLines.push(line);
      continue;
    }

    definitions.push({ id, href, title });
  }

  return { definitions, remainingLines };
}

function findReferenceDefinition(
  referenceDefinitions: Record<string, ReferenceDefinition>,
  refId: string
): ReferenceDefinition | null {
  return referenceDefinitions[normalizeReferenceId(refId)] ?? null;
}

function normalizeEscapedWikilinks(markdown: string): string {
  const normalizedBracketEscapes = markdown.replace(/\\(?=[\[\]])/g, "");

  return normalizedBracketEscapes.replace(/\\+\[\\+\[([^\n\]]+)\\+\]\\+\]/g, (_match, inner: string) => {
    const value = inner.trim();
    return value.length > 0 ? `[[${value}]]` : _match;
  });
}

function normalizeEscapedLiteralHtml(markdown: string): string {
  // TODO(markdown-platform-024): scope this to raw-HTML fallback cases only.
  // This currently strips escapes before angle brackets globally to preserve
  // literal HTML-looking source, but it can also rewrite intentional escapes.
  return markdown.replace(/\\(?=[<>])/g, "");
}

function resolveReferenceState(content: string, options: ParseOptions): MarkdownReferenceState {
  const inheritedDefinitions = options.referenceDefinitions ?? {};
  const inheritedOrder =
    options.referenceOrder ?? Object.values(inheritedDefinitions).map((value) => value.id);
  const extracted =
    options.collectReferenceDefinitions === false
      ? []
      : extractReferenceDefinitions(content.split("\n")).definitions;

  const referenceDefinitions: Record<string, ReferenceDefinition> = {};
  const referenceOrder: string[] = [];
  const seenOrder = new Set<string>();

  const addDefinition = (definition: ReferenceDefinition) => {
    const normalized = normalizeReferenceId(definition.id);
    referenceDefinitions[normalized] = definition;
    if (seenOrder.has(normalized)) {
      return;
    }
    seenOrder.add(normalized);
    referenceOrder.push(definition.id);
  };

  for (const id of inheritedOrder) {
    const definition = findReferenceDefinition(inheritedDefinitions, id);
    if (!definition) {
      continue;
    }
    addDefinition(definition);
  }

  for (const definition of extracted) {
    addDefinition(definition);
  }

  return { referenceDefinitions, referenceOrder };
}
