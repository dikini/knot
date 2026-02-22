import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent } from "storybook/test";
import { InspectorRail } from "./InspectorRail";

// Trace: DESIGN-storybook-inspector-rail-coverage-2026-02-22
const meta = {
  title: "Shell/InspectorRail",
  component: InspectorRail,
  args: {
    isOpen: true,
    onClose: fn(),
    children: <p>Inspector details for selected note</p>,
  },
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof InspectorRail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OpenWithContent: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("complementary", { name: "Inspector rail" })).toBeInTheDocument();
    await expect(canvas.getByText("Inspector details for selected note")).toBeInTheDocument();
  },
};

export const Closed: Story = {
  args: {
    isOpen: false,
  },
};

export const CloseAction: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Close inspector rail" }));
    await expect(args.onClose).toHaveBeenCalled();
  },
};
