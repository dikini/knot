import { setBlockType } from "prosemirror-commands";
import { redo, redoDepth, undo, undoDepth } from "prosemirror-history";
import type { Command, EditorState } from "prosemirror-state";
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

// SPEC: COMP-EDITOR-HISTORY-005 EH-003
export function canUndoHistory(state: EditorState): boolean {
  return undoDepth(state) > 0;
}

// SPEC: COMP-EDITOR-HISTORY-005 EH-003
export function canRedoHistory(state: EditorState): boolean {
  return redoDepth(state) > 0;
}
