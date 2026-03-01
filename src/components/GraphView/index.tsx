/**
 * GraphView - Interactive note link visualization
 *
 * Renders an SVG-based force-directed graph of note links.
 * Supports panning, zooming, and node selection.
 */
// SPEC: COMP-GRAPH-UI-001 FR-1, FR-2, FR-3, FR-5
// SPEC: COMP-ICON-CHROME-001 FR-2, FR-5
// SPEC: COMP-GRAPH-HOVER-001 FR-1, FR-2
// SPEC: COMP-GRAPH-CONSISTENCY-001 FR-3, FR-4
// SPEC: COMP-GRAPH-MODES-002 FR-3, FR-4, FR-5, FR-6

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { getGraphLayout } from "@lib/api";
import { IconButton } from "@components/IconButton";
import type { GraphLayout, GraphNode } from "@/types/vault";
import { RotateCcw } from "lucide-react";
import "./GraphView.css";

export interface GraphViewProps {
  width: number;
  height: number;
  onNodeClick: (path: string) => void;
  onSelectionChange?: (selection: {
    path: string | null;
    title: string | null;
    neighbors: string[];
    backlinks: string[];
  }) => void;
  showLabels?: boolean;
  selectedNodeId?: string | null;
  scope?: "vault" | "node";
  centerNodeId?: string | null;
  nodeScopeDepth?: number;
  readabilityFloorPercent?: number;
}

function stripMarkdownExtension(path: string): string {
  return path.replace(/\.md$/i, "");
}

function normalizeNodeId(value: string): string {
  return value.replace(/\\/g, "/").replace(/\.md$/i, "").toLowerCase();
}

function basename(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] ?? normalized;
}

function resolveNodeIdFromNodes(
  candidate: string | null,
  nodes: GraphNode[]
): string | null {
  if (!candidate || nodes.length === 0) {
    return null;
  }

  const direct = nodes.find((node) => node.id === candidate);
  if (direct) {
    return direct.id;
  }

  const normalizedCandidate = normalizeNodeId(candidate);
  const byNormalizedPath = nodes.find((node) => normalizeNodeId(node.id) === normalizedCandidate);
  if (byNormalizedPath) {
    return byNormalizedPath.id;
  }

  const candidateBasename = basename(normalizedCandidate);
  const byBasename = nodes.find((node) => basename(normalizeNodeId(node.id)) === candidateBasename);
  return byBasename?.id ?? null;
}

type LabelPlacement = "above" | "below" | "left" | "right";

interface LabelLayout {
  dx: number;
  dy: number;
  placement: LabelPlacement;
  textAnchor: "start" | "middle" | "end";
}

interface LabelTargetBox {
  height: number;
  rx: number;
  ry: number;
  width: number;
  x: number;
  y: number;
}

interface NodeVisual {
  label: string;
  labelLayout: LabelLayout;
  node: GraphNode;
  targetBox: LabelTargetBox;
}

interface PositionedNodeVisual extends NodeVisual {
  originX: number;
  originY: number;
}

interface SurfaceLayout {
  height: number;
  visuals: Map<string, PositionedNodeVisual>;
  width: number;
}

function estimateLabelTargetBox(label: string, layout: LabelLayout): LabelTargetBox {
  const textWidth = Math.max(44, label.length * 7.2);
  const horizontalPadding = 10;
  const width = textWidth + horizontalPadding * 2;
  const height = 24;
  let x = layout.dx - width / 2;

  if (layout.textAnchor === "start") {
    x = layout.dx - horizontalPadding;
  } else if (layout.textAnchor === "end") {
    x = layout.dx - (textWidth + horizontalPadding);
  }

  return {
    x,
    y: layout.dy - height / 2,
    width,
    height,
    rx: 8,
    ry: 8,
  };
}

function getRectBoundaryPoint(
  centerX: number,
  centerY: number,
  box: LabelTargetBox,
  targetX: number,
  targetY: number
): { x: number; y: number } {
  const rectCenterX = centerX + box.x + box.width / 2;
  const rectCenterY = centerY + box.y + box.height / 2;
  const dx = targetX - rectCenterX;
  const dy = targetY - rectCenterY;
  const halfWidth = box.width / 2;
  const halfHeight = box.height / 2;

  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
    return { x: rectCenterX, y: rectCenterY };
  }

  const scale = 1 / Math.max(Math.abs(dx) / halfWidth, Math.abs(dy) / halfHeight, 1);
  return {
    x: rectCenterX + dx * scale,
    y: rectCenterY + dy * scale,
  };
}

