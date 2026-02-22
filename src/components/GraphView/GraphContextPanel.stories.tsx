import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent } from "storybook/test";
import { GraphContextPanel } from "./GraphContextPanel";

// Trace: DESIGN-storybook-graph-context-panel-coverage-2026-02-22
const meta = {
  title: "Graph/GraphContextPanel",
  component: GraphContextPanel,
  args: {
    selectedTitle: "Language Model Evaluation",
    selectedPath: "english-research/language-model-evaluation.md",
    neighbors: ["product-docs/roadmap-brief.md", "engineering-journal/build-notes.md"],
    backlinks: ["бележки/дневник-на-идеи.md"],
    scope: "vault",
    nodeScopeDepth: 1,
    onScopeChange: fn(),
    onNodeScopeDepthChange: fn(),
    onResetView: fn(),
    onOpenEditor: fn(),
    onRelationSelect: fn(),
    showLabels: true,
  },
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof GraphContextPanel>;
// Trace: DESIGN-storybook-coverage-closure-2026-02-22

export default meta;
type Story = StoryObj<typeof meta>;

export const SelectedNodeDetails: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Graph Controls")).toBeInTheDocument();
    await expect(canvas.getByText("Language Model Evaluation")).toBeInTheDocument();
    await expect(canvas.getByText("english-research/language-model-evaluation.md")).toBeInTheDocument();
  },
};

export const NoNodeSelected: Story = {
  args: {
    selectedTitle: null,
    selectedPath: null,
    neighbors: [],
    backlinks: [],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("No node selected")).toBeInTheDocument();
  },
};

export const NodeScopeDepthControls: Story = {
  args: {
    scope: "node",
    nodeScopeDepth: 2,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Spec: COMP-GRAPH-MODES-002. Scope toggle and node-depth controls invoke the expected callbacks.",
      },
    },
  },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Vault graph" }));
    await userEvent.click(canvas.getByRole("button", { name: "+" }));
    await userEvent.click(canvas.getByRole("button", { name: "-" }));
    await expect(args.onScopeChange).toHaveBeenCalledWith("vault");
    await expect(args.onNodeScopeDepthChange).toHaveBeenCalled();
  },
};

export const RelationSelection: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole("button", { name: "product-docs/roadmap-brief.md" }));
    await userEvent.click(canvas.getByRole("button", { name: "бележки/дневник-на-идеи.md" }));
    await expect(args.onRelationSelect).toHaveBeenCalledWith("product-docs/roadmap-brief.md");
    await expect(args.onRelationSelect).toHaveBeenCalledWith("бележки/дневник-на-идеи.md");
  },
};

export const ActiveRelationHighlight: Story = {
  args: {
    selectedPath: "product-docs/roadmap-brief.md",
  },
  play: async ({ canvas, canvasElement }) => {
    const active = canvas.getByRole("button", { name: "product-docs/roadmap-brief.md" });
    await expect(active).toBeInTheDocument();
    await expect(
      canvasElement.querySelector(".graph-context-panel__relation-item--active")
    ).not.toBeNull();
  },
};
