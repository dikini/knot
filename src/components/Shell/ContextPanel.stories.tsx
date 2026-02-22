import type { Meta, StoryObj } from "@storybook/react-vite";
import { ContextPanel } from "./ContextPanel";

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
};

export const SearchMode: Story = {
  args: { mode: "search" },
};

export const GraphMode: Story = {
  args: { mode: "graph" },
};

