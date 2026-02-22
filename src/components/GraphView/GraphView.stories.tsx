import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, mocked, userEvent, waitFor } from "storybook/test";
import { GraphView } from "./index";
import { getGraphLayout } from "@lib/api";
import type { GraphLayout } from "@/types/vault";

// Trace: DESIGN-storybook-graphview-coverage-2026-02-22
const connectedLayout: GraphLayout = {
  nodes: [
    { id: "notes/root.md", label: "Root", x: 240, y: 120 },
    { id: "notes/child-a.md", label: "Child A", x: 120, y: 220 },
    { id: "notes/child-b.md", label: "Child B", x: 360, y: 220 },
  ],
  edges: [
    { source: "notes/root.md", target: "notes/child-a.md" },
    { source: "notes/root.md", target: "notes/child-b.md" },
  ],
};

const duplicateLabelLayout: GraphLayout = {
  nodes: [
    { id: "root/type-systems.md", label: "type-systems", x: 180, y: 140 },
    { id: "programming/type-systems.md", label: "type-systems", x: 320, y: 220 },
  ],
  edges: [],
};

const disconnectedLayout: GraphLayout = {
  nodes: [
    { id: "notes/root.md", label: "Root", x: 240, y: 120 },
    { id: "notes/child-a.md", label: "Child A", x: 120, y: 220 },
    { id: "notes/disconnected.md", label: "Disconnected", x: 500, y: 180 },
  ],
  edges: [{ source: "notes/root.md", target: "notes/child-a.md" }],
};
// Trace: DESIGN-storybook-coverage-closure-2026-02-22

const meta = {
  title: "Graph/GraphView",
  component: GraphView,
  args: {
    width: 800,
    height: 460,
    onNodeClick: fn(),
    onSelectionChange: fn(),
    showLabels: true,
    scope: "vault",
    selectedNodeId: null,
    centerNodeId: null,
    nodeScopeDepth: 1,
  },
  beforeEach: async () => {
    mocked(getGraphLayout).mockResolvedValue(connectedLayout);
  },
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof GraphView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const VaultScopeDefault: Story = {
  play: async ({ canvas, args }) => {
    await waitFor(() => {
      expect(canvas.getByRole("img", { name: "Note link graph" })).toBeInTheDocument();
    });
    await userEvent.click(canvas.getByText("Root"));
    await expect(args.onNodeClick).toHaveBeenCalledWith("notes/root.md");
  },
};

export const HoverHighlightsConnectedEdges: Story = {
  play: async ({ canvas, canvasElement }) => {
    await waitFor(() => {
      expect(canvas.getByRole("img", { name: "Note link graph" })).toBeInTheDocument();
    });
    await userEvent.hover(canvas.getByText("Child A"));
    await waitFor(() => {
      expect(canvasElement.querySelectorAll(".graph-edge--highlighted").length).toBe(1);
    });
    await expect(canvasElement.querySelectorAll(".graph-edge--dimmed").length).toBe(1);
  },
};

export const NodeScopeWithoutCenter: Story = {
  args: {
    scope: "node",
    centerNodeId: null,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("No center note selected")).toBeInTheDocument();
    await expect(canvas.getByText("Select a note to view local graph")).toBeInTheDocument();
  },
};

export const NodeScopeDepthTwo: Story = {
  args: {
    scope: "node",
    centerNodeId: "notes/root",
    nodeScopeDepth: 2,
  },
  play: async ({ canvas }) => {
    await waitFor(() => {
      expect(canvas.getByRole("img", { name: "Note link graph" })).toBeInTheDocument();
    });
    await expect(canvas.getByText("3 nodes · 2 edges")).toBeInTheDocument();
  },
};

export const ResetAfterZoom: Story = {
  play: async ({ canvas }) => {
    await waitFor(() => {
      expect(canvas.getByRole("img", { name: "Note link graph" })).toBeInTheDocument();
    });
    const graph = canvas.getByRole("img", { name: "Note link graph" });
    graph.dispatchEvent(new WheelEvent("wheel", { deltaY: -100, bubbles: true, cancelable: true }));
    await waitFor(() => {
      expect(canvas.getByText("110%")).toBeInTheDocument();
    });
    await userEvent.click(canvas.getByRole("button", { name: "Reset" }));
    await expect(canvas.getByText("100%")).toBeInTheDocument();
  },
};

export const DuplicateLabelDisambiguation: Story = {
  beforeEach: async () => {
    mocked(getGraphLayout).mockResolvedValue(duplicateLabelLayout);
  },
  play: async ({ canvas }) => {
    await waitFor(() => {
      expect(canvas.getByRole("img", { name: "Note link graph" })).toBeInTheDocument();
    });
    await expect(canvas.getByText("type-systems (root/type-systems)")).toBeInTheDocument();
    await expect(
      canvas.getByText("type-systems (programming/type-systems)")
    ).toBeInTheDocument();
  },
};

export const DisconnectedNodeDiscoverability: Story = {
  beforeEach: async () => {
    mocked(getGraphLayout).mockResolvedValue(disconnectedLayout);
  },
  play: async ({ canvas }) => {
    await waitFor(() => {
      expect(canvas.getByRole("img", { name: "Note link graph" })).toBeInTheDocument();
    });
    await expect(canvas.getByText("Disconnected")).toBeInTheDocument();
    await expect(canvas.getByText("3 nodes · 1 edges")).toBeInTheDocument();
  },
};

export const ControlledSelectionFromShellState: Story = {
  args: {
    selectedNodeId: "notes/child-b.md",
  },
  play: async ({ canvas, args }) => {
    await waitFor(() => {
      expect(canvas.getByRole("img", { name: "Note link graph" })).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(args.onSelectionChange).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "notes/child-b.md",
          title: "Child B",
        })
      );
    });
  },
};

export const EmptyGraph: Story = {
  beforeEach: async () => {
    mocked(getGraphLayout).mockResolvedValue({ nodes: [], edges: [] });
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("No notes to display")).toBeInTheDocument();
  },
};

export const ErrorState: Story = {
  beforeEach: async () => {
    mocked(getGraphLayout).mockRejectedValue(new Error("Failed to load graph"));
  },
  play: async ({ canvas }) => {
    await waitFor(() => {
      expect(canvas.getByText("Error: Failed to load graph")).toBeInTheDocument();
    });
  },
};
