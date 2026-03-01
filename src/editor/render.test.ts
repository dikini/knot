import { describe, expect, it } from "vitest";
import { renderMarkdownToHtml } from "./render";

describe("renderMarkdownToHtml", () => {
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
    expect(checkboxes[0]?.disabled).toBe(true);
    expect(checkboxes[1]?.checked).toBe(false);
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
});
