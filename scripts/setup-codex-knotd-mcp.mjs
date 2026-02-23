#!/usr/bin/env node
/* eslint-env node */
// Trace: DESIGN-knotd-mcp-ops

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { homedir } from "node:os";

const projectRoot = resolve(process.cwd());
const codexConfigPath = resolve(homedir(), ".codex/config.toml");
const launcherPath = resolve(projectRoot, "scripts/knotd-mcp-codex.mjs");
const beginMarker = "# >>> knot-vault-mcp >>>";
const endMarker = "# <<< knot-vault-mcp <<<";
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const blockLines = [
  beginMarker,
  "[mcp_servers.knot_vault]",
  'command = "node"',
  `args = ["${launcherPath}"]`,
  "startup_timeout_sec = 60",
  endMarker,
  "",
];
const block = blockLines.join("\n");

let content = "";
if (existsSync(codexConfigPath)) {
  content = readFileSync(codexConfigPath, "utf8");
} else {
  mkdirSync(dirname(codexConfigPath), { recursive: true });
}

const markerPattern = new RegExp(
  `${escapeRegExp(beginMarker)}[\\s\\S]*?${escapeRegExp(endMarker)}\\n?`,
  "g"
);

const next = markerPattern.test(content)
  ? content.replace(markerPattern, block)
  : `${content}${content.endsWith("\n") || content.length === 0 ? "" : "\n"}${block}`;

writeFileSync(codexConfigPath, next, "utf8");
console.log(`[codex] configured knot_vault MCP for project at ${projectRoot}`);
console.log(`[codex] updated ${codexConfigPath}`);
