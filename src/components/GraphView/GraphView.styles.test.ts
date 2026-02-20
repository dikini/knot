import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("GraphView hover stability styles (COMP-GRAPH-HOVER-001)", () => {
  const cssPath = resolve(process.cwd(), "src/components/GraphView/GraphView.css");
  const css = readFileSync(cssPath, "utf8");

  // SPEC: COMP-GRAPH-HOVER-001 FR-3
  it("does not apply positional transform on .graph-node:hover", () => {
    expect(css).not.toMatch(/\.graph-node:hover\s*\{[^}]*\btransform\s*:/s);
  });

  it("keeps non-positional hover emphasis on node circle", () => {
    expect(css).toMatch(/\.graph-node:hover\s+\.graph-node__circle\s*\{/);
  });
});
