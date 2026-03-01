/**
 * ProseMirror plugins for the Knot editor
 */

import { keymap } from "prosemirror-keymap";
import { history } from "prosemirror-history";
import { baseKeymap } from "prosemirror-commands";
import { Plugin } from "prosemirror-state";
import type { EditorConfig } from "../../types/editor";
import { syntaxHidePlugin } from "./syntax-hide";
import { taskListPlugin } from "./task-list";
import { wikilinkPlugin } from "./wikilinks";
import { keyBindings } from "./keymap";

/**
 * Create all editor plugins based on configuration
 */
export function plugins(config: EditorConfig): Plugin[] {
  const pluginList: Plugin[] = [
    // Core functionality
    history(),
    keymap(keyBindings),
    keymap(baseKeymap),
    
    // Feature plugins
    taskListPlugin(),
    wikilinkPlugin(),
  ];

  // Optional: Syntax hiding (hide # on inactive lines)
  if (config.hideInactiveSyntax) {
    pluginList.push(syntaxHidePlugin());
  }

  return pluginList;
}

export * from "./syntax-hide";
export * from "./task-list";
export * from "./wikilinks";
export * from "./keymap";
