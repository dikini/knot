import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ToolRail } from "./ToolRail";

describe("ToolRail", () => {
  it("renders notes/search/graph selectors", () => {
    render(<ToolRail mode="notes" onModeChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: /notes/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /search/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /graph/i })).toBeInTheDocument();
  });

  it("marks active mode", () => {
    render(<ToolRail mode="graph" onModeChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: /graph/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /notes/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("invokes callback on mode change", () => {
    const onModeChange = vi.fn();
    render(<ToolRail mode="notes" onModeChange={onModeChange} />);

    fireEvent.click(screen.getByRole("button", { name: /search/i }));

    expect(onModeChange).toHaveBeenCalledWith("search");
  });

  it("always shows tool labels", () => {
    render(<ToolRail mode="notes" onModeChange={vi.fn()} />);
    expect(screen.getByText("Notes")).toBeInTheDocument();
    expect(screen.getByText("Search")).toBeInTheDocument();
    expect(screen.getByText("Graph")).toBeInTheDocument();
  });
});
