import { DOMSerializer } from "prosemirror-model";
import katex from "katex";
import { parseMarkdown } from "./markdown";
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
  for (const item of taskItems) {
    item.parentElement?.classList.add("task-list");

    if (item.querySelector("[data-task-checkbox='true']")) {
      continue;
    }

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.disabled = true;
    checkbox.className = "task-list-item__checkbox";
    checkbox.checked = item.dataset.checked === "true";
    if (checkbox.checked) {
      checkbox.setAttribute("checked", "");
    }
    checkbox.setAttribute("data-task-checkbox", "true");
    checkbox.setAttribute("aria-label", checkbox.checked ? "Completed task" : "Incomplete task");

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
  const doc = parseMarkdown(markdown);
  const serializer = DOMSerializer.fromSchema(schema);
  const fragment = serializer.serializeFragment(doc.content);
  const container = document.createElement("div");
  container.appendChild(fragment);
  rewriteTaskListBlocks(container);
  rewriteMathNodes(container);
  rewriteMermaidBlocks(container);
  return container.innerHTML;
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
        const { svg } = await mermaid.render(id, source);
        const output = document.createElement("div");
        output.className = "editor-mermaid__diagram";
        output.innerHTML = svg;
        target.replaceChildren(output);
        target.dataset.mermaidRendered = "true";
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
