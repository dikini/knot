#!/usr/bin/env node
/* eslint-env node */
// Trace: DESIGN-storybook-dx-001

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = process.cwd();
const explicitConfig = process.env.STORYBOOK_MCP_CONFIG;
const localConfigPath = explicitConfig
  ? resolve(projectRoot, explicitConfig)
  : resolve(projectRoot, ".mcp/storybook-mcp.json");
const templateConfigPath = resolve(projectRoot, ".mcp/storybook-mcp.example.json");

const selectedConfigPath = existsSync(localConfigPath)
  ? localConfigPath
  : existsSync(templateConfigPath)
    ? templateConfigPath
    : null;

let endpoint = "http://127.0.0.1:6006/mcp";

if (selectedConfigPath) {
  try {
    const parsed = JSON.parse(readFileSync(selectedConfigPath, "utf8"));
    if (parsed && typeof parsed === "object") {
      if (typeof parsed.url === "string" && parsed.url.length > 0) {
        endpoint = parsed.url;
      } else if (typeof parsed.baseUrl === "string" && parsed.baseUrl.length > 0) {
        const mcpPath =
          typeof parsed.mcpPath === "string" && parsed.mcpPath.length > 0
            ? parsed.mcpPath
            : "/mcp";
        endpoint = new URL(mcpPath, parsed.baseUrl).toString();
      }
    }
  } catch (error) {
    console.error(
      `[storybook-mcp-codex] invalid JSON in ${selectedConfigPath}: ${String(error)}`
    );
    process.exit(1);
  }
}

const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
const child = spawn(npxCmd, ["-y", "mcp-remote", endpoint], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error(
    `[storybook-mcp-codex] failed to start mcp-remote for ${endpoint}: ${String(error)}`
  );
  process.exit(1);
});
