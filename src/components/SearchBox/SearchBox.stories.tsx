import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, mocked, userEvent, waitFor } from "storybook/test";
import { SearchBox } from "./index";
import { searchNotes } from "@lib/api";

// Trace: DESIGN-storybook-searchbox-coverage-2026-02-22
const meta = {
  title: "Sidebar/SearchBox",
  component: SearchBox,
  args: {
    onResultSelect: fn(),
  },
  beforeEach: async () => {
    mocked(searchNotes).mockResolvedValue([]);
  },
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof SearchBox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FocusedEmptyState: Story = {
  play: async ({ canvas }) => {
    const input = canvas.getByLabelText("Search notes");
    await userEvent.click(input);
    await expect(canvas.getByText("Type to search")).toBeInTheDocument();
  },
};

export const QueryWithResults: Story = {
  beforeEach: async () => {
    mocked(searchNotes).mockResolvedValue([
      {
        path: "notes/editor-flow.md",
        title: "Editor Flow",
        excerpt: "Mode switch behavior and markdown fidelity",
        score: 0.92,
      },
      {
        path: "notes/graph-mode.md",
        title: "Graph Mode",
        excerpt: "Graph scope and node depth controls",
        score: 0.85,
      },
    ]);
  },
  play: async ({ canvas, args }) => {
    const input = canvas.getByLabelText("Search notes");
    await userEvent.type(input, "graph");

    await waitFor(() => {
      expect(canvas.getByText("Graph Mode")).toBeInTheDocument();
    });

    await userEvent.click(canvas.getByText("Graph Mode"));
    await expect(args.onResultSelect).toHaveBeenCalledWith("notes/graph-mode.md");
  },
};

export const NoResults: Story = {
  beforeEach: async () => {
    mocked(searchNotes).mockResolvedValue([]);
  },
  play: async ({ canvas }) => {
    const input = canvas.getByLabelText("Search notes");
    await userEvent.type(input, "missing-term");
    await waitFor(() => {
      expect(canvas.getByText("No notes found")).toBeInTheDocument();
    });
  },
};
