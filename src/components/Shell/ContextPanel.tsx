import type { ReactNode } from "react";
import type { ShellToolMode } from "@lib/store";
import "./ContextPanel.css";

interface ContextPanelProps {
  mode: ShellToolMode;
  collapsed: boolean;
  width: number;
  onToggleCollapse: () => void;
  notesContent: ReactNode;
  searchContent: ReactNode;
  graphControlsContent: ReactNode;
  graphContextContent: ReactNode;
}

export function ContextPanel({
  mode,
  collapsed,
  width,
  onToggleCollapse,
  notesContent,
  searchContent,
  graphControlsContent,
  graphContextContent,
}: ContextPanelProps) {
  if (collapsed) {
    return (
      <aside className="context-panel context-panel--collapsed" aria-label="Context panel">
        <button
          type="button"
          className="context-panel__collapse"
          onClick={onToggleCollapse}
          aria-label="Expand context panel"
        >
          {"\u203a"}
        </button>
      </aside>
    );
  }

  return (
    <aside className="context-panel" style={{ width }} aria-label="Context panel">
      <header className="context-panel__header">
        <span className="context-panel__title">{mode}</span>
        <button
          type="button"
          className="context-panel__collapse"
          onClick={onToggleCollapse}
          aria-label="Collapse context panel"
        >
          {"\u2039"}
        </button>
      </header>

      <div className="context-panel__body">
        {mode === "notes" && notesContent}
        {mode === "search" && searchContent}
        {mode === "graph" && (
          <>
            <section className="context-panel__section context-panel__section--controls">
              {graphControlsContent}
            </section>
            <section className="context-panel__section context-panel__section--graph-context">
              {graphContextContent}
            </section>
          </>
        )}
      </div>
    </aside>
  );
}
