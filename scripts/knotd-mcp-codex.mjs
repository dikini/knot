#!/usr/bin/env node
/* eslint-env node */
// Trace: DESIGN-knotd-mcp-ops

import { existsSync, readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = resolve(dirname(scriptPath), "..");
const explicitConfig = process.env.KNOTD_MCP_CONFIG;
const localConfigPath = explicitConfig
  ? resolve(projectRoot, explicitConfig)
  : resolve(projectRoot, ".mcp/knotd-mcp.json");
const templateConfigPath = resolve(projectRoot, ".mcp/knotd-mcp.example.json");
const manifestPath = resolve(projectRoot, "src-tauri/Cargo.toml");
const knotdBinPath = resolve(projectRoot, "src-tauri/target/debug/knotd");

const selectedConfigPath = existsSync(localConfigPath)
  ? localConfigPath
  : existsSync(templateConfigPath)
    ? templateConfigPath
    : null;

let config = {};
if (selectedConfigPath) {
  try {
    config = JSON.parse(readFileSync(selectedConfigPath, "utf8"));
  } catch (error) {
    console.error(`[knotd-mcp-codex] invalid JSON in ${selectedConfigPath}: ${String(error)}`);
    process.exit(1);
  }
}

const resolvedVaultPath =
  process.env.KNOT_MCP_VAULT_PATH ||
  config.vaultPath ||
  resolve(projectRoot, "test-vault/canonical");

const createIfMissing = Boolean(config.createIfMissing);

function resolveKnotdCommand() {
  if (typeof config.knotdPath === "string" && config.knotdPath.length > 0) {
    return { cmd: config.knotdPath, baseArgs: [] };
  }
  if (typeof process.env.KNOTD_PATH === "string" && process.env.KNOTD_PATH.length > 0) {
    return { cmd: process.env.KNOTD_PATH, baseArgs: [] };
  }
  if (existsSync(knotdBinPath)) {
    return { cmd: knotdBinPath, baseArgs: [] };
  }
  return {
    cmd: "cargo",
    baseArgs: ["run", "--quiet", "--manifest-path", manifestPath, "--bin", "knotd", "--"],
  };
}

const { cmd, baseArgs } = resolveKnotdCommand();
const usesCargoFallback =
  cmd === "cargo" &&
  Array.isArray(baseArgs) &&
  baseArgs.length > 0 &&
  baseArgs[0] === "run";

function resolveProbeMode() {
  const configured = process.env.KNOTD_MCP_STARTUP_PROBE ?? config.startupProbe ?? "auto";
  if (configured === true || configured === "always") return "always";
  if (configured === false || configured === "never" || configured === "off") return "never";
  return "auto";
}

function shouldRunProbe() {
  const probeMode = resolveProbeMode();
  if (probeMode === "always") return true;
  if (probeMode === "never") return false;
  return !usesCargoFallback;
}

function runProbe() {
  const args = [...baseArgs, "--probe-json", "--vault", resolvedVaultPath];
  if (createIfMissing) args.push("--create");

  const probe = spawnSync(cmd, args, {
    cwd: projectRoot,
    env: process.env,
    encoding: "utf8",
  });

  if (probe.error) {
    console.error(`[knotd-mcp-codex] probe failed to execute: ${String(probe.error)}`);
    process.exit(1);
  }

  let parsed;
  try {
    parsed = JSON.parse((probe.stdout ?? "").trim() || "{}");
  } catch (error) {
    console.error(`[knotd-mcp-codex] probe returned invalid JSON: ${String(error)}`);
    if (probe.stdout) console.error(probe.stdout.trim());
    if (probe.stderr) console.error(probe.stderr.trim());
    process.exit(1);
  }

  if (probe.status !== 0 || !parsed.ok) {
    console.error(`[knotd-mcp-codex] probe failed for vault ${resolvedVaultPath}`);
    if (probe.stdout) console.error(probe.stdout.trim());
    if (probe.stderr) console.error(probe.stderr.trim());
    process.exit(1);
  }
}

if (shouldRunProbe()) {
  runProbe();
}

const serveArgs = [...baseArgs, "--vault", resolvedVaultPath];
if (createIfMissing) serveArgs.push("--create");

const child = spawn(cmd, serveArgs, {
  cwd: projectRoot,
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
  console.error(`[knotd-mcp-codex] failed to start serve mode: ${String(error)}`);
  process.exit(1);
});
