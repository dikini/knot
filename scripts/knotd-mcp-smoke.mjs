#!/usr/bin/env node
/* eslint-env node */
// Trace: DESIGN-knotd-mcp-ops

import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const projectRoot = process.cwd();
const manifestPath = resolve(projectRoot, "src-tauri/Cargo.toml");
const tempVault = mkdtempSync(join(tmpdir(), "knotd-smoke-"));

function runKnotd(args, expectedExit = 0) {
  const result = spawnSync(
    "cargo",
    ["run", "--quiet", "--manifest-path", manifestPath, "--bin", "knotd", "--", ...args],
    { cwd: projectRoot, env: process.env, encoding: "utf8" }
  );

  if (result.error) throw result.error;
  if (result.status !== expectedExit) {
    throw new Error(
      `knotd ${args.join(" ")} exited ${result.status}, expected ${expectedExit}\nstdout=${result.stdout}\nstderr=${result.stderr}`
    );
  }
  return result;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const caps = runKnotd(["--print-capabilities"]);
const capsJson = JSON.parse(caps.stdout.trim());
assert(Array.isArray(capsJson.flags), "capabilities flags missing");
assert(capsJson.flags.includes("--probe-json"), "capabilities missing --probe-json");

const probeJson = runKnotd(["--probe-json", "--create", "--vault", tempVault]);
const probe = JSON.parse(probeJson.stdout.trim());
assert(probe.ok === true, "probe-json expected ok=true");

const probeLine = runKnotd(["--check", "--vault", tempVault]);
assert(probeLine.stdout.includes("mode=probe"), "probe line missing mode=probe");
assert(probeLine.stdout.includes("lock_status="), "probe line missing lock status");

const status = runKnotd(["--status", "--vault", tempVault]);
const statusJson = JSON.parse(status.stdout.trim());
assert(statusJson.mode === "status", "status mode mismatch");

const help = runKnotd(["--help"]);
assert(help.stdout.includes("--print-capabilities"), "help missing capabilities mode");
assert(help.stdout.includes("--version"), "help missing version flag");

const version = runKnotd(["--version"]);
assert(version.stdout.trim().startsWith("knotd "), "version output should start with 'knotd '");

console.log("[knotd-mcp] smoke OK");
