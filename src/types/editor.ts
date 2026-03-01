/**
 * ProseMirror and editor-specific types
 */

import type { EditorState } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

export interface EditorConfig {
  /** Show/hide markdown syntax based on cursor position */
  hideInactiveSyntax: boolean;
  /** Enable image/video embedding */
  mediaEmbed: boolean;
  /** Enable wikilinks [[Note Name]] */
  wikilinks: boolean;
  /** Theme: 'light' | 'dark' */
  theme: "light" | "dark";
  /** Font size in pixels */
  fontSize: number;
  /** Line height multiplier */
  lineHeight: number;
}

export interface EditorStateSnapshot {
  markdown: string;
  cursorPosition: number;
  selection?: { from: number; to: number };
}

export interface EditorSelectionSnapshot {
  from: number;
  to: number;
  empty: boolean;
}

export type EditorChangeHandler = (state: EditorStateSnapshot) => void;
export type EditorSelectionHandler = (selection: EditorSelectionSnapshot) => void;

export interface ProseMirrorEditor {
  view: EditorView;
  state: EditorState;
  destroy: () => void;
  focus: () => void;
  getMarkdown: () => string;
  setMarkdown: (markdown: string) => void;
}

// Node types for our markdown schema
export type NodeType =
  | "doc"
  | "paragraph"
  | "heading"
  | "math_display"
  | "code_block"
  | "blockquote"
  | "bullet_list"
  | "ordered_list"
  | "list_item"
  | "horizontal_rule"
  | "hard_break"
  | "math_inline"
  | "image";

export type MarkType =
  | "strong"
  | "em"
  | "code"
  | "link"
  | "strike"
  | "wikilink";
