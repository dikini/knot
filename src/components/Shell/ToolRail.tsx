import type { ShellToolMode } from "@lib/store";
import "./ToolRail.css";

interface ToolRailProps {
  mode: ShellToolMode;
  onModeChange: (mode: ShellToolMode) => void;
}

const TOOL_ITEMS: Array<{ id: ShellToolMode; label: string; icon: string }> = [
  { id: "notes", label: "Notes", icon: "N" },
  { id: "search", label: "Search", icon: "S" },
  { id: "graph", label: "Graph", icon: "G" },
];

export function ToolRail({ mode, onModeChange }: ToolRailProps) {
  return (
    <aside className="tool-rail" aria-label="Tool rail">
      <div className="tool-rail__tools">
        {TOOL_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`tool-rail__tool ${mode === item.id ? "tool-rail__tool--active" : ""}`}
            onClick={() => onModeChange(item.id)}
            aria-pressed={mode === item.id}
            title={item.label}
          >
            <span className="tool-rail__icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="tool-rail__label">{item.label}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
