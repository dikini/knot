#!/usr/bin/env node
/* eslint-env node */
// Trace: DESIGN-knotd-mcp-ops

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { homedir } from "node:os";

const wrapperPath = resolve(homedir(), ".local/bin/knot");

console.error(
  "[deprecated] scripts/setup-codex-knotd-mcp.mjs now installs the native Knot MCP bridge."
);
console.error("[deprecated] preferred command: knot mcp codex install");

if (!existsSync(wrapperPath)) {
  console.error(`[setup-codex-knotd-mcp] missing wrapper at ${wrapperPath}`);
  console.error("[setup-codex-knotd-mcp] install knot into ~/.local/bin first, then rerun.");
  process.exit(1);
}

const result = spawnSync(wrapperPath, ["mcp", "codex", "install"], {
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 1);
