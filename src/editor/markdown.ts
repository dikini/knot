/**
 * Markdown Parser and Serializer for ProseMirror
 * 
 * Converts between Markdown text and ProseMirror document structure.
 * Uses a simplified approach compatible with the schema.
 */

import { Schema, Node as ProseMirrorNode } from "prosemirror-model";
import { schema } from "./schema";

export interface ParseOptions {
  preserveWhitespace?: boolean;
}

/**
 * Parse markdown text into a ProseMirror document.
 */
export function parseMarkdown(content: string, _options: ParseOptions = {}): ProseMirrorNode {
  const lines = content.split("\n");
  const nodes: ProseMirrorNode[] = [];
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    
    // Parse headings
    if (line.startsWith("# ")) {
      nodes.push(createHeading(schema, 1, line.slice(2)));
      i++;
    } else if (line.startsWith("## ")) {
      nodes.push(createHeading(schema, 2, line.slice(3)));
      i++;
    } else if (line.startsWith("### ")) {
      nodes.push(createHeading(schema, 3, line.slice(4)));
      i++;
    } else if (line.startsWith("#### ")) {
      nodes.push(createHeading(schema, 4, line.slice(5)));
      i++;
    } else if (line.startsWith("##### ")) {
      nodes.push(createHeading(schema, 5, line.slice(6)));
      i++;
    } else if (line.startsWith("###### ")) {
      nodes.push(createHeading(schema, 6, line.slice(7)));
      i++;
    }
    // Parse code blocks
    else if (line.startsWith("```")) {
      const { node, nextIndex } = parseCodeBlock(lines, i);
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
      const { node, nextIndex } = parseBlockquote(lines, i);
      nodes.push(node);
      i = nextIndex;
    }
    // Parse list items
    else if (line.match(/^(\s*)[-*+]\s/)) {
      const { node, nextIndex } = parseList(lines, i, "bullet");
      nodes.push(node);
      i = nextIndex;
    }
    else if (line.match(/^(\s*)\d+\.\s/)) {
      const { node, nextIndex } = parseList(lines, i, "ordered");
      nodes.push(node);
      i = nextIndex;
    }
    // Parse paragraph (default)
    else if (line.trim().length > 0) {
      const { node, nextIndex } = parseParagraph(lines, i);
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

  return schema.node("doc", null, nodes);
}

/**
 * Serialize a ProseMirror document to markdown text.
 */
export function serializeMarkdown(doc: ProseMirrorNode): string {
  const parts: string[] = [];
  
  doc.forEach((node) => {
    parts.push(serializeNode(node));
  });
  
  return parts.join("\n\n");
}

//region Helper Functions

function createHeading(schema: Schema, level: number, text: string): ProseMirrorNode {
  const content = parseInline(text);
  return schema.node("heading", { level }, content);
}

function parseParagraph(lines: string[], start: number): { node: ProseMirrorNode; nextIndex: number } {
  const content: string[] = [];
  let i = start;
  
  while (i < lines.length && lines[i].trim().length > 0 && !isBlockStart(lines[i])) {
    content.push(lines[i]);
    i++;
  }
  
  const text = content.join(" ");
  const inlineContent = parseInline(text);
  
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

function parseBlockquote(lines: string[], start: number): { node: ProseMirrorNode; nextIndex: number } {
  const content: string[] = [];
  let i = start;
  
  while (i < lines.length && lines[i].startsWith("> ")) {
    content.push(lines[i].slice(2));
    i++;
  }
  
  // Recursively parse the content inside the blockquote
  const innerDoc = parseMarkdown(content.join("\n"));
  const innerNodes: ProseMirrorNode[] = [];
  innerDoc.forEach((node) => innerNodes.push(node));
  
  return {
    node: schema.node("blockquote", null, innerNodes),
    nextIndex: i,
  };
}

function parseList(lines: string[], start: number, type: "bullet" | "ordered"): { node: ProseMirrorNode; nextIndex: number } {
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
    const innerDoc = parseMarkdown(itemLines.join("\n"));
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

function parseInline(text: string): ProseMirrorNode[] {
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
        const innerNodes = parseInline(inner);
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
        const innerNodes = parseInline(inner);
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
    // Link ([...](...))
    else if (text[i] === "[") {
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
            nodes.push(schema.text(display, [schema.mark("link", { href, title: null })]));
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
            if (title) {
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
