import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Trace: DESIGN-knotd-mcp-ops
const projectRoot = resolve(__dirname, "..", "..");
const localConfigPath = resolve(projectRoot, ".mcp/knotd-mcp.json");
const gitignorePath = resolve(projectRoot, ".gitignore");

describe("knotd MCP local config", () => {
  it("defines a repo-local socket override for the dev daemon runtime", () => {
    expect(existsSync(localConfigPath)).toBe(true);

    const config = JSON.parse(readFileSync(localConfigPath, "utf8")) as {
      socketPath?: string;
    };

    expect(config.socketPath).toBe("/home/dikini/Projects/knot/.run/knotd-dev/knotd.sock");
  });

  it("keeps the local override out of git", () => {
    const gitignore = readFileSync(gitignorePath, "utf8");

    expect(gitignore).toContain(".mcp/knotd-mcp.json");
  });

  it("keeps dev runtime artifacts out of git", () => {
    const gitignore = readFileSync(gitignorePath, "utf8");

    expect(gitignore).toContain(".run/");
  });
});
