import { describe, it, expect } from "vitest";
import { EditorState, TextSelection } from "prosemirror-state";
import { history, redo, undo } from "prosemirror-history";
import { schema } from "../schema";
import { keyBindings } from "./keymap";

function endOfFirstParagraph(state: EditorState): number {
  let resolvedPos = 1;

  state.doc.descendants((node, pos) => {
    if (node.type.name !== "paragraph") {
      return true;
    }

    resolvedPos = pos + node.nodeSize - 1;
    return false;
  });

  return resolvedPos;
}

describe("Editor key bindings", () => {
  it("converts heading markers on Space into heading node", () => {
    let state = EditorState.create({
      schema,
      doc: schema.node("doc", null, [schema.node("paragraph", null, [schema.text("##")])]),
    });

    const endPos = state.doc.resolve(3);
    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, endPos.pos)));

    const handled = keyBindings.Space(state, (tr) => {
      state = state.apply(tr);
    });

    expect(handled).toBe(true);
    expect(state.doc.childCount).toBe(1);
    expect(state.doc.child(0).type.name).toBe("heading");
    expect(state.doc.child(0).attrs.level).toBe(2);
    expect(state.doc.child(0).textContent).toBe("");
  });

  it("does not intercept Space when marker pattern is not heading-only", () => {
    const state = EditorState.create({
      schema,
      doc: schema.node("doc", null, [schema.node("paragraph", null, [schema.text("# title")])]),
    });
    const handled = keyBindings.Space(state, () => undefined);
    expect(handled).toBe(false);
  });

  it("continues bullet lists on Enter", () => {
    let state = EditorState.create({
      schema,
      doc: schema.node("doc", null, [
        schema.node("bullet_list", null, [
          schema.node("list_item", null, [schema.node("paragraph", null, [schema.text("Item 1")])]),
        ]),
      ]),
    });

    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, endOfFirstParagraph(state))));

    const handled = keyBindings.Enter(state, (tr) => {
      state = state.apply(tr);
    });

    expect(handled).toBe(true);
    expect(state.doc.child(0).childCount).toBe(2);
    expect(state.doc.child(0).child(1).textContent).toBe("");
  });

  it("continues ordered lists on Enter and supports undo/redo", () => {
    let state = EditorState.create({
      schema,
      plugins: [history()],
      doc: schema.node("doc", null, [
        schema.node("ordered_list", { order: 1 }, [
          schema.node("list_item", null, [schema.node("paragraph", null, [schema.text("First")])]),
        ]),
      ]),
    });

    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, endOfFirstParagraph(state))));

    const handled = keyBindings.Enter(state, (tr) => {
      state = state.apply(tr);
    });

    expect(handled).toBe(true);
    expect(state.doc.child(0).childCount).toBe(2);

    const undid = undo(state, (tr) => {
      state = state.apply(tr);
    });
    expect(undid).toBe(true);
    expect(state.doc.child(0).childCount).toBe(1);

    const redid = redo(state, (tr) => {
      state = state.apply(tr);
    });
    expect(redid).toBe(true);
    expect(state.doc.child(0).childCount).toBe(2);
  });
});
