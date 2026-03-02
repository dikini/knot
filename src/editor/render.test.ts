import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderMarkdownToHtml, renderMermaidDiagrams, toggleTaskListItemInMarkdown } from "./render";

const mermaidRenderMock = vi.fn();
const mermaidInitializeMock = vi.fn();

vi.mock("mermaid", () => ({
  default: {
    initialize: mermaidInitializeMock,
    render: mermaidRenderMock,
  },
}));

describe("renderMarkdownToHtml", () => {
  beforeEach(() => {
    mermaidInitializeMock.mockReset();
    mermaidRenderMock.mockReset();
  });

  it("renders markdown task lists as checkbox UI", () => {
    const html = renderMarkdownToHtml("- [x] Done\n- [ ] Todo");
    const container = document.createElement("div");
    container.innerHTML = html;

    const taskList = container.querySelector("ul.task-list");
    const checkboxes = container.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"][data-task-checkbox="true"]'
    );

    expect(taskList).not.toBeNull();
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0]?.checked).toBe(true);
    expect(checkboxes[0]?.disabled).toBe(false);
    expect(checkboxes[1]?.checked).toBe(false);
    expect(container.querySelector('li[data-task-index="0"]')).not.toBeNull();
    expect(container.querySelector('li[data-task-index="1"]')).not.toBeNull();
  });

  it("toggles the targeted task item back into markdown", () => {
    const markdown = "- [x] Done\n- [ ] Todo";

    expect(toggleTaskListItemInMarkdown(markdown, 1)).toBe("- [x] Done\n\n- [x] Todo");
    expect(toggleTaskListItemInMarkdown(markdown, 0)).toBe("- [ ] Done\n\n- [ ] Todo");
    expect(toggleTaskListItemInMarkdown(markdown, 2)).toBeNull();
  });

  it("renders inline math with KaTeX markup", () => {
    const html = renderMarkdownToHtml("Energy is $E=mc^2$ in prose.");
    const container = document.createElement("div");
    container.innerHTML = html;

    expect(container.querySelector(".katex")).not.toBeNull();
    expect(container.textContent).toContain("E=mc");
  });

  it("renders block math with KaTeX display markup", () => {
    const html = renderMarkdownToHtml("$$\nx^2 + y^2 = z^2\n$$");
    const container = document.createElement("div");
    container.innerHTML = html;

    expect(container.querySelector(".katex-display")).not.toBeNull();
    expect(container.textContent).toContain("x2+y2=z2");
  });

  it("renders Mermaid diagrams with the wrapper as explicit container", async () => {
    mermaidRenderMock.mockResolvedValue({
      svg: "<svg><g></g></svg>",
      bindFunctions: vi.fn(),
    });

    const root = document.createElement("div");
    root.innerHTML = renderMarkdownToHtml("```mermaid\nflowchart TD\n  A[Start] --> B[End]\n```");

    const target = root.querySelector<HTMLElement>(".editor-mermaid[data-mermaid-diagram='true']");
    expect(target).not.toBeNull();

    await renderMermaidDiagrams(root);

    expect(mermaidInitializeMock).toHaveBeenCalledWith({
      startOnLoad: false,
      securityLevel: "strict",
    });
    expect(mermaidRenderMock).toHaveBeenCalledTimes(1);
    expect(mermaidRenderMock.mock.calls[0]?.[1]).toContain("flowchart TD");
    expect(mermaidRenderMock.mock.calls[0]?.[2]).toBe(target);
    expect(root.querySelector(".editor-mermaid__diagram svg")).not.toBeNull();
    expect(target?.dataset.mermaidRendered).toBe("true");
  });
});
