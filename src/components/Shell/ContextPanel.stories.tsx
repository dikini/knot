import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { ContextPanel } from "./ContextPanel";

// Trace: DESIGN-storybook-contextpanel-coverage-2026-02-22
const demoNotes = (
  <div style={{ padding: "10px", color: "var(--color-text)" }}>
    <p>Notes explorer snapshot</p>
  </div>
);
const demoSearch = (
  <div style={{ padding: "10px", color: "var(--color-text)" }}>
    <p>Search results snapshot</p>
  </div>
);
const demoGraphControls = (
  <div style={{ padding: "10px", color: "var(--color-text)" }}>
    <p>Graph controls snapshot</p>
  </div>
);
const demoGraphContext = (
  <div style={{ padding: "10px", color: "var(--color-text)" }}>
    <p>Graph context snapshot</p>
  </div>
);

const meta = {
  title: "Shell/ContextPanel",
  component: ContextPanel,
  args: {
    mode: "notes",
    collapsed: false,
    width: 320,
    notesContent: demoNotes,
    searchContent: demoSearch,
    graphControlsContent: demoGraphControls,
    graphContextContent: demoGraphContext,
  },
  render: (args) => (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <ContextPanel {...args} />
      <main style={{ padding: "1rem", color: "var(--color-text)" }}>Main content</main>
    </div>
  ),
} satisfies Meta<typeof ContextPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NotesMode: Story = {
  args: { mode: "notes" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Notes explorer snapshot")).toBeInTheDocument();
  },
};

export const SearchMode: Story = {
  args: { mode: "search" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Search results snapshot")).toBeInTheDocument();
  },
};

export const GraphMode: Story = {
  args: { mode: "graph" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Graph controls snapshot")).toBeInTheDocument();
    await expect(canvas.getByText("Graph context snapshot")).toBeInTheDocument();
  },
};

export const Collapsed: Story = {
  args: {
    collapsed: true,
  },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole("complementary", { name: "Context panel" })).not.toBeInTheDocument();
    await expect(canvas.getByText("Main content")).toBeInTheDocument();
  },
};
