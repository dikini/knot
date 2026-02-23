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
  parameters: {
    docs: {
      description: {
        story: "Spec: COMP-SEARCH-UI-001. Query renders deterministic results and selecting a result emits path callback.",
      },
    },
  },
  play: async ({ canvas, canvasElement, args }) => {
    const input = canvas.getByLabelText("Search notes");
    await userEvent.type(input, "graph");

    let secondResult: Element | null = null;
    await waitFor(() => {
      secondResult = canvasElement.querySelector("#search-result-1");
      expect(secondResult).not.toBeNull();
      expect(secondResult?.textContent ?? "").toContain("Graph");
      expect(secondResult?.textContent ?? "").toContain("Mode");
    });

    await userEvent.click(secondResult as Element);
    await expect(args.onResultSelect).toHaveBeenCalledWith("notes/graph-mode.md");
  },
};

export const KeyboardSelectFirstResult: Story = {
  beforeEach: async () => {
    mocked(searchNotes).mockResolvedValue([
      {
        path: "notes/keyboard-a.md",
        title: "Keyboard Alpha",
        excerpt: "First result",
        score: 0.95,
      },
      {
        path: "notes/keyboard-b.md",
        title: "Keyboard Beta",
        excerpt: "Second result",
        score: 0.91,
      },
    ]);
  },
  parameters: {
    docs: {
      description: {
        story:
          "Spec: COMP-SEARCH-UI-001 FR-3/FR-4/FR-5. Keyboard Arrow navigation and Enter selection in search results.",
      },
    },
  },
  play: async ({ canvas, canvasElement, args }) => {
    const input = canvas.getByLabelText("Search notes");
    await userEvent.type(input, "keyboard");
    let firstResult: Element | null = null;
    await waitFor(() => {
      firstResult = canvasElement.querySelector("#search-result-0");
      expect(firstResult).not.toBeNull();
      expect(firstResult?.textContent ?? "").toContain("Keyboard");
      expect(firstResult?.textContent ?? "").toContain("Alpha");
    });
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{Enter}");
    await expect(args.onResultSelect).toHaveBeenCalledWith("notes/keyboard-b.md");
  },
};

export const NoResults: Story = {
  beforeEach: async () => {
    mocked(searchNotes).mockResolvedValue([]);
  },
  parameters: {
    docs: {
      description: {
        story: "Spec: COMP-SEARCH-UI-001. Empty-result state is shown for unmatched query terms.",
      },
    },
  },
  play: async ({ canvas }) => {
    const input = canvas.getByLabelText("Search notes");
    await userEvent.type(input, "missing-term");
    await waitFor(() => {
      expect(canvas.getByText("No notes found")).toBeInTheDocument();
    });
  },
};
