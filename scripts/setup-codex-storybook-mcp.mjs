#!/usr/bin/env node
/* eslint-env node */
// Trace: DESIGN-storybook-dx-001

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { homedir } from "node:os";

const projectRoot = resolve(process.cwd());
const codexConfigPath = resolve(homedir(), ".codex/config.toml");
const launcherPath = resolve(projectRoot, "scripts/storybook-mcp-codex.mjs");
const beginMarker = "# >>> knot-storybook-mcp >>>";
const endMarker = "# <<< knot-storybook-mcp <<<";
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const blockLines = [
  beginMarker,
  "[mcp_servers.storybook_knot]",
  'command = "node"',
  `args = ["${launcherPath}"]`,
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
console.log(`[codex] configured Storybook MCP for project at ${projectRoot}`);
console.log(`[codex] updated ${codexConfigPath}`);
