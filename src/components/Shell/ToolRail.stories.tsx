import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ToolRail } from "./ToolRail";
import type { ShellToolMode } from "@lib/store";

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

export const Compact: Story = {};

export const WithLabels: Story = {
  args: {
    showLabels: true,
  },
};
