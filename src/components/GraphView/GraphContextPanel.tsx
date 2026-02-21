import { IconButton } from "@components/IconButton";
import { FileText, FolderTree, RotateCcw, SquarePen } from "lucide-react";
import "./GraphView.css";

// SPEC: COMP-ICON-CHROME-001 FR-2, FR-5
// SPEC: COMP-GRAPH-MODES-002 FR-2, FR-4
interface GraphContextPanelProps {
  selectedTitle: string | null;
  selectedPath: string | null;
  neighbors: string[];
  backlinks: string[];
  scope: "vault" | "node";
  nodeScopeDepth: number;
  onScopeChange: (scope: "vault" | "node") => void;
  onNodeScopeDepthChange: (depth: number) => void;
  onResetView: () => void;
  onOpenEditor: () => void;
  onRelationSelect: (path: string) => void;
  showLabels?: boolean;
}

export function GraphContextPanel({
  selectedTitle,
  selectedPath,
  neighbors,
  backlinks,
  scope,
  nodeScopeDepth,
  onScopeChange,
  onNodeScopeDepthChange,
  onResetView,
  onOpenEditor,
  onRelationSelect,
  showLabels = false,
}: GraphContextPanelProps) {
  const nextScope = scope === "vault" ? "node" : "vault";
  const nextScopeIcon = scope === "vault" ? FileText : FolderTree;
  const nextScopeLabel = scope === "vault" ? "Node graph" : "Vault graph";

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
          <IconButton
            icon={nextScopeIcon}
            label={nextScopeLabel}
            showLabel={showLabels}
            className="btn-secondary"
            onClick={() => onScopeChange(nextScope)}
          />
        </div>
        {scope === "node" && (
          <div className="graph-context-panel__depth-controls">
            <p className="graph-context-panel__subheading">Depth: {nodeScopeDepth}</p>
            <div className="graph-context-panel__actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => onNodeScopeDepthChange(Math.max(1, nodeScopeDepth - 1))}
                disabled={nodeScopeDepth <= 1}
              >
                -
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => onNodeScopeDepthChange(Math.min(3, nodeScopeDepth + 1))}
                disabled={nodeScopeDepth >= 3}
              >
                +
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="graph-context-panel__details">
        {selectedPath ? (
          <>
            <p className="graph-context-panel__heading">Selected Node</p>
            <p className="graph-context-panel__node">{selectedTitle ?? selectedPath}</p>
            <p className="graph-context-panel__path">{selectedPath}</p>
            <div className="graph-context-panel__lists">
              <div>
                <p className="graph-context-panel__subheading">Neighbors</p>
                <ul className="graph-context-panel__relation-list">
                  {neighbors.map((item) => (
                    <li key={item}>
                      <button
                        type="button"
                        className={`graph-context-panel__relation-item ${
                          item === selectedPath ? "graph-context-panel__relation-item--active" : ""
                        }`.trim()}
                        onClick={() => onRelationSelect(item)}
                      >
                        {item}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="graph-context-panel__subheading">Backlinks</p>
                <ul className="graph-context-panel__relation-list">
                  {backlinks.map((item) => (
                    <li key={item}>
                      <button
                        type="button"
                        className={`graph-context-panel__relation-item ${
                          item === selectedPath ? "graph-context-panel__relation-item--active" : ""
                        }`.trim()}
                        onClick={() => onRelationSelect(item)}
                      >
                        {item}
                      </button>
                    </li>
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
