/**
 * GraphView - Interactive note link visualization
 *
 * Renders an SVG-based force-directed graph of note links.
 * Supports panning, zooming, and node selection.
 */
// SPEC: COMP-GRAPH-UI-001 FR-1, FR-2, FR-3, FR-5
// SPEC: COMP-ICON-CHROME-001 FR-2, FR-5

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { getGraphLayout } from "@lib/api";
import { IconButton } from "@components/IconButton";
import type { GraphLayout, GraphNode } from "@lib/api";
import { RotateCcw } from "lucide-react";
import "./GraphView.css";

export interface GraphViewProps {
  width: number;
  height: number;
  onNodeClick: (path: string) => void;
  showLabels?: boolean;
}

export function GraphView({ width, height, onNodeClick, showLabels = false }: GraphViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [layout, setLayout] = useState<GraphLayout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Viewport state
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Selected node
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Fetch layout data
  useEffect(() => {
    setLoading(true);
    setError(null);

    getGraphLayout(width, height)
      .then((data) => {
        setLayout(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
  }, [width, height]);

  // Create a map for quick node lookup
  const nodeMap = useMemo(() => {
    const map = new Map<string, GraphNode>();
    layout?.nodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [layout]);

  const getNode = useCallback(
    (id: string): GraphNode | undefined => nodeMap.get(id),
    [nodeMap]
  );

  // Handle mouse down for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only pan when clicking on the SVG background (not on nodes)
    if (e.target === svgRef.current) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - pan.x,
        y: e.clientY - pan.y,
      });
    }
  };

  // Handle mouse move for panning
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  // Handle mouse up to end panning
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Handle wheel for zooming
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.max(0.1, Math.min(5, z * delta)));
  };

  // Handle node click
  const handleNodeClick = (nodeId: string) => {
    setSelectedNode(nodeId);
    onNodeClick(nodeId);
  };

  // Reset view
  const handleResetView = () => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  };

  if (loading) {
    return (
      <div className="graph-view" style={{ width, height }}>
        <div className="graph-view__loading">Loading graph...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="graph-view" style={{ width, height }}>
        <div className="graph-view__error">Error: {error}</div>
      </div>
    );
  }

  if (!layout || layout.nodes.length === 0) {
    return (
      <div className="graph-view" style={{ width, height }}>
        <div className="graph-view__empty">
          <p>No notes to display</p>
          <p className="graph-view__empty-hint">
            Create some notes with links to see the graph
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="graph-view" style={{ width, height }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        role="img"
        aria-label="Note link graph"
        className={`graph-view__svg ${isDragging ? "is-dragging" : ""}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Edges first (rendered behind nodes) */}
          {layout.edges.map((edge) => {
            const sourceNode = getNode(edge.source);
            const targetNode = getNode(edge.target);
            if (!sourceNode || !targetNode) return null;
            const isConnected =
              hoveredNode !== null &&
              (edge.source === hoveredNode || edge.target === hoveredNode);

            return (
              <line
                key={`${edge.source}-${edge.target}`}
                x1={sourceNode.x}
                y1={sourceNode.y}
                x2={targetNode.x}
                y2={targetNode.y}
                className={`graph-edge ${
                  hoveredNode === null
                    ? ""
                    : isConnected
                      ? "graph-edge--highlighted"
                      : "graph-edge--dimmed"
                }`}
              />
            );
          })}

          {/* Nodes */}
          {layout.nodes.map((node) => (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              className={`graph-node ${selectedNode === node.id ? "is-selected" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                handleNodeClick(node.id);
              }}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
            >
              <circle r={20} className="graph-node__circle" />
              <text className="graph-node__label" dy={35}>
                {node.label}
              </text>
            </g>
          ))}
        </g>
      </svg>

      {/* Controls overlay */}
      <div className="graph-view__controls">
        <IconButton
          icon={RotateCcw}
          label="Reset"
          showLabel={showLabels}
          className="graph-view__control-btn"
          onClick={handleResetView}
        />
        <div className="graph-view__zoom-info">{Math.round(zoom * 100)}%</div>
      </div>

      {/* Stats overlay */}
      <div className="graph-view__stats">
        {layout.nodes.length} nodes · {layout.edges.length} edges
      </div>
    </div>
  );
}

export default GraphView;
