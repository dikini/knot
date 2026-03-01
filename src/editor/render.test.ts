import { describe, expect, it } from "vitest";
import { renderMarkdownToHtml } from "./render";

describe("renderMarkdownToHtml", () => {
  it("renders markdown task lists as checkbox UI", () => {
    const html = renderMarkdownToHtml("- [x] Done\n- [ ] Todo");
    const container = document.createElement("div");
    container.innerHTML = html;

    const checkboxes = container.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"][data-task-checkbox="true"]'
    );

    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0]?.checked).toBe(true);
    expect(checkboxes[0]?.disabled).toBe(true);
    expect(checkboxes[1]?.checked).toBe(false);
  });
});