function getAbsoluteTargetBox(visual: PositionedNodeVisual): LabelTargetBox {
  return {
    ...visual.targetBox,
    x: visual.originX + visual.targetBox.x,
    y: visual.originY + visual.targetBox.y,
  };
}

function resolveSurfaceLayout(
  visuals: Map<string, NodeVisual>,
  padding: number = 48
): SurfaceLayout {
  const positioned = Array.from(visuals.values()).map<PositionedNodeVisual>((visual) => ({
    ...visual,
    originX: visual.node.x,
    originY: visual.node.y,
  }));

  for (let iteration = 0; iteration < 48; iteration += 1) {
    let moved = false;

    for (let i = 0; i < positioned.length; i += 1) {
      for (let j = i + 1; j < positioned.length; j += 1) {
        const left = positioned[i];
        const right = positioned[j];
        const leftBox = getAbsoluteTargetBox(left);
        const rightBox = getAbsoluteTargetBox(right);
        const overlapX =
          Math.min(leftBox.x + leftBox.width, rightBox.x + rightBox.width) -
          Math.max(leftBox.x, rightBox.x);
        const overlapY =
          Math.min(leftBox.y + leftBox.height, rightBox.y + rightBox.height) -
          Math.max(leftBox.y, rightBox.y);

        if (overlapX <= 0 || overlapY <= 0) {
          continue;
        }

        moved = true;
        const leftCenterX = leftBox.x + leftBox.width / 2;
        const rightCenterX = rightBox.x + rightBox.width / 2;
        const leftCenterY = leftBox.y + leftBox.height / 2;
        const rightCenterY = rightBox.y + rightBox.height / 2;

        if (overlapX <= overlapY) {
          const push = overlapX / 2 + 8;
          const direction = leftCenterX <= rightCenterX ? -1 : 1;
          left.originX += direction * push;
          right.originX -= direction * push;
        } else {
          const push = overlapY / 2 + 8;
          const direction = leftCenterY <= rightCenterY ? -1 : 1;
          left.originY += direction * push;
          right.originY -= direction * push;
        }
      }
    }

    if (!moved) {
      break;
    }
  }

  const minX = positioned
    .map((visual) => getAbsoluteTargetBox(visual).x)
    .reduce((current, value) => Math.min(current, value), Number.POSITIVE_INFINITY);
  const minY = positioned
    .map((visual) => getAbsoluteTargetBox(visual).y)
    .reduce((current, value) => Math.min(current, value), Number.POSITIVE_INFINITY);
  const shiftX = Number.isFinite(minX) ? padding - minX : 0;
  const shiftY = Number.isFinite(minY) ? padding - minY : 0;

  for (const visual of positioned) {
    visual.originX += shiftX;
    visual.originY += shiftY;
  }

  const maxX = positioned
    .map((visual) => {
      const box = getAbsoluteTargetBox(visual);
      return box.x + box.width;
    })
    .reduce((current, value) => Math.max(current, value), 0);
  const maxY = positioned
    .map((visual) => {
      const box = getAbsoluteTargetBox(visual);
      return box.y + box.height;
    })
    .reduce((current, value) => Math.max(current, value), 0);

  return {
    width: maxX + padding,
    height: maxY + padding,
    visuals: new Map(positioned.map((visual) => [visual.node.id, visual])),
  };
}

function computeInitialZoom(
  surfaceWidth: number,
  surfaceHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  readabilityFloorPercent: number
): number {
  const fitZoom = Math.min(viewportWidth / surfaceWidth, viewportHeight / surfaceHeight, 1);
  const floor = Math.max(0.4, Math.min(1, readabilityFloorPercent / 100));
  return fitZoom < floor ? floor : fitZoom;
}

function computeLabelLayouts(nodes: GraphNode[], width: number): Map<string, LabelLayout> {
  const layouts = new Map<string, LabelLayout>();
  const edgeThreshold = 120;
  const rowThreshold = 56;

  const rowGroups = nodes.reduce<Array<GraphNode[]>>((groups, node) => {
    const existing = groups.find((group) => Math.abs(group[0]!.y - node.y) <= rowThreshold);
    if (existing) {
      existing.push(node);
    } else {
      groups.push([node]);
    }
    return groups;
  }, []);

  for (const group of rowGroups) {
    group.sort((left, right) => left.x - right.x);
    const crowded = group.length >= 3;

    for (const [index, node] of group.entries()) {
      if (node.x > width - edgeThreshold) {
        layouts.set(node.id, {
          dx: -28,
          dy: 5,
          placement: "left",
          textAnchor: "end",
        });
        continue;
      }

      if (node.x < edgeThreshold) {
        layouts.set(node.id, {
          dx: 28,
          dy: 5,
          placement: "right",
          textAnchor: "start",
        });
        continue;
      }

      if (crowded) {
        const lane = Math.floor(index / 2);
        const isAbove = index % 2 === 1;
        layouts.set(node.id, {
          dx: 0,
          dy: isAbove ? -28 - lane * 18 : 35 + lane * 18,
          placement: isAbove ? "above" : "below",
          textAnchor: "middle",
        });
        continue;
      }

      layouts.set(node.id, {
        dx: 0,
        dy: 35,
        placement: "below",
        textAnchor: "middle",
      });
    }
  }

  return layouts;
}

