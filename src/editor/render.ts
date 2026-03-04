import { DOMSerializer, Fragment, type Node as ProseMirrorNode } from "prosemirror-model";
import katex from "katex";
import { compareMarkdownEngines, parseMarkdown, serializeMarkdown } from "./markdown";
import { schema } from "./schema";

// TRACE: DESIGN-mermaid-diagrams-001
let mermaidInitialized = false;

function rewriteMermaidBlocks(container: HTMLDivElement): void {
  const mermaidBlocks = container.querySelectorAll<HTMLPreElement>("pre[data-language='mermaid']");
  for (const block of mermaidBlocks) {
    const source = block.textContent ?? "";
    const wrapper = document.createElement("div");
    wrapper.className = "editor-mermaid";
    wrapper.dataset.mermaidDiagram = "true";

    const sourcePre = document.createElement("pre");
    sourcePre.className = "editor-mermaid__source";
    const sourceCode = document.createElement("code");
    sourceCode.textContent = source;
    sourcePre.appendChild(sourceCode);
    wrapper.appendChild(sourcePre);

    block.replaceWith(wrapper);
  }
}

function rewriteTaskListBlocks(container: HTMLDivElement): void {
  const taskItems = container.querySelectorAll<HTMLLIElement>("li[data-task='true']");
  for (const [taskIndex, item] of taskItems.entries()) {
    item.parentElement?.classList.add("task-list");
    item.dataset.taskIndex = String(taskIndex);

    if (item.querySelector("[data-task-checkbox='true']")) {
      continue;
    }

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task-list-item__checkbox";
    checkbox.checked = item.dataset.checked === "true";
    if (checkbox.checked) {
      checkbox.setAttribute("checked", "");
    }
    checkbox.setAttribute("data-task-checkbox", "true");
    checkbox.setAttribute("aria-label", checkbox.checked ? "Mark task incomplete" : "Mark task complete");

    item.classList.add("task-list-item");
    item.insertBefore(checkbox, item.firstChild);
  }
}

function rewriteMathNodes(container: HTMLDivElement): void {
  const inlineMathNodes = container.querySelectorAll<HTMLElement>("math-inline");
  for (const node of inlineMathNodes) {
    const source = node.textContent ?? "";
    const wrapper = document.createElement("span");
    wrapper.className = "editor-math editor-math--inline";
    wrapper.dataset.mathNode = "inline";
    wrapper.innerHTML = katex.renderToString(source, {
      displayMode: false,
      throwOnError: false,
    });
    node.replaceWith(wrapper);
  }

  const displayMathNodes = container.querySelectorAll<HTMLElement>("math-display");
  for (const node of displayMathNodes) {
    const source = node.textContent ?? "";
    const wrapper = document.createElement("div");
    wrapper.className = "editor-math editor-math--display";
    wrapper.dataset.mathNode = "display";
    wrapper.innerHTML = katex.renderToString(source, {
      displayMode: true,
      throwOnError: false,
    });
    node.replaceWith(wrapper);
  }
}

/**
 * Render markdown to HTML using the same markdown->ProseMirror pipeline
 * used by edit mode, so view mode stays structurally consistent.
 */
export function renderMarkdownToHtml(markdown: string): string {
  const doc = resolveRenderDocument(markdown);
  const serializer = DOMSerializer.fromSchema(schema);
  const fragment = serializer.serializeFragment(doc.content);
  const container = document.createElement("div");
  container.appendChild(fragment);
  rewriteTaskListBlocks(container);
  rewriteMathNodes(container);
  rewriteMermaidBlocks(container);
  return container.innerHTML;
}

function resolveRenderDocument(markdown: string): ProseMirrorNode {
  const comparison = compareMarkdownEngines(markdown);
  if (comparison.gfm.document !== null && comparison.gfm.diagnostics.length === 0) {
    return comparison.gfm.document;
  }

  return parseMarkdown(markdown);
}

export function toggleTaskListItemInMarkdown(markdown: string, taskIndex: number): string | null {
  if (!Number.isInteger(taskIndex) || taskIndex < 0) {
    return null;
  }

  const walkState = { currentTaskIndex: 0, toggled: false };
  const doc = parseMarkdown(markdown);
  const nextDoc = rewriteTaskListNode(doc, taskIndex, walkState);

  if (!walkState.toggled) {
    return null;
  }

  return serializeMarkdown(nextDoc);
}

function rewriteTaskListNode(
  node: ProseMirrorNode,
  targetTaskIndex: number,
  walkState: { currentTaskIndex: number; toggled: boolean }
): ProseMirrorNode {
  const shouldToggle = node.type === schema.nodes.list_item && node.attrs.task === true;
  const nextAttrs =
    shouldToggle && walkState.currentTaskIndex === targetTaskIndex
      ? { ...node.attrs, checked: node.attrs.checked !== true }
      : node.attrs;

  if (shouldToggle) {
    walkState.toggled ||= walkState.currentTaskIndex === targetTaskIndex;
    walkState.currentTaskIndex += 1;
  }

  if (node.isText) {
    return node;
  }

  if (node.isLeaf) {
    return nextAttrs === node.attrs ? node : node.type.create(nextAttrs, null, node.marks);
  }

  const nextChildren: ProseMirrorNode[] = [];
  node.content.forEach((child) => {
    nextChildren.push(rewriteTaskListNode(child, targetTaskIndex, walkState));
  });

  const nextContent = Fragment.fromArray(nextChildren);
  if (nextAttrs === node.attrs && nextContent.eq(node.content)) {
    return node;
  }

  return node.type.create(nextAttrs, nextContent, node.marks);
}

// TRACE: DESIGN-mermaid-diagrams-001
export async function renderMermaidDiagrams(root: HTMLElement): Promise<void> {
  const targets = Array.from(
    root.querySelectorAll<HTMLElement>(".editor-mermaid[data-mermaid-diagram='true']")
  );
  if (targets.length === 0) return;

  try {
    const module = await import("mermaid");
    const mermaid = module.default;
    if (!mermaidInitialized) {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
      });
      mermaidInitialized = true;
    }

    for (const target of targets) {
      if (target.dataset.mermaidRendered === "true") continue;
      const source = target.querySelector(".editor-mermaid__source code")?.textContent ?? "";
      if (!source.trim()) continue;

      try {
        const id = `knot-mermaid-${Math.random().toString(36).slice(2)}`;
        const output = document.createElement("div");
        output.className = "editor-mermaid__diagram";
        const { svg, bindFunctions } = await mermaid.render(id, source, target);
        output.innerHTML = svg;
        target.replaceChildren(output);
        bindFunctions?.(output);
        target.dataset.mermaidRendered = "true";
        delete target.dataset.mermaidError;
      } catch {
        target.dataset.mermaidError = "true";
      }
    }
  } catch {
    for (const target of targets) {
      target.dataset.mermaidError = "true";
    }
  }
}
