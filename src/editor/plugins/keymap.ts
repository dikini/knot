/**
 * Custom key bindings for the Knot editor
 * SPEC: COMP-EDITOR-MODES-001 FR-8
 * TRACE: DESIGN-editor-medium-like-interactions
 */

import { EditorState, Transaction } from "prosemirror-state";
import { canSplit } from "prosemirror-transform";
import { EditorView } from "prosemirror-view";
import { schema } from "../schema";

/**
 * Key handler function type
 */
type KeyHandler = (
  state: EditorState,
  dispatch?: (tr: Transaction) => void,
  view?: EditorView
) => boolean;

/**
 * Keymap definition
 */
export interface Keymap {
  [key: string]: KeyHandler;
}

/**
 * Custom key bindings
 * 
 * Extends base ProseMirror keymap with:
 * - Markdown-style shortcuts (Ctrl+B for bold, etc.)
 * - Navigation shortcuts
 * - Custom commands
 */
export const keyBindings: Keymap = {
  // Heading shortcut: typing "## " at paragraph start transforms to heading level 2, etc.
  "Space": (state, dispatch): boolean => {
    const { selection } = state;
    if (!selection.empty) return false;
    const { $from } = selection;
    if ($from.parent.type.name !== "paragraph") return false;

    const marker = $from.parent.textBetween(0, $from.parentOffset, "", "");
    const match = marker.match(/^(#{1,6})$/);
    if (!match) return false;

    const level = match[1].length;
    const heading = schema.nodes.heading;
    if (!heading || !dispatch) return false;

    const blockFrom = $from.before();
    const blockTo = $from.after();
    const textStart = $from.start();
    const textEnd = textStart + $from.parentOffset;

    let tr = state.tr;
    tr = tr.setBlockType(blockFrom, blockTo, heading, { level });
    tr = tr.delete(textStart, textEnd);
    dispatch(tr);
    return true;
  },

  // SPEC: COMP-AUTHORING-FLOWS-001 FR-5, FR-8
  "Enter": (state, dispatch): boolean => {
    const { selection } = state;
    if (!selection.empty) return false;

    const { $from } = selection;
    if ($from.parent.type.name !== "paragraph") return false;
    if ($from.depth < 2) return false;

    const listItem = $from.node(-1);
    const listNode = $from.node(-2);
    if (listItem.type !== schema.nodes.list_item) return false;
    if (listNode.type !== schema.nodes.bullet_list && listNode.type !== schema.nodes.ordered_list) return false;

    const nextListItemAttrs =
      listItem.attrs.task === true
        ? {
            ...listItem.attrs,
            checked: false,
          }
        : listItem.attrs;

    if (
      !canSplit(state.doc, selection.from, 2, [
        { type: schema.nodes.list_item, attrs: nextListItemAttrs },
        { type: schema.nodes.paragraph },
      ])
    ) {
      return false;
    }

    if (!dispatch) return true;

    const tr = state.tr.split(selection.from, 2, [
      { type: schema.nodes.list_item, attrs: nextListItemAttrs },
      { type: schema.nodes.paragraph },
    ]);
    dispatch(tr.scrollIntoView());
    return true;
  },

  // Markdown shortcuts
  "Mod-b": (_state, _dispatch): boolean => {
    return false;
  },

  "Mod-i": (_state, _dispatch): boolean => {
    return false;
  },

  "Mod-`": (_state, _dispatch): boolean => {
    return false;
  },

  "Mod-k": (_state, _dispatch): boolean => {
    return false;
  },

  // Headings
  "Mod-Alt-1": (_state, _dispatch): boolean => {
    return false;
  },

  "Mod-Alt-2": (_state, _dispatch): boolean => {
    return false;
  },

  "Mod-Alt-3": (_state, _dispatch): boolean => {
    return false;
  },

  // Lists
  "Mod-Shift-8": (_state, _dispatch): boolean => {
    return false;
  },

  "Mod-Shift-9": (_state, _dispatch): boolean => {
    return false;
  },

};
