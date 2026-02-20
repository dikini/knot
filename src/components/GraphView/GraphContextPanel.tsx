import "./GraphView.css";

interface GraphContextPanelProps {
  selectedTitle: string | null;
  selectedPath: string | null;
  neighbors: string[];
  backlinks: string[];
  onResetView: () => void;
  onOpenEditor: () => void;
}

export function GraphContextPanel({
  selectedTitle,
  selectedPath,
  neighbors,
  backlinks,
  onResetView,
  onOpenEditor,
}: GraphContextPanelProps) {
  return (
    <div className="graph-context-panel">
      <section className="graph-context-panel__controls">
        <p className="graph-context-panel__heading">Graph Controls</p>
        <div className="graph-context-panel__actions">
          <button type="button" className="btn-secondary" onClick={onResetView}>
            Reset View
          </button>
          <button type="button" className="btn-secondary" onClick={onOpenEditor}>
            Open Editor
          </button>
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
