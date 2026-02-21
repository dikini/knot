import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GraphContextPanel } from "./GraphContextPanel";

describe("GraphContextPanel", () => {
  const defaultScopeProps = {
    scope: "vault" as const,
    nodeScopeDepth: 1,
    onScopeChange: vi.fn(),
    onNodeScopeDepthChange: vi.fn(),
  };

  it("shows controls and empty state without selected node", () => {
    render(
      <GraphContextPanel
        {...defaultScopeProps}
        selectedTitle={null}
        selectedPath={null}
        neighbors={[]}
        backlinks={[]}
        onResetView={vi.fn()}
        onOpenEditor={vi.fn()}
      />
    );

    expect(screen.getByText("Graph Controls")).toBeInTheDocument();
    expect(screen.getByText("No node selected")).toBeInTheDocument();
  });

  it("shows selected node details and lists", () => {
    render(
      <GraphContextPanel
        {...defaultScopeProps}
        selectedTitle="My Note"
        selectedPath="notes/my-note.md"
        neighbors={["a.md", "b.md"]}
        backlinks={["c.md"]}
        onResetView={vi.fn()}
        onOpenEditor={vi.fn()}
      />
    );

    expect(screen.getByText("My Note")).toBeInTheDocument();
    expect(screen.getByText("notes/my-note.md")).toBeInTheDocument();
    expect(screen.getByText("a.md")).toBeInTheDocument();
    expect(screen.getByText("c.md")).toBeInTheDocument();
  });

  it("fires control actions", () => {
    const onResetView = vi.fn();
    const onOpenEditor = vi.fn();
    const onScopeChange = vi.fn();
    const onNodeScopeDepthChange = vi.fn();

    render(
      <GraphContextPanel
        scope="node"
        nodeScopeDepth={2}
        onScopeChange={onScopeChange}
        onNodeScopeDepthChange={onNodeScopeDepthChange}
        selectedTitle={null}
        selectedPath={null}
        neighbors={[]}
        backlinks={[]}
        onResetView={onResetView}
        onOpenEditor={onOpenEditor}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    fireEvent.click(screen.getByRole("button", { name: /editor/i }));
    fireEvent.click(screen.getByRole("button", { name: /vault graph/i }));
    fireEvent.click(screen.getByRole("button", { name: "+" }));

    expect(onResetView).toHaveBeenCalledTimes(1);
    expect(onOpenEditor).toHaveBeenCalledTimes(1);
    expect(onScopeChange).toHaveBeenCalledWith("vault");
    expect(onNodeScopeDepthChange).toHaveBeenCalledWith(3);
  });
});
