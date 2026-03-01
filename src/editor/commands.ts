import { insertMathCmd } from "@benrbray/prosemirror-math";
import { setBlockType } from "prosemirror-commands";
import { redo, redoDepth, undo, undoDepth } from "prosemirror-history";
import { Selection, TextSelection, type Command, type EditorState } from "prosemirror-state";
import { schema } from "./schema";

// SPEC: COMP-AUTHORING-FLOWS-001 FR-7, FR-8
export const clearBlockFormatting: Command = (state, dispatch, view) => {
  const paragraph = schema.nodes.paragraph;
  return setBlockType(paragraph)(state, dispatch, view);
};

// SPEC: COMP-EDITOR-HISTORY-005 EH-001
export const undoHistory: Command = (state, dispatch, view) => {
  return undo(state, dispatch, view);
};

// SPEC: COMP-EDITOR-HISTORY-005 EH-001
export const redoHistory: Command = (state, dispatch, view) => {
  return redo(state, dispatch, view);
};

// SPEC: COMP-MATH-PLUGIN-008 MP-002, MP-003
export const insertInlineMath: Command = (state, dispatch) => {
  const mathInline = schema.nodes.math_inline;
  if (!mathInline) {
    return false;
  }

  const initialText = state.selection.empty
    ? ""
    : state.doc.textBetween(state.selection.from, state.selection.to, "\n", "\n");
  return insertMathCmd(mathInline, initialText)(state, dispatch);
};

// SPEC: COMP-MATH-PLUGIN-008 MP-002, MP-003
export const insertDisplayMath: Command = (state, dispatch) => {
  const mathDisplay = schema.nodes.math_display;
  if (!mathDisplay) {
    return false;
  }

  const selectionWithResolved = state.selection as typeof state.selection & {
    $from?: { depth: number; parent?: { isTextblock?: boolean }; after: (depth: number) => number };
  };
  let insertPos = state.selection.to;
  if (selectionWithResolved.$from?.parent?.isTextblock) {
    insertPos = selectionWithResolved.$from.after(selectionWithResolved.$from.depth);
  }

  const selectedText = state.selection.empty
    ? ""
    : state.doc.textBetween(state.selection.from, state.selection.to, "\n", "\n");
  const mathNode = mathDisplay.create(
    null,
    selectedText.length > 0 ? schema.text(selectedText) : undefined
  );

  if (!dispatch) {
    return true;
  }

  let tr = state.tr.insert(insertPos, mathNode);
  const nearPos = Math.min(insertPos + 1, tr.doc.content.size);
  const resolved = tr.doc.resolve(nearPos);
  tr = tr.setSelection(Selection.near(resolved, 1));

  const selectionFrom =
    tr.selection && typeof tr.selection.from === "number" ? tr.selection.from : nearPos;
  if (!(tr.selection instanceof TextSelection)) {
    tr = tr.setSelection(TextSelection.create(tr.doc, selectionFrom));
  }

  dispatch(tr.scrollIntoView());
  return true;
};

// SPEC: COMP-EDITOR-HISTORY-005 EH-003
export function canUndoHistory(state: EditorState): boolean {
  return undoDepth(state) > 0;
}

// SPEC: COMP-EDITOR-HISTORY-005 EH-003
export function canRedoHistory(state: EditorState): boolean {
  return redoDepth(state) > 0;
}
