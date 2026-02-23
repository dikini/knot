import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ToolRail } from "./ToolRail";

describe("ToolRail", () => {
  it("renders notes/search/graph selectors", () => {
    render(<ToolRail mode="notes" onModeChange={vi.fn()} onOpenSettings={vi.fn()} showLabels={false} />);

    expect(screen.getByRole("button", { name: /notes/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /search/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /graph/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /settings/i })).toBeInTheDocument();
  });

  it("marks active mode", () => {
    render(<ToolRail mode="graph" onModeChange={vi.fn()} onOpenSettings={vi.fn()} showLabels={false} />);

    expect(screen.getByRole("button", { name: /graph/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /notes/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("invokes callback on mode change", () => {
    const onModeChange = vi.fn();
    render(<ToolRail mode="notes" onModeChange={onModeChange} onOpenSettings={vi.fn()} showLabels={false} />);

    fireEvent.click(screen.getByRole("button", { name: /search/i }));

    expect(onModeChange).toHaveBeenCalledWith("search");
  });

  it("hides tool labels by default in icon-only mode", () => {
    render(<ToolRail mode="notes" onModeChange={vi.fn()} onOpenSettings={vi.fn()} showLabels={false} />);
    expect(screen.queryByText("Notes")).not.toBeInTheDocument();
    expect(screen.queryByText("Search")).not.toBeInTheDocument();
    expect(screen.queryByText("Graph")).not.toBeInTheDocument();
  });

  it("shows tool labels when preference is enabled", () => {
    render(<ToolRail mode="notes" onModeChange={vi.fn()} onOpenSettings={vi.fn()} showLabels={true} />);
    expect(screen.getByText("Notes")).toBeInTheDocument();
    expect(screen.getByText("Search")).toBeInTheDocument();
    expect(screen.getByText("Graph")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });
});
