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
      
      apply(tr, decorationSet) {
        // Map existing decorations through the transaction
        decorationSet = decorationSet.map(tr.mapping, tr.doc);
        
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
      
      // Optional: Handle custom node views for more control
      nodeViews: {
        heading(node, view, getPos) {
          const dom = document.createElement("div");
          const contentDOM = document.createElement("span");
          
          dom.className = `heading-view heading-view--h${node.attrs.level}`;
          
          // Create the visual representation
          const updateView = () => {
            const pos = getPos();
            if (pos === undefined) return;
            
            const selection = view.state.selection;
            const isActive = selection.head >= pos && selection.head <= pos + node.nodeSize;
            
            dom.innerHTML = "";
            
            if (isActive) {
              // Active: show # prefix
              const prefix = document.createElement("span");
              prefix.className = "heading-prefix";
              prefix.textContent = "#".repeat(node.attrs.level) + " ";
              dom.appendChild(prefix);
              dom.appendChild(contentDOM);
              dom.classList.add("heading-view--active");
              dom.classList.remove("heading-view--inactive");
            } else {
              // Inactive: hide #, just style
              dom.appendChild(contentDOM);
              dom.classList.add("heading-view--inactive");
              dom.classList.remove("heading-view--active");
            }
          };
          
          // Initial update
          updateView();
          
          return {
            dom,
            contentDOM,
            update: (updatedNode) => {
              if (updatedNode.type.name !== "heading") return false;
              updateView();
              return true;
            },
          };
        },
      },
    },
  });
}
