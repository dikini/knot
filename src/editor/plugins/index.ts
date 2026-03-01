/**
 * ProseMirror plugins for the Knot editor
 */

import { keymap } from "prosemirror-keymap";
import { history } from "prosemirror-history";
import { mathBackspaceCmd, mathPlugin, makeBlockMathInputRule, makeInlineMathInputRule, REGEX_BLOCK_MATH_DOLLARS, REGEX_INLINE_MATH_DOLLARS } from "@benrbray/prosemirror-math";
import { baseKeymap, chainCommands, deleteSelection, joinBackward, selectNodeBackward } from "prosemirror-commands";
import { inputRules } from "prosemirror-inputrules";
import { Plugin } from "prosemirror-state";
import type { EditorConfig } from "../../types/editor";
import { schema } from "../schema";
import { syntaxHidePlugin } from "./syntax-hide";
import { taskListPlugin } from "./task-list";
import { wikilinkPlugin } from "./wikilinks";
import { keyBindings } from "./keymap";

/**
 * Create all editor plugins based on configuration
 */
export function plugins(config: EditorConfig): Plugin[] {
  const mathInline = schema.nodes.math_inline;
  const mathDisplay = schema.nodes.math_display;
  const mathRuleSet =
    mathInline && mathDisplay
      ? inputRules({
          rules: [
            makeInlineMathInputRule(REGEX_INLINE_MATH_DOLLARS, mathInline),
            makeBlockMathInputRule(REGEX_BLOCK_MATH_DOLLARS, mathDisplay),
          ],
        })
      : null;

  const pluginList: Plugin[] = [
    // Core functionality
    history(),
    mathPlugin,
    keymap({
      Backspace: chainCommands(deleteSelection, mathBackspaceCmd, joinBackward, selectNodeBackward),
    }),
    keymap(keyBindings),
    ...(mathRuleSet ? [mathRuleSet] : []),
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
