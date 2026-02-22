import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent } from "storybook/test";
import { Network, Save, SquarePen } from "lucide-react";
import { IconButton } from "./index";

// Trace: DESIGN-storybook-iconbutton-coverage-2026-02-22
const meta = {
  title: "Primitives/IconButton",
  component: IconButton,
  args: {
    icon: Save,
    label: "Save",
    showLabel: true,
    active: false,
    disabled: false,
    onClick: fn(),
  },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Spec: COMP-ICON-CHROME-001 FR-5. Button renders icon + label with accessible name.",
      },
    },
  },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await expect(args.onClick).toHaveBeenCalled();
  },
};

export const IconOnly: Story = {
  args: {
    icon: SquarePen,
    label: "Edit",
    showLabel: false,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  },
};

export const Active: Story = {
  args: {
    icon: Network,
    label: "Graph",
    showLabel: true,
    active: true,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Graph" })).toHaveClass("icon-button--active");
  },
};
