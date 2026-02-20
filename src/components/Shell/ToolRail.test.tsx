import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ToolRail } from "./ToolRail";

describe("ToolRail", () => {
  it("renders notes/search/graph selectors", () => {
    render(
      <ToolRail
        mode="notes"
        collapsed={false}
        onModeChange={vi.fn()}
        onToggleCollapse={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /notes/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /search/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /graph/i })).toBeInTheDocument();
  });

  it("marks active mode", () => {
    render(
      <ToolRail
        mode="graph"
        collapsed={false}
        onModeChange={vi.fn()}
        onToggleCollapse={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /graph/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /notes/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("invokes callbacks on mode and collapse", () => {
    const onModeChange = vi.fn();
    const onToggleCollapse = vi.fn();
    render(
      <ToolRail
        mode="notes"
        collapsed={false}
        onModeChange={onModeChange}
        onToggleCollapse={onToggleCollapse}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /search/i }));
    fireEvent.click(screen.getByRole("button", { name: /collapse tool rail/i }));

    expect(onModeChange).toHaveBeenCalledWith("search");
    expect(onToggleCollapse).toHaveBeenCalledTimes(1);
  });

  it("hides labels when collapsed", () => {
    render(
      <ToolRail
        mode="notes"
        collapsed={true}
        onModeChange={vi.fn()}
        onToggleCollapse={vi.fn()}
      />
    );

    expect(screen.queryByText("Notes")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /expand tool rail/i })).toBeInTheDocument();
  });
});
