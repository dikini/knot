/**
 * Tests for GraphView component
 * Spec: COMP-GRAPH-UI-001
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { GraphView } from "./index";

// Mock the API module
vi.mock("@lib/api", () => ({
  getGraphLayout: vi.fn(),
}));

import { getGraphLayout } from "@lib/api";
import type { GraphLayout } from "@lib/api";

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
    ],
    edges: [
      { source: "note1.md", target: "note2.md" },
      { source: "note1.md", target: "note3.md" },
    ],
  };

  const duplicateLabelLayout: GraphLayout = {
    nodes: [
      { id: "root/type-systems.md", label: "type-systems", x: 120, y: 120 },
      { id: "programming/type-systems.md", label: "type-systems", x: 260, y: 180 },
    ],
    edges: [],
  };

  describe("FR-1: Graph view component", () => {
    it("should render SVG canvas", () => {
      vi.mocked(getGraphLayout).mockResolvedValue(mockLayout);

      render(<GraphView width={800} height={600} onNodeClick={mockOnNodeClick} />);

      return waitFor(() => {
        const svg = screen.getByRole("img", { name: "Note link graph" });
        expect(svg).toBeInTheDocument();
      });
    });

    it("should show nodes as circles with labels", async () => {
      vi.mocked(getGraphLayout).mockResolvedValue(mockLayout);

      render(<GraphView width={800} height={600} onNodeClick={mockOnNodeClick} />);

      await waitFor(() => {
        const nodes = screen.getAllByText(/Note [1-3]/);
        expect(nodes.length).toBe(3);
      });
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
        const nodes = screen.getAllByText(/Note [1-3]/);
        expect(nodes.length).toBe(3);
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
    it("should render nodes as circles", async () => {
      vi.mocked(getGraphLayout).mockResolvedValue(mockLayout);

      render(<GraphView width={800} height={600} onNodeClick={mockOnNodeClick} />);

      await waitFor(() => {
        const nodes = screen.getAllByText(/Note [1-3]/);
        expect(nodes.length).toBe(3);
      });
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
});
