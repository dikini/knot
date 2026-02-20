import { DOMSerializer } from "prosemirror-model";
import { parseMarkdown } from "./markdown";
import { schema } from "./schema";

/**
 * Render markdown to HTML using the same markdown->ProseMirror pipeline
 * used by edit mode, so view mode stays structurally consistent.
 */
export function renderMarkdownToHtml(markdown: string): string {
  const doc = parseMarkdown(markdown);
  const serializer = DOMSerializer.fromSchema(schema);
  const fragment = serializer.serializeFragment(doc.content);
  const container = document.createElement("div");
  container.appendChild(fragment);
  return container.innerHTML;
}
