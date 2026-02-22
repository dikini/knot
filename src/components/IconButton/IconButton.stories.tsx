import type { Meta, StoryObj } from "@storybook/react-vite";
import { Network, Save, SquarePen } from "lucide-react";
import { IconButton } from "./index";

const meta = {
  title: "Primitives/IconButton",
  component: IconButton,
  args: {
    icon: Save,
    label: "Save",
    showLabel: true,
    active: false,
    disabled: false,
  },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const IconOnly: Story = {
  args: {
    icon: SquarePen,
    label: "Edit",
    showLabel: false,
  },
};

export const Active: Story = {
  args: {
    icon: Network,
    label: "Graph",
    showLabel: true,
    active: true,
  },
};

