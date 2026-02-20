import { BookOpenText, Search, Network } from "lucide-react";
import { IconButton } from "@components/IconButton";
import type { ShellToolMode } from "@lib/store";
import "./ToolRail.css";

// SPEC: COMP-ICON-CHROME-001 FR-1, FR-3, FR-5
interface ToolRailProps {
  mode: ShellToolMode;
  showLabels: boolean;
  onModeChange: (mode: ShellToolMode) => void;
}

const TOOL_ITEMS: Array<{ id: ShellToolMode; label: string; icon: typeof BookOpenText }> = [
  { id: "notes", label: "Notes", icon: BookOpenText },
  { id: "search", label: "Search", icon: Search },
  { id: "graph", label: "Graph", icon: Network },
];

export function ToolRail({ mode, showLabels, onModeChange }: ToolRailProps) {
  return (
    <aside className="tool-rail" aria-label="Tool rail">
      <div className="tool-rail__tools">
        {TOOL_ITEMS.map((item) => (
          <IconButton
            key={item.id}
            icon={item.icon}
            label={item.label}
            showLabel={showLabels}
            active={mode === item.id}
            className={`tool-rail__tool ${mode === item.id ? "tool-rail__tool--active" : ""}`}
            onClick={() => onModeChange(item.id)}
            aria-pressed={mode === item.id}
          />
        ))}
      </div>
    </aside>
  );
}
