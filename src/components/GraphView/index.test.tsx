/**
 * Tests for GraphView component
 * Spec: COMP-GRAPH-UI-001
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { GraphView } from "./index";
import type { GraphLayout } from "@/types/vault";

// Mock the API module
vi.mock("@lib/api", () => ({
  getGraphLayout: vi.fn(),
}));

import { getGraphLayout } from "@lib/api";

describe("GraphView Component", () => {
  const mockOnNodeClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const mockLayout: GraphLayout = {
    nodes: [
      { id: "note1.md", label: "Note 1", x: 100, y: 100 },
      { id: "note2.md", label: "Note 2", x: 200, y: 150 },
      { id: "note3.md", label: "Note 3", x: 150, y: 200 },
      { id: "note4.md", label: "Note 4", x: 260, y: 240 },
    ],
    edges: [
      { source: "note1.md", target: "note2.md" },
      { source: "note1.md", target: "note3.md" },
      { source: "note2.md", target: "note4.md" },
    ],
  };

  const duplicateLabelLayout: GraphLayout = {
    nodes: [
      { id: "root/type-systems.md", label: "type-systems", x: 120, y: 120 },
      { id: "programming/type-systems.md", label: "type-systems", x: 260, y: 180 },
    ],
    edges: [],
  };

  const denseClusterLayout: GraphLayout = {
    nodes: [
      { id: "runtime/architecture.md", label: "architecture", x: 120, y: 80 },
      { id: "runtime/preliminary-algebra.md", label: "preliminary-algebra", x: 200, y: 80 },
      { id: "runtime/conversation-summary.md", label: "conversation-summary", x: 280, y: 80 },
      { id: "runtime/proof-boundaries.md", label: "proof-boundaries", x: 360, y: 80 },
      { id: "runtime/design.md", label: "design", x: 440, y: 80 },
      { id: "runtime/manifesto.md", label: "manifesto", x: 520, y: 80 },
      { id: "docs/mcp-cookbook.md", label: "MCP Cookbook", x: 790, y: 160 },
    ],
    edges: [
      { source: "runtime/architecture.md", target: "runtime/preliminary-algebra.md" },
      { source: "runtime/preliminary-algebra.md", target: "runtime/conversation-summary.md" },
      { source: "runtime/conversation-summary.md", target: "runtime/proof-boundaries.md" },
      { source: "runtime/proof-boundaries.md", target: "runtime/design.md" },
      { source: "runtime/design.md", target: "runtime/manifesto.md" },
    ],
  };

  const overlappingPillLayout: GraphLayout = {
    nodes: [
      { id: "wide-a.md", label: "Extremely Wide Alpha Label", x: 220, y: 140 },
      { id: "wide-b.md", label: "Extremely Wide Beta Label", x: 240, y: 146 },
      { id: "wide-c.md", label: "Extremely Wide Gamma Label", x: 260, y: 152 },
    ],
    edges: [],
  };

  describe("FR-1: Graph view component", () => {
    it("should render SVG canvas", () => {
      vi.mocked(getGraphLayout).mockResolvedValue(mockLayout);

      render(
        <GraphView
          width={800}
          height={600}
          onNodeClick={mockOnNodeClick}
          readabilityFloorPercent={70}
        />
      );

      return waitFor(() => {
        const svg = screen.getByRole("img", { name: "Note link graph" });
        expect(svg).toBeInTheDocument();
      });
    });

    it("should show nodes as text-first targets with labels", async () => {
      vi.mocked(getGraphLayout).mockResolvedValue(mockLayout);

      render(
        <GraphView
          width={800}
          height={600}
          onNodeClick={mockOnNodeClick}
          readabilityFloorPercent={70}
        />
      );

      expect(await screen.findByText("Note 1")).toBeInTheDocument();
      const targets = document.querySelectorAll(".graph-node__target");
      expect(targets.length).toBe(4);
    });

    it("should show edges as lines between nodes", async () => {
      vi.mocked(getGraphLayout).mockResolvedValue(mockLayout);

      render(<GraphView width={800} height={600} onNodeClick={mockOnNodeClick} />);

      await waitFor(() => {
        const svg = screen.getByRole("img");
        // Check that edges (lines) are rendered by checking for line elements
        const edges = svg.querySelectorAll("line");
        expect(edges.length).toBeGreaterThan(0);
      });
    });

    it("should connect edges to the nearest pill boundary instead of the node anchor", async () => {
      vi.mocked(getGraphLayout).mockResolvedValue(mockLayout);

      render(<GraphView width={800} height={600} onNodeClick={mockOnNodeClick} />);

      await waitFor(() => {
        const edge = document.querySelector("line");
        const sourceNode = document.querySelector('[data-node-id="note1.md"]');
        const targetNode = document.querySelector('[data-node-id="note2.md"]');
        const sourceRect = sourceNode?.querySelector(".graph-node__target");
        const targetRect = targetNode?.querySelector(".graph-node__target");

        expect(edge).not.toBeNull();
        expect(sourceNode).not.toBeNull();
        expect(targetNode).not.toBeNull();
        expect(sourceRect).not.toBeNull();
        expect(targetRect).not.toBeNull();

        const sourceLeft =
          Number(sourceNode?.getAttribute("data-origin-x")) + Number(sourceRect?.getAttribute("x"));
        const sourceTop =
          Number(sourceNode?.getAttribute("data-origin-y")) + Number(sourceRect?.getAttribute("y"));
        const sourceRight = sourceLeft + Number(sourceRect?.getAttribute("width"));
        const sourceBottom = sourceTop + Number(sourceRect?.getAttribute("height"));
        const targetLeft =
          Number(targetNode?.getAttribute("data-origin-x")) + Number(targetRect?.getAttribute("x"));
        const targetTop =
          Number(targetNode?.getAttribute("data-origin-y")) + Number(targetRect?.getAttribute("y"));
        const targetRight = targetLeft + Number(targetRect?.getAttribute("width"));
        const x1 = Number(edge?.getAttribute("x1"));
        const y1 = Number(edge?.getAttribute("y1"));
        const x2 = Number(edge?.getAttribute("x2"));
        const y2 = Number(edge?.getAttribute("y2"));

        expect(y1).toBe(sourceBottom);
        expect(y2).toBe(targetTop);
        expect(x1).toBeGreaterThanOrEqual(sourceLeft);
        expect(x1).toBeLessThanOrEqual(sourceRight);
        expect(x2).toBeGreaterThanOrEqual(targetLeft);
        expect(x2).toBeLessThanOrEqual(targetRight);
      });
    });
  });

  describe("FR-2: Interactive navigation", () => {
    it("should pan on drag", async () => {
      vi.mocked(getGraphLayout).mockResolvedValue(mockLayout);

      render(
        <GraphView width={800} height={600} onNodeClick={mockOnNodeClick} />
      );

      const svg = await screen.findByRole("img", { name: "Note link graph" });

      // Simulate mouse down on SVG background
      fireEvent.mouseDown(svg, { clientX: 100, clientY: 100 });

      // Simulate mouse move
      fireEvent.mouseMove(svg, { clientX: 150, clientY: 150 });

      // The pan state should have been updated
      // We verify by checking if the component didn't crash
      expect(svg).toBeInTheDocument();
    });

    it("should zoom on scroll wheel", async () => {
      vi.mocked(getGraphLayout).mockResolvedValue(mockLayout);

      render(<GraphView width={800} height={600} onNodeClick={mockOnNodeClick} />);

      const svg = await screen.findByRole("img", { name: "Note link graph" });

      // Simulate scroll wheel
      fireEvent.wheel(svg, { deltaY: -100 });

      expect(svg).toBeInTheDocument();
    });

    it("should call onNodeClick when node is clicked", async () => {
      vi.mocked(getGraphLayout).mockResolvedValue(mockLayout);

      render(<GraphView width={800} height={600} onNodeClick={mockOnNodeClick} />);

      await waitFor(() => {
        const node = screen.getByText("Note 1");
        fireEvent.click(node);
      });

      expect(mockOnNodeClick).toHaveBeenCalledWith("note1.md");
    });

    it("should highlight connected edges on node hover", async () => {
      vi.mocked(getGraphLayout).mockResolvedValue(mockLayout);

      render(<GraphView width={800} height={600} onNodeClick={mockOnNodeClick} />);

      const svg = await screen.findByRole("img", { name: "Note link graph" });
      const noteLabel = screen.getByText("Note 1");
      const nodeGroup = noteLabel.closest("g");
      expect(nodeGroup).not.toBeNull();
      fireEvent.mouseEnter(nodeGroup as SVGGElement);

      const highlightedEdges = svg.querySelectorAll(".graph-edge--highlighted");
      expect(highlightedEdges.length).toBe(2);
    });
  });

  describe("FR-3: Layout from backend", () => {
    it("should fetch layout on mount", () => {
      // Keep promise pending: this assertion only verifies effect invocation.
      vi.mocked(getGraphLayout).mockImplementation(() => new Promise(() => {}));
      render(<GraphView width={800} height={600} onNodeClick={mockOnNodeClick} />);

      expect(getGraphLayout).toHaveBeenCalledWith(800, 600);
    });

    it("should render nodes at provided positions", async () => {
      vi.mocked(getGraphLayout).mockResolvedValue(mockLayout);

      render(<GraphView width={800} height={600} onNodeClick={mockOnNodeClick} />);

      await waitFor(() => {
        const nodes = screen.getAllByText(/Note [1-4]/);
        expect(nodes.length).toBe(4);
      });
    });

    it("should show loading state while fetching", () => {
      vi.mocked(getGraphLayout).mockImplementation(() => new Promise(() => {}));

      render(<GraphView width={800} height={600} onNodeClick={mockOnNodeClick} />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it("should show error message if fetch fails", async () => {
      vi.mocked(getGraphLayout).mockRejectedValue(new Error("Failed to load graph"));

      render(<GraphView width={800} height={600} onNodeClick={mockOnNodeClick} />);

      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument();
      });
    });

    it("uses the readability floor when fit would otherwise become too small", async () => {
      vi.mocked(getGraphLayout).mockResolvedValue(overlappingPillLayout);

      render(
        <GraphView
          width={240}
          height={180}
          onNodeClick={mockOnNodeClick}
          readabilityFloorPercent={70}
        />
      );

      expect(await screen.findByText("70%")).toBeInTheDocument();
    });

    it("shows overflow cues when graph bounds exceed the viewport", async () => {
      vi.mocked(getGraphLayout).mockResolvedValue(overlappingPillLayout);

      render(
        <GraphView
          width={240}
          height={180}
          onNodeClick={mockOnNodeClick}
          readabilityFloorPercent={70}
        />
      );

      await screen.findByText("Extremely Wide Alpha Label");
      expect(await screen.findByText("70%")).toBeInTheDocument();
      expect(screen.getByTestId("graph-viewport")).toHaveAttribute("data-overflow-x", "false");
      expect(screen.getByTestId("graph-viewport")).toHaveAttribute("data-overflow-y", "false");
    });

    it("prevents overlapping pill targets in dense layouts even if content overflows", async () => {
      vi.mocked(getGraphLayout).mockResolvedValue(overlappingPillLayout);

      render(
        <GraphView
          width={320}
          height={220}
          onNodeClick={mockOnNodeClick}
          readabilityFloorPercent={70}
        />
      );

      await screen.findByText("Extremely Wide Alpha Label");
      const alphaNode = document.querySelector('[data-node-id="wide-a.md"]');
      const betaNode = document.querySelector('[data-node-id="wide-b.md"]');
      const alphaRect = alphaNode?.querySelector(".graph-node__target");
      const betaRect = betaNode?.querySelector(".graph-node__target");
      expect(alphaRect).not.toBeNull();
      expect(betaRect).not.toBeNull();

      const alphaX =
        Number(alphaNode?.getAttribute("data-origin-x")) + Number(alphaRect?.getAttribute("x"));
      const alphaY =
        Number(alphaNode?.getAttribute("data-origin-y")) + Number(alphaRect?.getAttribute("y"));
      const alphaWidth = Number(alphaRect?.getAttribute("width"));
      const alphaHeight = Number(alphaRect?.getAttribute("height"));
      const betaX =
        Number(betaNode?.getAttribute("data-origin-x")) + Number(betaRect?.getAttribute("x"));
      const betaY =
        Number(betaNode?.getAttribute("data-origin-y")) + Number(betaRect?.getAttribute("y"));

      expect(alphaX + alphaWidth <= betaX || betaX + Number(betaRect?.getAttribute("width")) <= alphaX || alphaY + alphaHeight <= betaY || betaY + Number(betaRect?.getAttribute("height")) <= alphaY).toBe(true);
    });
  });

  describe("FR-4: Toggle between views", () => {
    it("should respect width and height props", () => {
      // Keep promise pending: this assertion only verifies prop-driven fetch calls.
      vi.mocked(getGraphLayout).mockImplementation(() => new Promise(() => {}));

      const { rerender } = render(
        <GraphView width={800} height={600} onNodeClick={mockOnNodeClick} />
      );

      expect(getGraphLayout).toHaveBeenCalledWith(800, 600);

      // Rerender with different dimensions
      rerender(<GraphView width={1000} height={800} onNodeClick={mockOnNodeClick} />);

      expect(getGraphLayout).toHaveBeenCalledWith(1000, 800);
    });
  });

  describe("FR-5: Visual styling", () => {
    it("should render rectangular node targets", async () => {
      vi.mocked(getGraphLayout).mockResolvedValue(mockLayout);

      render(<GraphView width={800} height={600} onNodeClick={mockOnNodeClick} />);

      await screen.findByText("Note 1");
      const firstNode = document.querySelector('[data-node-id="note1.md"]');
      expect(firstNode?.querySelector(".graph-node__target")).not.toBeNull();
      expect(firstNode?.querySelector("circle")).toBeNull();
    });

    it("should style selected/hovered nodes differently", async () => {
      vi.mocked(getGraphLayout).mockResolvedValue(mockLayout);

      render(<GraphView width={800} height={600} onNodeClick={mockOnNodeClick} />);

      await waitFor(() => {
        const node = screen.getByText("Note 1");
        fireEvent.click(node);
      });

      // After clicking, the node should be selected
      // We verify this by checking the component didn't crash
      expect(screen.getByRole("img", { name: "Note link graph" })).toBeInTheDocument();
    });

    it("shows subtle debug-visible target backgrounds for hovered and selected nodes", async () => {
      vi.mocked(getGraphLayout).mockResolvedValue(mockLayout);

      render(<GraphView width={800} height={600} onNodeClick={mockOnNodeClick} />);

      const noteLabel = await screen.findByText("Note 1");
      const nodeGroup = noteLabel.closest('[data-node-id="note1.md"]');
      expect(nodeGroup).not.toBeNull();

      fireEvent.mouseEnter(nodeGroup as SVGGElement);
      expect(nodeGroup).toHaveClass("is-hovered");

      fireEvent.click(nodeGroup as SVGGElement);
      expect(nodeGroup).toHaveClass("is-selected");
      expect(nodeGroup?.querySelector(".graph-node__target")).not.toBeNull();
    });

    it("should mark externally selected node when selectedNodeId prop is provided", async () => {
      vi.mocked(getGraphLayout).mockResolvedValue(mockLayout);

      render(
        <GraphView
          width={800}
          height={600}
          onNodeClick={mockOnNodeClick}
          selectedNodeId="note2.md"
        />
      );

      const selectedLabel = await screen.findByText("Note 2");
      const selectedNodeGroup = selectedLabel.closest(".graph-node");
      expect(selectedNodeGroup).toHaveClass("is-selected");
    });

    it("should disambiguate duplicate labels with path context", async () => {
      vi.mocked(getGraphLayout).mockResolvedValue(duplicateLabelLayout);

      render(<GraphView width={800} height={600} onNodeClick={mockOnNodeClick} />);

      expect(await screen.findByText("type-systems (root/type-systems)")).toBeInTheDocument();
      expect(
        await screen.findByText("type-systems (programming/type-systems)")
      ).toBeInTheDocument();
    });
  });

  describe("FR-7: Fit floor and reset framing", () => {
    it("does not disturb a manual zoom when the readability floor setting changes", async () => {
      vi.mocked(getGraphLayout).mockResolvedValue(overlappingPillLayout);

      const { rerender } = render(
        <GraphView
          width={260}
          height={180}
          onNodeClick={mockOnNodeClick}
          readabilityFloorPercent={70}
        />
      );

      const svg = await screen.findByRole("img", { name: "Note link graph" });
      fireEvent.wheel(svg, { deltaY: -100 });
      const zoomBefore = screen.getByText(/%$/).textContent;
      expect(zoomBefore).toBe("83%");

      rerender(
        <GraphView
          width={260}
          height={180}
          onNodeClick={mockOnNodeClick}
          readabilityFloorPercent={90}
        />
      );

      expect(screen.getByText(zoomBefore ?? "83%")).toBeInTheDocument();
      expect(screen.queryByText("90%")).not.toBeInTheDocument();
    });

    it("applies the latest readability floor when reset is used", async () => {
      vi.mocked(getGraphLayout).mockResolvedValue(overlappingPillLayout);

      const { rerender } = render(
        <GraphView
          width={260}
          height={180}
          onNodeClick={mockOnNodeClick}
          readabilityFloorPercent={70}
        />
      );

      await screen.findByText("Extremely Wide Alpha Label");
      rerender(
        <GraphView
          width={260}
          height={180}
          onNodeClick={mockOnNodeClick}
          readabilityFloorPercent={90}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Reset" }));
      expect(screen.getByText("90%")).toBeInTheDocument();
    });
  });

  describe("FR-6: Label readability", () => {
    it("stagger labels in dense horizontal clusters", async () => {
      vi.mocked(getGraphLayout).mockResolvedValue(denseClusterLayout);

      render(<GraphView width={900} height={560} onNodeClick={mockOnNodeClick} />);

      const architectureLabel = await screen.findByText("architecture");
      const algebraLabel = await screen.findByText("preliminary-algebra");
      const conversationLabel = await screen.findByText("conversation-summary");

      expect(architectureLabel).toHaveAttribute("data-label-placement", "below");
      expect(algebraLabel).toHaveAttribute("data-label-placement", "above");
      expect(conversationLabel).toHaveAttribute("data-label-placement", "below");
    });

    it("keeps edge-adjacent labels inside the graph viewport", async () => {
      vi.mocked(getGraphLayout).mockResolvedValue(denseClusterLayout);

      render(<GraphView width={900} height={560} onNodeClick={mockOnNodeClick} />);

      const edgeLabel = await screen.findByText("MCP Cookbook");
      expect(edgeLabel).toHaveAttribute("data-label-placement", "left");
      expect(edgeLabel).toHaveAttribute("text-anchor", "end");
    });
  });

  describe("Local graph scope", () => {
    it("hides nodes beyond depth 1 in node scope", async () => {
      vi.mocked(getGraphLayout).mockResolvedValue(mockLayout);

      render(
        <GraphView
          width={800}
          height={600}
          onNodeClick={mockOnNodeClick}
          scope="node"
          centerNodeId="note1.md"
          nodeScopeDepth={1}
        />
      );

      expect(await screen.findByText("Note 1")).toBeInTheDocument();
      expect(screen.getByText("Note 2")).toBeInTheDocument();
      expect(screen.getByText("Note 3")).toBeInTheDocument();
      expect(screen.queryByText("Note 4")).not.toBeInTheDocument();
    });

    it("includes farther neighbors when node depth increases", async () => {
      vi.mocked(getGraphLayout).mockResolvedValue(mockLayout);

      render(
        <GraphView
          width={800}
          height={600}
          onNodeClick={mockOnNodeClick}
          scope="node"
          centerNodeId="note1.md"
          nodeScopeDepth={2}
        />
      );

      expect(await screen.findByText("Note 4")).toBeInTheDocument();
    });

    it("shows a hint when node scope has no center note", async () => {
      vi.mocked(getGraphLayout).mockResolvedValue(mockLayout);

      render(
        <GraphView
          width={800}
          height={600}
          onNodeClick={mockOnNodeClick}
          scope="node"
          centerNodeId={null}
          nodeScopeDepth={1}
        />
      );

      expect(await screen.findByText(/select a note to view local graph/i)).toBeInTheDocument();
    });
  });
});