export function GraphView({
  width,
  height,
  onNodeClick,
  onSelectionChange,
  showLabels = false,
  selectedNodeId = null,
  scope = "vault",
  centerNodeId = null,
  nodeScopeDepth = 1,
  readabilityFloorPercent = 70,
}: GraphViewProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [layout, setLayout] = useState<GraphLayout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

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

  const normalizedLayout = useMemo(() => {
    if (!layout) {
      return {
        nodes: [] as GraphNode[],
        edges: [] as GraphLayout["edges"],
        labelCounts: new Map<string, number>(),
      };
    }

    const nodeById = new Map<string, GraphNode>();
    for (const node of layout.nodes) {
      if (!nodeById.has(node.id)) {
        nodeById.set(node.id, node);
      }
    }

    const nodes = Array.from(nodeById.values());
    const edges = [];
    const edgeKeys = new Set<string>();
    for (const edge of layout.edges) {
      if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) {
        continue;
      }
      const key = `${edge.source}->${edge.target}`;
      if (edgeKeys.has(key)) {
        continue;
      }
      edgeKeys.add(key);
      edges.push(edge);
    }

    const labelCounts = nodes.reduce((acc, node) => {
      acc.set(node.label, (acc.get(node.label) ?? 0) + 1);
      return acc;
    }, new Map<string, number>());

    return { nodes, edges, labelCounts };
  }, [layout]);

  const visibleGraph = useMemo(() => {
    const resolvedCenterNodeId = resolveNodeIdFromNodes(centerNodeId, normalizedLayout.nodes);

    if (scope === "vault") {
      return {
        hasCenter: true,
        nodes: normalizedLayout.nodes,
        edges: normalizedLayout.edges,
        labelCounts: normalizedLayout.labelCounts,
      };
    }

    if (!resolvedCenterNodeId) {
      return {
        hasCenter: false,
        nodes: [] as GraphNode[],
        edges: [] as GraphLayout["edges"],
        labelCounts: new Map<string, number>(),
      };
    }

    const maxDepth = Math.max(1, Math.min(3, Math.floor(nodeScopeDepth)));
    const adjacency = new Map<string, Set<string>>();
    for (const node of normalizedLayout.nodes) {
      adjacency.set(node.id, new Set());
    }
    for (const edge of normalizedLayout.edges) {
      adjacency.get(edge.source)?.add(edge.target);
      adjacency.get(edge.target)?.add(edge.source);
    }

    if (!adjacency.has(resolvedCenterNodeId)) {
      return {
        hasCenter: false,
        nodes: [] as GraphNode[],
        edges: [] as GraphLayout["edges"],
        labelCounts: new Map<string, number>(),
      };
    }

    const visibleIds = new Set<string>([resolvedCenterNodeId]);
    const queue: Array<{ id: string; depth: number }> = [{ id: resolvedCenterNodeId, depth: 0 }];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;
      if (current.depth >= maxDepth) continue;
      for (const neighbor of adjacency.get(current.id) ?? []) {
        if (visibleIds.has(neighbor)) continue;
        visibleIds.add(neighbor);
        queue.push({ id: neighbor, depth: current.depth + 1 });
      }
    }

    const nodes = normalizedLayout.nodes.filter((node) => visibleIds.has(node.id));
    const edges = normalizedLayout.edges.filter(
      (edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)
    );
    const labelCounts = nodes.reduce((acc, node) => {
      acc.set(node.label, (acc.get(node.label) ?? 0) + 1);
      return acc;
    }, new Map<string, number>());

    return { hasCenter: true, nodes, edges, labelCounts };
  }, [scope, centerNodeId, nodeScopeDepth, normalizedLayout]);

  const labelLayouts = useMemo(
    () => computeLabelLayouts(visibleGraph.nodes, width),
    [visibleGraph.nodes, width]
  );

  const getNodeLabel = useCallback(
    (node: GraphNode): string => {
      const duplicateLabel = (visibleGraph.labelCounts.get(node.label) ?? 0) > 1;
      if (!duplicateLabel) {
        return node.label;
      }
      return `${node.label} (${stripMarkdownExtension(node.id)})`;
    },
    [visibleGraph.labelCounts]
  );

  const nodeVisuals = useMemo(() => {
    const map = new Map<string, NodeVisual>();
    for (const node of visibleGraph.nodes) {
      const label = getNodeLabel(node);
      const labelLayout = labelLayouts.get(node.id) ?? {
        dx: 0,
        dy: 35,
        placement: "below" as const,
        textAnchor: "middle" as const,
      };
      map.set(node.id, {
        node,
        label,
        labelLayout,
        targetBox: estimateLabelTargetBox(label, labelLayout),
      });
    }
    return map;
  }, [getNodeLabel, labelLayouts, visibleGraph.nodes]);

  const surfaceLayout = useMemo(() => resolveSurfaceLayout(nodeVisuals), [nodeVisuals]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, GraphNode>();
    visibleGraph.nodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [visibleGraph.nodes]);

  const centerViewportOnSurface = useCallback(
    (nextZoom: number) => {
      const viewport = viewportRef.current;
      if (!viewport) {
        return;
      }
      const scaledWidth = surfaceLayout.width * nextZoom;
      const scaledHeight = surfaceLayout.height * nextZoom;
      viewport.scrollLeft = Math.max(0, (scaledWidth - width) / 2);
      viewport.scrollTop = Math.max(0, (scaledHeight - height) / 2);
    },
    [height, surfaceLayout.height, surfaceLayout.width, width]
  );

  useEffect(() => {
    if (!layout || visibleGraph.nodes.length === 0) {
      return;
    }
    const initialZoom = computeInitialZoom(
      surfaceLayout.width,
      surfaceLayout.height,
      width,
      height,
      readabilityFloorPercent
    );
    setZoom(initialZoom);
    centerViewportOnSurface(initialZoom);
    // Intentionally exclude readabilityFloorPercent so active manual view state
    // is preserved until the next open or reset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, visibleGraph.nodes.length, surfaceLayout.width, surfaceLayout.height, width, height]);

  // Handle mouse down for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only pan when clicking on the SVG background (not on nodes)
    const viewport = viewportRef.current;
    if (e.target === svgRef.current && viewport) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX,
        y: e.clientY,
        scrollLeft: viewport.scrollLeft,
        scrollTop: viewport.scrollTop,
      });
    }
  };

  // Handle mouse move for panning
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && viewportRef.current) {
      viewportRef.current.scrollLeft = dragStart.scrollLeft - (e.clientX - dragStart.x);
      viewportRef.current.scrollTop = dragStart.scrollTop - (e.clientY - dragStart.y);
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

  const effectiveSelectedNode = useMemo(
    () => resolveNodeIdFromNodes(selectedNodeId ?? selectedNode, visibleGraph.nodes),
    [selectedNodeId, selectedNode, visibleGraph.nodes]
  );

  useEffect(() => {
    if (!onSelectionChange) return;
    if (!effectiveSelectedNode) {
      onSelectionChange({ path: null, title: null, neighbors: [], backlinks: [] });
      return;
    }

    const currentNode = nodeMap.get(effectiveSelectedNode);
    let neighbors = visibleGraph.edges
      .filter((edge) => edge.source === effectiveSelectedNode)
      .map((edge) => edge.target);
    let backlinks = visibleGraph.edges
      .filter((edge) => edge.target === effectiveSelectedNode)
      .map((edge) => edge.source);

    if (neighbors.length === 0 && backlinks.length === 0) {
      const connected = visibleGraph.edges.flatMap((edge) => {
        if (edge.source === effectiveSelectedNode) return [edge.target];
        if (edge.target === effectiveSelectedNode) return [edge.source];
        return [];
      });
      neighbors = Array.from(new Set(connected));
      backlinks = [];
    }

    onSelectionChange({
      path: effectiveSelectedNode,
      title: currentNode?.label ?? effectiveSelectedNode,
      neighbors,
      backlinks,
    });
  }, [effectiveSelectedNode, nodeMap, onSelectionChange, visibleGraph.edges]);

  // Reset view
  const handleResetView = () => {
    const nextZoom = computeInitialZoom(
      surfaceLayout.width,
      surfaceLayout.height,
      width,
      height,
      readabilityFloorPercent
    );
    setZoom(nextZoom);
    centerViewportOnSurface(nextZoom);
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

  if (scope === "node" && !visibleGraph.hasCenter) {
    return (
      <div className="graph-view" style={{ width, height }}>
        <div className="graph-view__empty">
          <p>No center note selected</p>
          <p className="graph-view__empty-hint">Select a note to view local graph</p>
        </div>
      </div>
    );
  }

  if (!layout || visibleGraph.nodes.length === 0) {
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

  const hasOverflowX = surfaceLayout.width * zoom > width + 1;
  const hasOverflowY = surfaceLayout.height * zoom > height + 1;

  return (
    <div className="graph-view" style={{ width, height }}>
      <div
        ref={viewportRef}
        className="graph-view__viewport"
        data-testid="graph-viewport"
        data-overflow-x={hasOverflowX ? "true" : "false"}
        data-overflow-y={hasOverflowY ? "true" : "false"}
      >
        <svg
          ref={svgRef}
          width={surfaceLayout.width * zoom}
          height={surfaceLayout.height * zoom}
          role="img"
          aria-label="Note link graph"
          className={`graph-view__svg ${isDragging ? "is-dragging" : ""}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          <g transform={`scale(${zoom})`}>
          {/* Edges first (rendered behind nodes) */}
          {visibleGraph.edges.map((edge) => {
            const sourceVisual = surfaceLayout.visuals.get(edge.source);
            const targetVisual = surfaceLayout.visuals.get(edge.target);
            if (!sourceVisual || !targetVisual) return null;
            const isConnected =
              hoveredNode !== null &&
              (edge.source === hoveredNode || edge.target === hoveredNode);
            const sourceCenterX =
              sourceVisual.originX + sourceVisual.targetBox.x + sourceVisual.targetBox.width / 2;
            const sourceCenterY =
              sourceVisual.originY + sourceVisual.targetBox.y + sourceVisual.targetBox.height / 2;
            const targetCenterX =
              targetVisual.originX + targetVisual.targetBox.x + targetVisual.targetBox.width / 2;
            const targetCenterY =
              targetVisual.originY + targetVisual.targetBox.y + targetVisual.targetBox.height / 2;
            const startPoint = getRectBoundaryPoint(
              sourceVisual.originX,
              sourceVisual.originY,
              sourceVisual.targetBox,
              targetCenterX,
              targetCenterY
            );
            const endPoint = getRectBoundaryPoint(
              targetVisual.originX,
              targetVisual.originY,
              targetVisual.targetBox,
              sourceCenterX,
              sourceCenterY
            );

            return (
              <line
                key={`${edge.source}-${edge.target}`}
                x1={startPoint.x}
                y1={startPoint.y}
                x2={endPoint.x}
                y2={endPoint.y}
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
          {visibleGraph.nodes.map((node) => (
            (() => {
              const visual = surfaceLayout.visuals.get(node.id);
              if (!visual) return null;
              const isHovered = hoveredNode === node.id;

              return (
                <g
                  key={node.id}
                  transform={`translate(${visual.originX}, ${visual.originY})`}
                  className={`graph-node ${effectiveSelectedNode === node.id ? "is-selected" : ""} ${
                    isHovered ? "is-hovered" : ""
                  }`}
                  data-node-id={node.id}
                  data-origin-x={visual.originX}
                  data-origin-y={visual.originY}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNodeClick(node.id);
                  }}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                >
                  <rect className="graph-node__target" {...visual.targetBox} />
                  <text
                    className={`graph-node__label graph-node__label--${visual.labelLayout.placement}`}
                    x={visual.labelLayout.dx}
                    y={visual.labelLayout.dy}
                    textAnchor={visual.labelLayout.textAnchor}
                    data-label-placement={visual.labelLayout.placement}
                  >
                    {visual.label}
                  </text>
                  <title>{stripMarkdownExtension(node.id)}</title>
                </g>
              );
            })()
          ))}
          </g>
        </svg>
      </div>

      {/* Controls overlay */}
      <div className="graph-view__controls">
        <IconButton
          icon={RotateCcw}
          label="Reset"
          showLabel={showLabels}
          className="graph-view__control-btn"
          onClick={handleResetView}
        />
        <div className="graph-view__zoom-info">{`${Math.round(zoom * 100)}%`}</div>
      </div>

      {/* Stats overlay */}
      <div className="graph-view__stats">
        {visibleGraph.nodes.length} nodes · {visibleGraph.edges.length} edges
      </div>
    </div>
  );
}

export default GraphView;
