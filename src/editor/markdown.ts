/**
 * Markdown Parser and Serializer for ProseMirror
 * 
 * Converts between Markdown text and ProseMirror document structure.
 * Uses a simplified approach compatible with the schema.
 */

import { Schema, Node as ProseMirrorNode } from "prosemirror-model";
import { schema } from "./schema";
import { parseMarkdownNextDocument, serializeMarkdownNextDocument } from "./markdown-next";

export interface ParseOptions {
  preserveWhitespace?: boolean;
  collectReferenceDefinitions?: boolean;
  referenceDefinitions?: Record<string, ReferenceDefinition>;
  referenceOrder?: string[];
}

export type MarkdownEngine = "legacy" | "next";

export interface MarkdownAdapter {
  engine: MarkdownEngine;
  parse: (content: string, options?: ParseOptions) => ProseMirrorNode;
  serialize: (doc: ProseMirrorNode) => string;
}

export interface ReferenceDefinition {
  id: string;
  href: string;
  title: string | null;
}

export interface MarkdownEngineConfig {
  activeEngine: MarkdownEngine;
  enableLegacyFallback: boolean;
}

let markdownEngineConfig: MarkdownEngineConfig = {
  activeEngine: "legacy",
  enableLegacyFallback: true,
};

export function getMarkdownEngineConfig(): MarkdownEngineConfig {
  return { ...markdownEngineConfig };
}

export function setMarkdownEngineConfig(next: Partial<MarkdownEngineConfig>): void {
  markdownEngineConfig = {
    ...markdownEngineConfig,
    ...next,
  };
}

export function parseMarkdownWithEngine(
  content: string,
  engine: MarkdownEngine = "legacy",
  options: ParseOptions = {}
): ProseMirrorNode {
  switch (engine) {
    case "legacy":
      return parseMarkdownLegacy(content, options);
    case "next":
      return parseMarkdownNext(content, options);
  }
}

export function serializeMarkdownWithEngine(
  doc: ProseMirrorNode,
  engine: MarkdownEngine = "legacy"
): string {
  switch (engine) {
    case "legacy":
      return serializeMarkdownLegacy(doc);
    case "next":
      return serializeMarkdownNext(doc);
  }
}

export function createMarkdownAdapter(engine: MarkdownEngine = "legacy"): MarkdownAdapter {
  return {
    engine,
    parse: (content: string, options: ParseOptions = {}) =>
      parseMarkdownWithEngine(content, engine, options),
    serialize: (doc: ProseMirrorNode) => serializeMarkdownWithEngine(doc, engine),
  };
}

export function parseMarkdownAuto(content: string, options: ParseOptions = {}): ProseMirrorNode {
  const { activeEngine, enableLegacyFallback } = markdownEngineConfig;
  try {
    return parseMarkdownWithEngine(content, activeEngine, options);
  } catch (error) {
    if (!enableLegacyFallback || activeEngine === "legacy") {
      throw error;
    }
    return parseMarkdownWithEngine(content, "legacy", options);
  }
}

export function serializeMarkdownAuto(doc: ProseMirrorNode): string {
  const { activeEngine, enableLegacyFallback } = markdownEngineConfig;
  try {
    return serializeMarkdownWithEngine(doc, activeEngine);
  } catch (error) {
    if (!enableLegacyFallback || activeEngine === "legacy") {
      throw error;
    }
    return serializeMarkdownWithEngine(doc, "legacy");
  }
}

/**
 * Parse markdown text into a ProseMirror document.
 */
export function parseMarkdown(content: string, _options: ParseOptions = {}): ProseMirrorNode {
  return parseMarkdownLegacy(content, _options);
}

export function parseMarkdownLegacy(content: string, _options: ParseOptions = {}): ProseMirrorNode {
  return parseMarkdownInternal(content, _options);
}

