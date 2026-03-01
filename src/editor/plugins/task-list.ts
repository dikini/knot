import type { Node as ProseMirrorNode } from "prosemirror-model";
import { Plugin } from "prosemirror-state";
import type { EditorView, NodeView } from "prosemirror-view";
import { schema } from "../schema";

/**
 * TASK: TL-002B
 * SPEC: COMP-TASK-LIST-UI-003 TL-002, TL-003
 */
class TaskListItemView implements NodeView {
  dom: HTMLLIElement;

  contentDOM: HTMLDivElement;

  private checkbox: HTMLInputElement | null;

  private readonly getPos: (() => number | undefined) | boolean;

  private readonly view: EditorView;

  constructor(node: ProseMirrorNode, view: EditorView, getPos: (() => number | undefined) | boolean) {
    this.view = view;
    this.getPos = getPos;
    this.dom = document.createElement("li");
    this.contentDOM = document.createElement("div");
    this.contentDOM.className = "task-list-item__content";
    this.checkbox = null;

    this.dom.appendChild(this.contentDOM);
    this.render(node);
  }

  update(node: ProseMirrorNode): boolean {
    if (node.type !== schema.nodes.list_item) {
      return false;
    }

    this.render(node);
    return true;
  }

  private render(node: ProseMirrorNode): void {
    this.dom.className = node.attrs.task === true ? "task-list-item" : "";
    this.dom.dataset.task = node.attrs.task === true ? "true" : "false";
    this.dom.dataset.checked = node.attrs.checked === true ? "true" : "false";

    if (node.attrs.task !== true) {
      this.checkbox?.remove();
      this.checkbox = null;
      return;
    }

    if (!this.checkbox) {
      this.checkbox = document.createElement("input");
      this.checkbox.type = "checkbox";
      this.checkbox.className = "task-list-item__checkbox";
      this.checkbox.setAttribute("data-task-checkbox", "true");
      this.checkbox.addEventListener("mousedown", (event) => {
        event.preventDefault();
      });
      this.checkbox.addEventListener("click", (event) => {
        event.preventDefault();
        this.toggleChecked();
      });
      this.dom.insertBefore(this.checkbox, this.contentDOM);
    }

    this.checkbox.checked = node.attrs.checked === true;
  }

  private toggleChecked(): void {
    if (typeof this.getPos !== "function") {
      return;
    }

    const position = this.getPos();
    if (typeof position !== "number") {
      return;
    }

    const node = this.view.state.doc.nodeAt(position);
    if (!node || node.type !== schema.nodes.list_item || node.attrs.task !== true) {
      return;
    }

    const transaction = this.view.state.tr.setNodeMarkup(position, undefined, {
      ...node.attrs,
      checked: node.attrs.checked !== true,
    });
    this.view.dispatch(transaction);
    this.view.focus();
  }
}

export function taskListPlugin(): Plugin {
  return new Plugin({
    props: {
      nodeViews: {
        list_item(node, view, getPos) {
          return new TaskListItemView(node, view, getPos);
        },
      },
    },
  });
}
