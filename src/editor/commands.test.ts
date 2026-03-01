import { describe, expect, it } from "vitest";
import { EditorState, TextSelection, type Transaction } from "prosemirror-state";
import { history, redo, undo } from "prosemirror-history";
import { schema } from "./schema";
import { clearBlockFormatting } from "./commands";

describe("Editor commands", () => {
  it("clears heading formatting back to a paragraph with undo/redo support", () => {
    let state = EditorState.create({
      schema,
      plugins: [history()],
      doc: schema.node("doc", null, [
        schema.node("heading", { level: 2 }, [schema.text("Section title")]),
      ]),
    });

    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 7)));

    const handled = clearBlockFormatting(state, (tr: Transaction) => {
      state = state.apply(tr);
    });

    expect(handled).toBe(true);
    expect(state.doc.child(0).type.name).toBe("paragraph");
    expect(state.doc.child(0).textContent).toBe("Section title");

    const undid = undo(state, (tr) => {
      state = state.apply(tr);
    });
    expect(undid).toBe(true);
    expect(state.doc.child(0).type.name).toBe("heading");

    const redid = redo(state, (tr) => {
      state = state.apply(tr);
    });
    expect(redid).toBe(true);
    expect(state.doc.child(0).type.name).toBe("paragraph");
  });
});
