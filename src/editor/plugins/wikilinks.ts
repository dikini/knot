/**
 * Wikilink Plugin
 * 
 * Handles [[Note Name]] syntax for internal linking.
 * Provides click-to-navigate and autocomplete functionality.
 */

import { Plugin, PluginKey } from "prosemirror-state";
import { Node as ProseMirrorNode } from "prosemirror-model";
import { Decoration, DecorationSet } from "prosemirror-view";

const wikilinkKey = new PluginKey<DecorationSet>("wikilinks");

interface WikilinkMatch {
  text: string;
  from: number;
  to: number;
}

/**
 * Find all wikilink patterns in the document
 */
function findWikilinks(doc: ProseMirrorNode): WikilinkMatch[] {
  const links: WikilinkMatch[] = [];
  
  doc.descendants((node: ProseMirrorNode, pos: number) => {
    if (!node.isText) return;
    
    const text = node.text ?? "";
    const regex = /\[\[([^\]]+)\]\]/g;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      links.push({
        text: match[1],
        from: pos + match.index,
        to: pos + match.index + match[0].length,
      });
    }
  });
  
  return links;
}

/**
 * Create wikilink plugin
 * 
 * Features:
 * - Highlights [[Note Name]] syntax
 * - Makes wikilinks clickable
 * - Provides decorations for styling
 */
export function wikilinkPlugin(): Plugin {
  return new Plugin<DecorationSet>({
    key: wikilinkKey,
    
    state: {
      init() {
        return DecorationSet.empty;
      },
      
      apply(tr, _decorationSet) {
        // Find wikilinks and add decorations
        const links = findWikilinks(tr.doc);
        const decorations = links.map((link) =>
          Decoration.inline(link.from, link.to, {
            class: "wikilink",
            "data-target": link.text,
          })
        );
        
        return DecorationSet.create(tr.doc, decorations);
      },
    },
    
    props: {
      decorations(state) {
        return this.getState(state);
      },
      
      handleClickOn(_view, _pos, _node, _nodePos, event, _direct) {
        // Check if clicked on a wikilink
        const target = (event.target as HTMLElement).closest(".wikilink");
        if (target) {
          const noteName = target.getAttribute("data-target");
          if (noteName) {
            // Emit event for Tauri to handle navigation
            window.dispatchEvent(
              new CustomEvent("wikilink-click", {
                detail: { target: noteName },
              })
            );
            return true;
          }
        }
        return false;
      },
    },
  });
}
