/**
 * Custom key bindings for the Knot editor
 */

import { EditorState, Transaction } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

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
  // Markdown shortcuts
   
  "Mod-b": (_state, _dispatch): boolean => {
    // Toggle bold - TODO: implement
    console.log("Toggle bold");
    return true;
  },
  
   
  "Mod-i": (_state, _dispatch): boolean => {
    // Toggle italic - TODO: implement
    console.log("Toggle italic");
    return true;
  },
  
   
  "Mod-`": (_state, _dispatch): boolean => {
    // Toggle inline code - TODO: implement
    console.log("Toggle code");
    return true;
  },
  
   
  "Mod-k": (_state, _dispatch): boolean => {
    // Insert/edit link - TODO: implement
    console.log("Insert link");
    return true;
  },
  
  // Headings
   
  "Mod-Alt-1": (_state, _dispatch): boolean => {
    // Toggle heading level 1 - TODO: implement
    console.log("Toggle H1");
    return true;
  },
  
   
  "Mod-Alt-2": (_state, _dispatch): boolean => {
    // Toggle heading level 2 - TODO: implement
    console.log("Toggle H2");
    return true;
  },
  
   
  "Mod-Alt-3": (_state, _dispatch): boolean => {
    // Toggle heading level 3 - TODO: implement
    console.log("Toggle H3");
    return true;
  },
  
  // Lists
   
  "Mod-Shift-8": (_state, _dispatch): boolean => {
    // Toggle bullet list - TODO: implement
    console.log("Toggle bullet list");
    return true;
  },
  
   
  "Mod-Shift-9": (_state, _dispatch): boolean => {
    // Toggle ordered list - TODO: implement
    console.log("Toggle ordered list");
    return true;
  },
  
  // Save
  "Mod-s": (): boolean => {
    window.dispatchEvent(new CustomEvent("editor-save"));
    return true;
  },
};
