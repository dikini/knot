import { describe, expect, it } from "vitest";
import { EditorState } from "prosemirror-state";
import { redo, undo } from "prosemirror-history";
import { EditorView } from "prosemirror-view";
import { serializeMarkdown } from "../markdown";
import { schema } from "../schema";
import { plugins } from ".";

function createTaskListDoc() {
  return schema.node("doc", null, [
    schema.node("bullet_list", null, [
      schema.node(
        "list_item",
        { task: true, checked: false },
        [schema.node("paragraph", null, [schema.text("Todo")])]
      ),
    ]),
  ]);
}

describe("task list plugin", () => {
  it("renders task list items in edit mode with checkbox UI", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    const view = new EditorView(host, {
      state: EditorState.create({
        schema,
        doc: createTaskListDoc(),
        plugins: plugins({
          hideInactiveSyntax: true,
          mediaEmbed: true,
          wikilinks: true,
          theme: "dark",
          fontSize: 16,
          lineHeight: 1.6,
        }),
      }),
    });

    const checkbox = host.querySelector<HTMLInputElement>(
      'input[type="checkbox"][data-task-checkbox="true"]'
    );

    expect(checkbox).not.toBeNull();
    expect(checkbox?.checked).toBe(false);

    view.destroy();
    host.remove();
  });

  it("toggles checked state through transactions and preserves undo/redo", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    const view = new EditorView(host, {
      state: EditorState.create({
        schema,
        doc: createTaskListDoc(),
        plugins: plugins({
          hideInactiveSyntax: true,
          mediaEmbed: true,
          wikilinks: true,
          theme: "dark",
          fontSize: 16,
          lineHeight: 1.6,
        }),
      }),
    });

    const checkbox = host.querySelector<HTMLInputElement>(
      'input[type="checkbox"][data-task-checkbox="true"]'
    );
    expect(checkbox).not.toBeNull();

    checkbox?.click();

    expect(view.state.doc.child(0)?.child(0)?.attrs.checked).toBe(true);
    expect(serializeMarkdown(view.state.doc)).toContain("- [x] Todo");

    const undid = undo(view.state, view.dispatch);
    expect(undid).toBe(true);
    expect(view.state.doc.child(0)?.child(0)?.attrs.checked).toBe(false);
    expect(serializeMarkdown(view.state.doc)).toContain("- [ ] Todo");

    const redid = redo(view.state, view.dispatch);
    expect(redid).toBe(true);
    expect(view.state.doc.child(0)?.child(0)?.attrs.checked).toBe(true);

    view.destroy();
    host.remove();
  });
});
