import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent } from "storybook/test";
import { ToolRail } from "./ToolRail";
import type { ShellToolMode } from "@lib/store";

// Trace: DESIGN-storybook-toolrail-coverage-2026-02-22
function ToolRailPreview({ mode, showLabels }: { mode: ShellToolMode; showLabels: boolean }) {
  const [activeMode, setActiveMode] = useState<ShellToolMode>(mode);
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <ToolRail
        mode={activeMode}
        showLabels={showLabels}
        onModeChange={(next) => setActiveMode(next)}
      />
      <main style={{ padding: "1rem", color: "var(--color-text)" }}>
        Active mode: <strong>{activeMode}</strong>
      </main>
    </div>
  );
}

const meta = {
  title: "Shell/ToolRail",
  component: ToolRail,
  args: {
    mode: "notes",
    showLabels: false,
    onModeChange: fn(),
  },
  render: (args) => {
    return <ToolRailPreview mode={args.mode} showLabels={args.showLabels} />;
  },
} satisfies Meta<typeof ToolRail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Compact: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Spec: COMP-TOOL-RAIL-CONTEXT-001 FR-1/FR-2 and COMP-ICON-CHROME-001 FR-1/FR-3. Compact icon-first mode switching.",
      },
    },
  },
};

export const WithLabels: Story = {
  args: {
    showLabels: true,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Notes" })).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Search" })).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Graph" })).toBeInTheDocument();
  },
};

export const ModeSwitchInteraction: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Graph" }));
    await expect(canvas.getByText("graph")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Search" }));
    await expect(canvas.getByText("search")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Notes" }));
    await expect(canvas.getByText("notes")).toBeInTheDocument();
  },
};
