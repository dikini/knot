import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InspectorRail } from "./InspectorRail";

describe("InspectorRail", () => {
  it("shows dock affordance when closed", () => {
    render(
      <InspectorRail
        isOpen={false}
        mode="details"
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByLabelText(/inspector rail/i)).not.toBeInTheDocument();
  });

  it("renders when open and closes on action", () => {
    const onClose = vi.fn();
    render(
      <InspectorRail
        isOpen={true}
        mode="details"
        onClose={onClose}
      >
        <p>Details</p>
      </InspectorRail>
    );

    expect(screen.getByRole("complementary", { name: /inspector rail/i })).toBeInTheDocument();
    expect(screen.getByText("Details")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /close inspector rail/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
