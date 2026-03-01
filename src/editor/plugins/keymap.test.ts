import { describe, it, expect } from "vitest";
import { EditorState, TextSelection } from "prosemirror-state";
import { history, redo, undo } from "prosemirror-history";
import { EditorView } from "prosemirror-view";
import { schema } from "../schema";
import { keyBindings } from "./keymap";
import { plugins } from ".";

const editorPluginConfig = {
  hideInactiveSyntax: true,
  mediaEmbed: true,
  wikilinks: true,
  theme: "dark" as const,
  fontSize: 16,
  lineHeight: 1.6,
};

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

function dispatchEnterThroughPlugins(state: EditorState): {
  handled: boolean;
  nextState: EditorState;
} {
  const host = document.createElement("div");
  document.body.appendChild(host);

  const view = new EditorView(host, {
    state,
  });

  const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true });
  const handled = Boolean(
    view.someProp("handleKeyDown", (handler) => handler(view, event))
  );
  const nextState = view.state;

  view.destroy();
  host.remove();

  return { handled, nextState };
}

function withSelectionAtFirstParagraphEnd(state: EditorState): EditorState {
  return state.apply(
    state.tr.setSelection(TextSelection.create(state.doc, endOfFirstParagraph(state)))
  );
}

describe("Editor key bindings", () => {
  it("routes Mod-z through shared undo history behavior", () => {
    let state = EditorState.create({
      schema,
      plugins: [history()],
      doc: schema.node("doc", null, [schema.node("paragraph", null, [schema.text("Alpha")])]),
    });

    state = state.apply(state.tr.insertText(" beta", 6));

    const handled = keyBindings["Mod-z"]?.(state, (tr) => {
      state = state.apply(tr);
    });

    expect(handled).toBe(true);
    expect(state.doc.textContent).toBe("Alpha");
  });

  it("routes Mod-y and Mod-Shift-z through shared redo history behavior", () => {
    let state = EditorState.create({
      schema,
      plugins: [history()],
      doc: schema.node("doc", null, [schema.node("paragraph", null, [schema.text("Alpha")])]),
    });

    state = state.apply(state.tr.insertText(" beta", 6));

    const undid = undo(state, (tr) => {
      state = state.apply(tr);
    });

    expect(undid).toBe(true);
    expect(state.doc.textContent).toBe("Alpha");

    const handledModY = keyBindings["Mod-y"]?.(state, (tr) => {
      state = state.apply(tr);
    });

    expect(handledModY).toBe(true);
    expect(state.doc.textContent).toBe("Alpha beta");

    const undidAgain = undo(state, (tr) => {
      state = state.apply(tr);
    });

    expect(undidAgain).toBe(true);
    expect(state.doc.textContent).toBe("Alpha");

    const handledShiftModZ = keyBindings["Mod-Shift-z"]?.(state, (tr) => {
      state = state.apply(tr);
    });

    expect(handledShiftModZ).toBe(true);
    expect(state.doc.textContent).toBe("Alpha beta");
  });

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

    state = withSelectionAtFirstParagraphEnd(state);

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

    state = withSelectionAtFirstParagraphEnd(state);

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

  it("continues bullet lists when Enter is dispatched through the plugin stack", () => {
    const selectedState = withSelectionAtFirstParagraphEnd(EditorState.create({
      schema,
      doc: schema.node("doc", null, [
        schema.node("bullet_list", null, [
          schema.node("list_item", null, [schema.node("paragraph", null, [schema.text("Item 1")])]),
        ]),
      ]),
      plugins: plugins(editorPluginConfig),
    }));

    const { handled, nextState } = dispatchEnterThroughPlugins(selectedState);

    expect(handled).toBe(true);
    expect(nextState.doc.child(0).childCount).toBe(2);
  });

  it("continues ordered lists when Enter is dispatched through the plugin stack", () => {
    const selectedState = withSelectionAtFirstParagraphEnd(EditorState.create({
      schema,
      doc: schema.node("doc", null, [
        schema.node("ordered_list", { order: 3 }, [
          schema.node("list_item", null, [schema.node("paragraph", null, [schema.text("Third")])]),
        ]),
      ]),
      plugins: plugins(editorPluginConfig),
    }));

    const { handled, nextState } = dispatchEnterThroughPlugins(selectedState);

    expect(handled).toBe(true);
    expect(nextState.doc.child(0).type.name).toBe("ordered_list");
    expect(nextState.doc.child(0).childCount).toBe(2);
  });

  it("continues task lists when Enter is dispatched through the plugin stack", () => {
    const selectedState = withSelectionAtFirstParagraphEnd(EditorState.create({
      schema,
      doc: schema.node("doc", null, [
        schema.node("bullet_list", null, [
          schema.node(
            "list_item",
            { task: true, checked: true },
            [schema.node("paragraph", null, [schema.text("Done")])]
          ),
        ]),
      ]),
      plugins: plugins(editorPluginConfig),
    }));

    const { handled, nextState } = dispatchEnterThroughPlugins(selectedState);

    expect(handled).toBe(true);
    expect(nextState.doc.child(0).childCount).toBe(2);
    expect(nextState.doc.child(0).child(1)?.attrs.task).toBe(true);
    expect(nextState.doc.child(0).child(1)?.attrs.checked).toBe(false);
  });
});
