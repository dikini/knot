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
  target: string;
  from: number;
  to: number;
}

declare global {
  interface Window {
    __KNOT_WIKILINK_TARGETS__?: string[];
  }
}

function normalizeTarget(target: string): string {
  return target.trim().toLowerCase();
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
      const raw = match[1].trim();
      const [target] = raw.includes("|") ? raw.split("|", 2) : [raw];
      links.push({
        text: raw,
        target: target.trim(),
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
        const knownTargets = new Set((window.__KNOT_WIKILINK_TARGETS__ ?? []).map(normalizeTarget));
        const decorations = links.map((link) =>
          Decoration.inline(link.from, link.to, {
            class: knownTargets.has(normalizeTarget(link.target))
              ? "wikilink"
              : "wikilink wikilink--missing",
            "data-target": link.target,
            "data-missing": knownTargets.has(normalizeTarget(link.target)) ? "false" : "true",
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
            const missing = target.getAttribute("data-missing") === "true";
            // Emit event for Tauri to handle navigation
            window.dispatchEvent(
              new CustomEvent("wikilink-click", {
                detail: { target: noteName, missing },
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
