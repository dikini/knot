/**
 * Syntax Hide Plugin
 * 
 * Hides markdown syntax characters (like # for headings, ** for bold)
 * when the cursor is not on that line/node.
 * 
 * This creates the "distraction-free" editing experience where:
 * - Inactive headings appear as styled text (no # visible)
 * - Active headings show the # for editing
 */

import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

const syntaxHideKey = new PluginKey<DecorationSet>("syntaxHide");



/**
 * Create the syntax hide plugin
 * 
 * This plugin:
 * 1. Tracks cursor position
 * 2. Identifies which nodes contain the cursor
 * 3. Adds decorations to hide syntax on inactive nodes
 */
export function syntaxHidePlugin(): Plugin {
  return new Plugin<DecorationSet>({
    key: syntaxHideKey,
    
    state: {
      init() {
        return DecorationSet.empty;
      },
      
      apply(tr, _decorationSet) {
        // Get current selection
        const { selection } = tr;
        const decorations: Decoration[] = [];
        
        // Scan document for markdown syntax to hide
        tr.doc.descendants((node, pos) => {
          // Check if cursor is inside this node
          const nodeStart = pos;
          const nodeEnd = pos + node.nodeSize;
          const isActive = selection.head >= nodeStart && selection.head <= nodeEnd;
          
          // Handle headings: hide # characters
          if (node.type.name === "heading" && !isActive) {
            // Add decoration to hide the heading marker
            // In a real implementation, this would be more sophisticated
            // For now, we add a node decoration that CSS can target
            decorations.push(
              Decoration.node(nodeStart, nodeEnd, {
                class: "heading--rendered",
                "data-level": String(node.attrs.level),
              })
            );
          }
          
          // Handle code blocks: hide backticks
          if (node.type.name === "code_block" && !isActive) {
            decorations.push(
              Decoration.node(nodeStart, nodeEnd, {
                class: "code-block--rendered",
              })
            );
          }
        });
        
        return DecorationSet.create(tr.doc, decorations);
      },
    },
    
    props: {
      decorations(state) {
        return this.getState(state);
      },
    },
  });
}
