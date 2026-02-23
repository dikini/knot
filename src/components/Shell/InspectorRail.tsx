import type { ReactNode } from "react";
import "./InspectorRail.css";

interface InspectorRailProps {
  isOpen: boolean;
  mode: "details" | "settings";
  title?: string;
  onClose: () => void;
  children?: ReactNode;
}

export function InspectorRail({
  isOpen,
  title,
  onClose,
  children,
}: InspectorRailProps) {
  if (!isOpen) return null;

  return (
    <aside className="inspector-rail" aria-label="Inspector rail">
      <header className="inspector-rail__header">
        <h2>{title ?? "Inspector"}</h2>
        <button type="button" onClick={onClose} aria-label="Close inspector rail">
          ×
        </button>
      </header>
      <div className="inspector-rail__body">{children ?? <p>No details</p>}</div>
    </aside>
  );
}
