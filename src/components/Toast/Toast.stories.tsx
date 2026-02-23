import { useCallback } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor } from "storybook/test";
import { ToastContainer } from "./index";
import { useToast } from "@hooks/useToast";

type ToastStoryHarnessProps = {
  shortDurationMs: number;
};

function ToastStoryHarness({ shortDurationMs }: ToastStoryHarnessProps) {
  const { toasts, removeToast, success, error, info, warning } = useToast();

  const addSuccess = useCallback(() => {
    success("Saved note successfully");
  }, [success]);

  const addError = useCallback(() => {
    error("Failed to save note");
  }, [error]);

  const addInfo = useCallback(() => {
    info("Indexing started", shortDurationMs);
  }, [info, shortDurationMs]);

  const addWarning = useCallback(() => {
    warning("Storage almost full");
  }, [warning]);

  return (
    <div style={{ minHeight: 280, padding: 16 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <button onClick={addSuccess} type="button">
          Add Success
        </button>
        <button onClick={addError} type="button">
          Add Error
        </button>
        <button onClick={addInfo} type="button">
          Add Info
        </button>
        <button onClick={addWarning} type="button">
          Add Warning
        </button>
      </div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

const meta = {
  title: "Shell/Toast",
  component: ToastStoryHarness,
  args: {
    shortDurationMs: 120,
  },
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof ToastStoryHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AddAllTypes: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Add Success" }));
    await userEvent.click(canvas.getByRole("button", { name: "Add Error" }));
    await userEvent.click(canvas.getByRole("button", { name: "Add Warning" }));

    await expect(canvas.getByText("Saved note successfully")).toBeInTheDocument();
    await expect(canvas.getByText("Failed to save note")).toBeInTheDocument();
    await expect(canvas.getByText("Storage almost full")).toBeInTheDocument();
  },
};

export const DismissToast: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Add Success" }));
    await expect(canvas.getByText("Saved note successfully")).toBeInTheDocument();

    const dismissButtons = canvas.getAllByRole("button", { name: "Dismiss" });
    await userEvent.click(dismissButtons[0]);

    await waitFor(() => {
      expect(canvas.queryByText("Saved note successfully")).not.toBeInTheDocument();
    });
  },
};

export const AutoDismiss: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Add Info" }));
    await expect(canvas.getByText("Indexing started")).toBeInTheDocument();

    await waitFor(
      () => {
        expect(canvas.queryByText("Indexing started")).not.toBeInTheDocument();
      },
      { timeout: 2500 }
    );
  },
};