export function parseMarkdownNext(content: string, _options: ParseOptions = {}): ProseMirrorNode {
  const lines = content.split("\n");
  const inheritedDefinitions = _options.referenceDefinitions ?? {};
  const inheritedOrder = _options.referenceOrder ?? Object.values(inheritedDefinitions).map((value) => value.id);
  const extracted = _options.collectReferenceDefinitions === false
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

function parseMarkdownInternal(content: string, options: ParseOptions): ProseMirrorNode {
  const lines = content.split("\n");
  const {
    lines: contentLines,
    referenceDefinitions,
    referenceOrder,
  } = buildReferenceContext(lines, options);

  const nodes: ProseMirrorNode[] = [];
  
  let i = 0;
  while (i < contentLines.length) {
    const line = contentLines[i];
    
    // Parse headings
    if (line.startsWith("# ")) {
      nodes.push(createHeading(schema, 1, line.slice(2), referenceDefinitions));
      i++;
    } else if (line.startsWith("## ")) {
      nodes.push(createHeading(schema, 2, line.slice(3), referenceDefinitions));
      i++;
    } else if (line.startsWith("### ")) {
      nodes.push(createHeading(schema, 3, line.slice(4), referenceDefinitions));
      i++;
    } else if (line.startsWith("#### ")) {
      nodes.push(createHeading(schema, 4, line.slice(5), referenceDefinitions));
      i++;
    } else if (line.startsWith("##### ")) {
      nodes.push(createHeading(schema, 5, line.slice(6), referenceDefinitions));
      i++;
    } else if (line.startsWith("###### ")) {
      nodes.push(createHeading(schema, 6, line.slice(7), referenceDefinitions));
      i++;
    }
    // Parse code blocks
    else if (line.startsWith("```")) {
      const { node, nextIndex } = parseCodeBlock(contentLines, i);
      nodes.push(node);
      i = nextIndex;
    }
    // Parse horizontal rule
    else if (line.trim() === "---" || line.trim() === "***" || line.trim() === "___") {
      nodes.push(schema.node("horizontal_rule"));
      i++;
    }
    // Parse blockquote
    else if (line.startsWith("> ")) {
      const { node, nextIndex } = parseBlockquote(contentLines, i, referenceDefinitions, referenceOrder);
      nodes.push(node);
      i = nextIndex;
    }
    // Parse list items
    else if (line.match(/^(\s*)[-*+]\s/)) {
      const { node, nextIndex } = parseList(contentLines, i, "bullet", referenceDefinitions, referenceOrder);
      nodes.push(node);
      i = nextIndex;
    }
    else if (line.match(/^(\s*)\d+\.\s/)) {
      const { node, nextIndex } = parseList(contentLines, i, "ordered", referenceDefinitions, referenceOrder);
      nodes.push(node);
      i = nextIndex;
    }
    // Parse paragraph (default)
    else if (line.trim().length > 0) {
      const { node, nextIndex } = parseParagraph(contentLines, i, referenceDefinitions);
      nodes.push(node);
      i = nextIndex;
    }
    // Skip empty lines
    else {
      i++;
    }
  }
  
  if (nodes.length === 0) {
    nodes.push(schema.node("paragraph"));
  }

  return schema.node("doc", { referenceDefinitions, referenceOrder }, nodes);
}

/**
 * Serialize a ProseMirror document to markdown text.
 */
export function serializeMarkdown(doc: ProseMirrorNode): string {
  return serializeMarkdownLegacy(doc);
}

export function serializeMarkdownLegacy(doc: ProseMirrorNode): string {
  const parts: string[] = [];
  
  doc.forEach((node) => {
    parts.push(serializeNode(node));
  });

  const content = parts.join("\n\n");
  const definitions = serializeReferenceDefinitions(doc);
  if (definitions.length === 0) {
    return content;
  }

  if (content.trim().length === 0) {
    return definitions.join("\n");
  }

  return `${content}\n\n${definitions.join("\n")}`;
}

export function serializeMarkdownNext(doc: ProseMirrorNode): string {
  const content = serializeMarkdownNextDocument(doc);
  const definitions = serializeReferenceDefinitions(doc);
  if (definitions.length === 0) {
    return content;
  }

  if (content.trim().length === 0) {
    return definitions.join("\n");
  }

  return `${content}\n\n${definitions.join("\n")}`;
}

//region Helper Functions

function createHeading(
  schema: Schema,
  level: number,
  text: string,
  referenceDefinitions: Record<string, ReferenceDefinition>
): ProseMirrorNode {
  const content = parseInline(text, referenceDefinitions);
  return schema.node("heading", { level }, content);
}

function parseParagraph(
  lines: string[],
  start: number,
  referenceDefinitions: Record<string, ReferenceDefinition>
): { node: ProseMirrorNode; nextIndex: number } {
  const content: string[] = [];
  let i = start;
  
  while (i < lines.length && lines[i].trim().length > 0 && !isBlockStart(lines[i])) {
    content.push(lines[i]);
    i++;
  }
  
  const text = content.join(" ");
  const inlineContent = parseInline(text, referenceDefinitions);
  
  return {
    node: schema.node("paragraph", null, inlineContent),
    nextIndex: i,
  };
}

function parseCodeBlock(lines: string[], start: number): { node: ProseMirrorNode; nextIndex: number } {
  const fence = lines[start].slice(0, 3);
  const lang = lines[start].slice(3).trim();
  let i = start + 1;
  const code: string[] = [];
  
  while (i < lines.length && !lines[i].startsWith(fence)) {
    code.push(lines[i]);
    i++;
  }
  
  // Skip the closing fence
  if (i < lines.length) {
    i++;
  }
  
  const codeText = code.join("\n");
  const contentNodes = codeText.length > 0 ? [schema.text(codeText)] : [];

  return {
    node: schema.node("code_block", { language: lang || null }, contentNodes),
    nextIndex: i,
  };
}

function parseBlockquote(
  lines: string[],
  start: number,
  referenceDefinitions: Record<string, ReferenceDefinition>,
  referenceOrder: string[]
): { node: ProseMirrorNode; nextIndex: number } {
  const content: string[] = [];
  let i = start;
  
  while (i < lines.length && lines[i].startsWith("> ")) {
    content.push(lines[i].slice(2));
    i++;
  }
  
  // Recursively parse the content inside the blockquote
  const innerDoc = parseMarkdownInternal(content.join("\n"), {
    collectReferenceDefinitions: false,
    referenceDefinitions,
    referenceOrder,
  });
  const innerNodes: ProseMirrorNode[] = [];
  innerDoc.forEach((node) => innerNodes.push(node));
  
  return {
    node: schema.node("blockquote", null, innerNodes),
    nextIndex: i,
  };
}

function parseList(
  lines: string[],
  start: number,
  type: "bullet" | "ordered",
  referenceDefinitions: Record<string, ReferenceDefinition>,
  referenceOrder: string[]
): { node: ProseMirrorNode; nextIndex: number } {
  const items: ProseMirrorNode[] = [];
  let i = start;
  
  while (i < lines.length) {
    const match = lines[i].match(/^(\s*)(?:[-*+]|\d+\.)\s(.*)$/);
    if (!match) break;
    
    const indent = match[1].length;
    const content = match[2];
    
    // Collect all lines for this item
    const itemLines: string[] = [content];
    i++;
    
    while (i < lines.length) {
      // Check if next line is a new list item at same or lower indent
      const nextMatch = lines[i].match(/^(\s*)(?:[-*+]|\d+\.)\s/);
      if (nextMatch && nextMatch[1].length <= indent) {
        break;
      }
      
      // Check if line is indented content or empty
      if (lines[i].length > indent || lines[i].trim().length === 0) {
        itemLines.push(lines[i].slice(indent + 2));
        i++;
      } else {
        break;
      }
    }
    
    // Parse item content
    const innerDoc = parseMarkdownInternal(itemLines.join("\n"), {
      collectReferenceDefinitions: false,
      referenceDefinitions,
      referenceOrder,
    });
    const innerNodes: ProseMirrorNode[] = [];
    innerDoc.forEach((node) => innerNodes.push(node));
    
    items.push(schema.node("list_item", null, innerNodes));
  }
  
  const nodeType = type === "bullet" ? "bullet_list" : "ordered_list";
  return {
    node: schema.node(nodeType, null, items),
    nextIndex: i,
  };
}

function parseInline(
  text: string,
  referenceDefinitions: Record<string, ReferenceDefinition>
): ProseMirrorNode[] {
  const nodes: ProseMirrorNode[] = [];
  let currentText = "";
  
  let i = 0;
  while (i < text.length) {
    // Bold and italic (*** or ___)
    if ((text.slice(i, i + 3) === "***" || text.slice(i, i + 3) === "___") && i + 3 < text.length) {
      if (currentText) {
        nodes.push(schema.text(currentText));
        currentText = "";
      }
      const endIdx = findClosing(text, i + 3, text.slice(i, i + 3));
      if (endIdx > 0) {
        const inner = text.slice(i + 3, endIdx);
        if (inner.length > 0) {
          nodes.push(schema.text(inner, [schema.mark("em"), schema.mark("strong")]));
        }
        i = endIdx + 3;
      } else {
        currentText += text[i];
        i++;
      }
    }
    // Bold (** or __)
    else if ((text.slice(i, i + 2) === "**" || text.slice(i, i + 2) === "__") && i + 2 < text.length) {
      if (currentText) {
        nodes.push(schema.text(currentText));
        currentText = "";
      }
      const marker = text.slice(i, i + 2);
      const endIdx = findClosing(text, i + 2, marker);
      if (endIdx > 0) {
        const inner = text.slice(i + 2, endIdx);
        const innerNodes = parseInline(inner, referenceDefinitions);
        nodes.push(...innerNodes.map(n => {
          if (n.isText) {
            return schema.text(n.text!, [...(n.marks || []), schema.mark("strong")]);
          }
          return n;
        }));
        i = endIdx + 2;
      } else {
        currentText += text[i];
        i++;
      }
    }
    // Italic (* or _)
    else if ((text[i] === "*" || text[i] === "_") && i + 1 < text.length && text[i + 1] !== " ") {
      if (currentText) {
        nodes.push(schema.text(currentText));
        currentText = "";
      }
      const marker = text[i];
      const endIdx = findClosing(text, i + 1, marker);
      if (endIdx > 0) {
        const inner = text.slice(i + 1, endIdx);
        const innerNodes = parseInline(inner, referenceDefinitions);
        nodes.push(...innerNodes.map(n => {
          if (n.isText) {
            return schema.text(n.text!, [...(n.marks || []), schema.mark("em")]);
          }
          return n;
        }));
        i = endIdx + 1;
      } else {
        currentText += text[i];
        i++;
      }
    }
    // Code (`)
    else if (text[i] === "`") {
      if (currentText) {
        nodes.push(schema.text(currentText));
        currentText = "";
      }
      const endIdx = findClosing(text, i + 1, "`");
      if (endIdx > 0) {
        const code = text.slice(i + 1, endIdx);
        if (code.length > 0) {
          nodes.push(schema.text(code, [schema.mark("code")]));
        }
        i = endIdx + 1;
      } else {
        currentText += text[i];
        i++;
      }
    }
    // Wikilink ([[...]])
    else if (text.slice(i, i + 2) === "[[") {
      if (currentText) {
        nodes.push(schema.text(currentText));
        currentText = "";
      }
      const endIdx = text.indexOf("]]", i + 2);
      if (endIdx > 0) {
        const inner = text.slice(i + 2, endIdx);
        const [target, display] = inner.includes("|") 
          ? inner.split("|", 2).map(s => s.trim())
          : [inner.trim(), inner.trim()];
        nodes.push(schema.text(display, [schema.mark("wikilink", { target })]));
        i = endIdx + 2;
      } else {
        currentText += text[i];
        i++;
      }
    }
    // Reference link ([...][id] or [...][])
    else if (text[i] === "[") {
      const fullRefMatch = text.slice(i).match(/^\[([^\]]+)\]\[([^\]]*)\]/);
      if (fullRefMatch) {
        if (currentText) {
          nodes.push(schema.text(currentText));
          currentText = "";
        }

        const display = fullRefMatch[1].trim();
        const refId = (fullRefMatch[2].trim() || display).trim();
        const definition = findReferenceDefinition(referenceDefinitions, refId);
        if (definition) {
          nodes.push(
            schema.text(display, [
              schema.mark("link", {
                href: definition.href,
                title: definition.title,
                refId: definition.id,
              }),
            ])
          );
          i += fullRefMatch[0].length;
          continue;
        }
      }

      // Shortcut reference link ([id])
      const shortcutRefMatch = text.slice(i).match(/^\[([^\]]+)\](?!\()/);
      if (shortcutRefMatch) {
        const refId = shortcutRefMatch[1].trim();
        const definition = findReferenceDefinition(referenceDefinitions, refId);
        if (definition) {
          if (currentText) {
            nodes.push(schema.text(currentText));
            currentText = "";
          }
          nodes.push(
            schema.text(refId, [
              schema.mark("link", {
                href: definition.href,
                title: definition.title,
                refId: definition.id,
              }),
            ])
          );
          i += shortcutRefMatch[0].length;
          continue;
        }
      }

      // Link ([...](...))
      if (currentText) {
        nodes.push(schema.text(currentText));
        currentText = "";
      }
      const closeBracket = text.indexOf("]", i + 1);
      if (closeBracket > 0 && text[closeBracket + 1] === "(") {
        const closeParen = text.indexOf(")", closeBracket + 2);
        if (closeParen > 0) {
          const display = text.slice(i + 1, closeBracket);
          const href = text.slice(closeBracket + 2, closeParen);
          if (display.length > 0) {
            nodes.push(schema.text(display, [schema.mark("link", { href, title: null, refId: null })]));
          }
          i = closeParen + 1;
        } else {
          currentText += text[i];
          i++;
        }
      } else {
        currentText += text[i];
        i++;
      }
    }
    // Link fallback branch handled above
    else if (text[i] === "[") {
      currentText += text[i];
      i++;
    }
    // Strikethrough (~~)
    else if (text.slice(i, i + 2) === "~~" && i + 2 < text.length) {
      if (currentText) {
        nodes.push(schema.text(currentText));
        currentText = "";
      }
      const endIdx = findClosing(text, i + 2, "~~");
      if (endIdx > 0) {
        const inner = text.slice(i + 2, endIdx);
        if (inner.length > 0) {
          nodes.push(schema.text(inner, [schema.mark("strike")]));
        }
        i = endIdx + 2;
      } else {
        currentText += text[i];
        i++;
      }
    }
    else {
      currentText += text[i];
      i++;
    }
  }
  
  if (currentText) {
    nodes.push(schema.text(currentText));
  }
  
  return nodes;
}

