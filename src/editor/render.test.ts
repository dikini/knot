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

    expect(toggleTaskListItemInMarkdown(markdown, 1)).toBe("- [x] Done\n- [x] Todo");
    expect(toggleTaskListItemInMarkdown(markdown, 0)).toBe("- [ ] Done\n- [ ] Todo");
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

  it("renders GFM tables through the shared document model", () => {
    const html = renderMarkdownToHtml([
      "| Feature | Status |",
      "| --- | --- |",
      "| Tables | Ready |",
    ].join("\n"));
    const container = document.createElement("div");
    container.innerHTML = html;

    const table = container.querySelector("table");
    const rows = container.querySelectorAll("tr");

    expect(table).not.toBeNull();
    expect(rows).toHaveLength(2);
    expect(rows[0]?.querySelectorAll("th")).toHaveLength(2);
    expect(rows[1]?.querySelectorAll("td")).toHaveLength(2);
    expect(table?.textContent).toContain("Feature");
    expect(table?.textContent).toContain("Ready");
  });

  it("renders GFM footnote references and definitions through the shared document model", () => {
    const html = renderMarkdownToHtml([
      "Reference[^1]",
      "",
      "[^1]: Footnote body",
    ].join("\n"));
    const container = document.createElement("div");
    container.innerHTML = html;

    const reference = container.querySelector("sup[data-footnote-reference='true']");
    const definition = container.querySelector("section[data-footnote-definition='true']");

    expect(reference).not.toBeNull();
    expect(reference?.textContent).toBe("1");
    expect(definition).not.toBeNull();
    expect(definition?.textContent).toContain("Footnote body");
  });

  it("renders nested formatting inside table cells and footnote definitions", () => {
    const html = renderMarkdownToHtml([
      "| Feature | Details |",
      "| --- | --- |",
      "| Tables | **Bold** and [docs](https://example.com)[^1] |",
      "",
      "[^1]: Footnote with **strong** text and [more](https://example.com/more).",
    ].join("\n"));
    const container = document.createElement("div");
    container.innerHTML = html;

    const tableStrong = container.querySelector("table strong");
    const tableLink = container.querySelector("table a[href='https://example.com']");
    const footnoteStrong = container.querySelector("section[data-footnote-definition='true'] strong");
    const footnoteLink = container.querySelector(
      "section[data-footnote-definition='true'] a[href='https://example.com/more']"
    );

    expect(tableStrong?.textContent).toBe("Bold");
    expect(tableLink?.textContent).toBe("docs");
    expect(footnoteStrong?.textContent).toBe("strong");
    expect(footnoteLink?.textContent).toBe("more");
  });

  it("renders multiline footnotes with nested lists and mixed table-cell formatting", () => {
    const html = renderMarkdownToHtml([
      "| Feature | Details |",
      "| --- | --- |",
      "| Tables | **Bold** *italic* ~~strike~~ `code` [docs](https://example.com)[^1] |",
      "",
      "[^1]: First paragraph",
      "",
      "    - Child 1",
      "    - Child 2",
    ].join("\n"));
    const container = document.createElement("div");
    container.innerHTML = html;

    const tableEm = container.querySelector("table em");
    const tableStrike = container.querySelector("table s");
    const tableCode = container.querySelector("table code");
    const footnoteListItems = container.querySelectorAll(
      "section[data-footnote-definition='true'] li"
    );

    expect(tableEm?.textContent).toBe("italic");
    expect(tableStrike?.textContent).toBe("strike");
    expect(tableCode?.textContent).toBe("code");
    expect(footnoteListItems).toHaveLength(2);
  });

  it("renders raw HTML as literal text instead of live DOM", () => {
    const html = renderMarkdownToHtml("<span>unsafe</span>");
    const container = document.createElement("div");
    container.innerHTML = html;

    expect(container.querySelector("span")).toBeNull();
    expect(container.textContent).toBe("<span>unsafe</span>");
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
