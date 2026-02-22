#!/usr/bin/env node
/* eslint-env node */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const configPath = process.env.STORYBOOK_MCP_CONFIG ?? ".mcp/storybook-mcp.json";
const absolute = resolve(process.cwd(), configPath);

if (!existsSync(absolute)) {
  console.error(`[storybook-mcp] missing config: ${configPath}`);
  console.error("[storybook-mcp] copy .mcp/storybook-mcp.example.json and adapt to your environment.");
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse(readFileSync(absolute, "utf8"));
} catch (error) {
  console.error(`[storybook-mcp] invalid JSON in ${configPath}: ${String(error)}`);
  process.exit(1);
}

if (!parsed || typeof parsed !== "object") {
  console.error("[storybook-mcp] config must be a JSON object.");
  process.exit(1);
}

const hasServer = Object.prototype.hasOwnProperty.call(parsed, "server");
const hasBaseUrl = Object.prototype.hasOwnProperty.call(parsed, "baseUrl");

if (!hasServer && !hasBaseUrl) {
  console.error("[storybook-mcp] config must include `server` or `baseUrl`.");
  process.exit(1);
}

console.log(`[storybook-mcp] config OK: ${configPath}`);
