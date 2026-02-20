import { describe, it, expect } from "vitest";
import { EditorState, TextSelection } from "prosemirror-state";
import { schema } from "../schema";
import { keyBindings } from "./keymap";

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
});
