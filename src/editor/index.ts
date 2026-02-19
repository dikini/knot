import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { schema } from "./schema";
import { plugins } from "./plugins";
import { parseMarkdown, serializeMarkdown } from "./markdown";
import type { EditorConfig, ProseMirrorEditor, EditorChangeHandler } from "../types/editor";

interface InitOptions {
  onChange?: EditorChangeHandler;
  initialContent?: string;
  config?: Partial<EditorConfig>;
}

const defaultConfig: EditorConfig = {
  hideInactiveSyntax: true,
  mediaEmbed: true,
  wikilinks: true,
  theme: "dark",
  fontSize: 16,
  lineHeight: 1.6,
};

/**
 * Initialize a ProseMirror editor instance.
 */
export function initProseMirrorEditor(
  element: HTMLElement,
  options: InitOptions = {}
): ProseMirrorEditor {
  const { onChange, initialContent = "", config = {} } = options;
  const finalConfig = { ...defaultConfig, ...config };

  // Parse initial markdown content
  const doc = initialContent 
    ? parseMarkdown(initialContent)
    : schema.node("doc", null, [schema.node("paragraph", null, [schema.text("Start writing...")])]);

  const state = EditorState.create({
    doc,
    schema,
    plugins: plugins(finalConfig),
  });

  const view = new EditorView(element, {
    state,
    dispatchTransaction(transaction) {
      const newState = view.state.apply(transaction);
      view.updateState(newState);

      if (transaction.docChanged && onChange) {
        const markdown = serializeMarkdown(newState.doc);
        onChange({
          markdown,
          cursorPosition: newState.selection.head,
        });
      }
    },
  });

  return {
    view,
    state,
    destroy() {
      view.destroy();
    },
    focus() {
      view.focus();
    },
    getMarkdown() {
      return serializeMarkdown(view.state.doc);
    },
    setMarkdown(markdown: string) {
      const newDoc = parseMarkdown(markdown);
      const newState = EditorState.create({
        doc: newDoc,
        schema,
        plugins: plugins(finalConfig),
      });
      view.updateState(newState);
    },
  };
}

// Export everything
export * from "./schema";
export * from "./plugins";
export * from "./markdown";