function findClosing(text: string, start: number, marker: string): number {
  let i = start;
  while (i < text.length) {
    if (text.slice(i, i + marker.length) === marker) {
      return i;
    }
    i++;
  }
  return -1;
}

function isBlockStart(line: string): boolean {
  return (
    line.startsWith("#") ||
    line.startsWith("```") ||
    line.startsWith("> ") ||
    line.match(/^(\s*)[-*+]\s/) !== null ||
    line.match(/^(\s*)\d+\.\s/) !== null ||
    line.trim() === "---" ||
    line.trim() === "***" ||
    line.trim() === "___"
  );
}

function serializeNode(node: ProseMirrorNode): string {
  switch (node.type.name) {
    case "paragraph": {
      return serializeInline(node);
    }

    case "heading": {
      const level = node.attrs.level as number;
      const hashes = "#".repeat(level);
      return `${hashes} ${serializeInline(node)}`;
    }

    case "code_block": {
      const lang = node.attrs.language || "";
      const code = node.textContent;
      return "```" + lang + "\n" + code + "\n```";
    }

    case "blockquote": {
      const content = [] as string[];
      node.forEach((child) => {
        content.push(serializeNode(child));
      });
      return content
        .join("\n\n")
        .split("\n")
        .map((line) => "> " + line)
        .join("\n");
    }

    case "bullet_list": {
      const bulletItems: string[] = [];
      node.forEach((item) => {
        const itemContent: string[] = [];
        item.forEach((child) => {
          itemContent.push(serializeNode(child));
        });
        bulletItems.push("- " + itemContent.join("\n"));
      });
      return bulletItems.join("\n");
    }

    case "ordered_list": {
      const orderedItems: string[] = [];
      let num = 1;
      node.forEach((item) => {
        const itemContent: string[] = [];
        item.forEach((child) => {
          itemContent.push(serializeNode(child));
        });
        orderedItems.push(`${num}. ` + itemContent.join("\n"));
        num++;
      });
      return orderedItems.join("\n");
    }

    case "horizontal_rule": {
      return "---";
    }

    default: {
      return "";
    }
  }
}

