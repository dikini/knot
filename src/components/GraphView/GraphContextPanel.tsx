import { IconButton } from "@components/IconButton";
import { RotateCcw, SquarePen } from "lucide-react";
import "./GraphView.css";

// SPEC: COMP-ICON-CHROME-001 FR-2, FR-5
interface GraphContextPanelProps {
  selectedTitle: string | null;
  selectedPath: string | null;
  neighbors: string[];
  backlinks: string[];
  onResetView: () => void;
  onOpenEditor: () => void;
  showLabels?: boolean;
}

export function GraphContextPanel({
  selectedTitle,
  selectedPath,
  neighbors,
  backlinks,
  onResetView,
  onOpenEditor,
  showLabels = false,
}: GraphContextPanelProps) {
  return (
    <div className="graph-context-panel">
      <section className="graph-context-panel__controls">
        <p className="graph-context-panel__heading">Graph Controls</p>
        <div className="graph-context-panel__actions">
          <IconButton
            icon={RotateCcw}
            label="Reset"
            showLabel={showLabels}
            className="btn-secondary"
            onClick={onResetView}
          />
          <IconButton
            icon={SquarePen}
            label="Editor"
            showLabel={showLabels}
            className="btn-secondary"
            onClick={onOpenEditor}
          />
        </div>
      </section>

      <section className="graph-context-panel__details">
        {selectedPath ? (
          <>
            <p className="graph-context-panel__heading">Selected Node</p>
            <p className="graph-context-panel__node">{selectedTitle ?? selectedPath}</p>
            <p className="graph-context-panel__path">{selectedPath}</p>
            <div className="graph-context-panel__split">
              <div>
                <p className="graph-context-panel__subheading">Neighbors</p>
                <ul>
                  {neighbors.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="graph-context-panel__subheading">Backlinks</p>
                <ul>
                  {backlinks.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        ) : (
          <p className="graph-context-panel__empty">No node selected</p>
        )}
      </section>
    </div>
  );
}
