import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ContextPanel } from "./ContextPanel";

const defaultProps = {
  collapsed: false,
  width: 320,
  onToggleCollapse: vi.fn(),
  notesContent: <div>Notes Slot</div>,
  searchContent: <div>Search Slot</div>,
  graphControlsContent: <div>Graph Controls</div>,
  graphContextContent: <div>Graph Context</div>,
} as const;

describe("ContextPanel", () => {
  it("renders notes mode content", () => {
    render(<ContextPanel {...defaultProps} mode="notes" />);
    expect(screen.getByText("Notes Slot")).toBeInTheDocument();
    expect(screen.queryByText("Search Slot")).not.toBeInTheDocument();
  });

  it("renders search mode content", () => {
    render(<ContextPanel {...defaultProps} mode="search" />);
    expect(screen.getByText("Search Slot")).toBeInTheDocument();
    expect(screen.queryByText("Notes Slot")).not.toBeInTheDocument();
  });

  it("renders graph split sections", () => {
    render(<ContextPanel {...defaultProps} mode="graph" />);
    expect(screen.getByText("Graph Controls")).toBeInTheDocument();
    expect(screen.getByText("Graph Context")).toBeInTheDocument();
  });

  it("renders collapsed state and toggles", () => {
    const onToggleCollapse = vi.fn();
    render(<ContextPanel {...defaultProps} mode="notes" collapsed={true} onToggleCollapse={onToggleCollapse} />);

    fireEvent.click(screen.getByRole("button", { name: /expand context panel/i }));
    expect(onToggleCollapse).toHaveBeenCalledTimes(1);
  });
});
