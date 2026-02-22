/**
 * Markdown Parser and Serializer for ProseMirror
 *
 * Single-engine implementation based on the markdown-next pipeline.
 */

import { Node as ProseMirrorNode } from "prosemirror-model";
import { schema } from "./schema";
import { parseMarkdownNextDocument, serializeMarkdownNextDocument } from "./markdown-next";

export interface ParseOptions {
  preserveWhitespace?: boolean;
  collectReferenceDefinitions?: boolean;
  referenceDefinitions?: Record<string, ReferenceDefinition>;
  referenceOrder?: string[];
}

export interface ReferenceDefinition {
  id: string;
  href: string;
  title: string | null;
}

export function parseMarkdown(content: string, options: ParseOptions = {}): ProseMirrorNode {
  const lines = content.split("\n");
  const inheritedDefinitions = options.referenceDefinitions ?? {};
  const inheritedOrder =
    options.referenceOrder ?? Object.values(inheritedDefinitions).map((value) => value.id);
  const extracted =
    options.collectReferenceDefinitions === false
      ? { definitions: [] as ReferenceDefinition[] }
      : extractReferenceDefinitions(lines);

  const referenceDefinitions: Record<string, ReferenceDefinition> = { ...inheritedDefinitions };
  const referenceOrder = [...inheritedOrder];

  for (const definition of extracted.definitions) {
    const normalized = normalizeReferenceId(definition.id);
    if (!referenceOrder.includes(definition.id)) {
      referenceOrder.push(definition.id);
    }
    referenceDefinitions[normalized] = definition;
  }

  const parsed = parseMarkdownNextDocument(content);
  return schema.node("doc", { referenceDefinitions, referenceOrder }, parsed.content);
}

export function serializeMarkdown(doc: ProseMirrorNode): string {
  const content = normalizeEscapedWikilinks(serializeMarkdownNextDocument(doc));
  const definitions = serializeReferenceDefinitions(doc);
  if (definitions.length === 0) {
    return content;
  }

  if (content.trim().length === 0) {
    return definitions.join("\n");
  }

  return `${content}\n\n${definitions.join("\n")}`;
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

function serializeReferenceDefinitions(doc: ProseMirrorNode): string[] {
  const attrs = doc.attrs as {
    referenceDefinitions?: Record<string, ReferenceDefinition>;
    referenceOrder?: string[];
  };

  const referenceDefinitions = attrs.referenceDefinitions ?? {};
  const referenceOrder = attrs.referenceOrder ?? Object.values(referenceDefinitions).map((value) => value.id);

  return referenceOrder
    .map((id) => findReferenceDefinition(referenceDefinitions, id))
    .filter((definition): definition is ReferenceDefinition => definition !== null)
    .map((definition) => {
      if (definition.title) {
        return `[${definition.id}]: ${definition.href} "${definition.title}"`;
      }
      return `[${definition.id}]: ${definition.href}`;
    });
}

function normalizeEscapedWikilinks(markdown: string): string {
  return markdown.replace(/\\\[\\\[([^\n\]]+)\\\]\\\]/g, (_match, inner: string) => {
    const value = inner.trim();
    return value.length > 0 ? `[[${value}]]` : _match;
  });
}