function serializeInline(node: ProseMirrorNode): string {
  const parts: string[] = [];
  
  node.forEach((child) => {
    if (child.isText) {
      let text = child.text || "";
      const marks = child.marks;
      
      // Apply marks in reverse order (innermost first)
      for (const mark of marks) {
        switch (mark.type.name) {
          case "strong": {
            text = `**${text}**`;
            break;
          }
          case "em": {
            text = `*${text}*`;
            break;
          }
          case "code": {
            text = "`" + text + "`";
            break;
          }
          case "strike": {
            text = `~~${text}~~`;
            break;
          }
          case "link": {
            const href = mark.attrs.href;
            const title = mark.attrs.title;
            const refId = mark.attrs.refId;
            if (refId) {
              text = `[${text}][${refId}]`;
            } else if (title) {
              text = `[${text}](${href} "${title}")`;
            } else {
              text = `[${text}](${href})`;
            }
            break;
          }
          case "wikilink": {
            const target = mark.attrs.target;
            if (target === text) {
              text = `[[${target}]]`;
            } else {
              text = `[[${target}|${text}]]`;
            }
            break;
          }
        }
      }
      
      parts.push(text);
    }
  });
  
  return parts.join("");
}

//endregion

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

function buildReferenceContext(
  lines: string[],
  options: ParseOptions
): {
  lines: string[];
  referenceDefinitions: Record<string, ReferenceDefinition>;
  referenceOrder: string[];
} {
  const inheritedDefinitions = options.referenceDefinitions ?? {};
  const inheritedOrder = options.referenceOrder ?? Object.values(inheritedDefinitions).map((value) => value.id);

  if (options.collectReferenceDefinitions === false) {
    return {
      lines,
      referenceDefinitions: inheritedDefinitions,
      referenceOrder: inheritedOrder,
    };
  }

  const extracted = extractReferenceDefinitions(lines);
  const referenceDefinitions: Record<string, ReferenceDefinition> = { ...inheritedDefinitions };
  const referenceOrder = [...inheritedOrder];

  for (const definition of extracted.definitions) {
    const normalized = normalizeReferenceId(definition.id);
    if (!referenceOrder.includes(definition.id)) {
      referenceOrder.push(definition.id);
    }
    referenceDefinitions[normalized] = definition;
  }

  return {
    lines: extracted.remainingLines,
    referenceDefinitions,
    referenceOrder,
  };
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
