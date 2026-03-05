#!/usr/bin/env node
/* eslint-env node */

import { chmodSync, copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const projectRoot = resolve(new URL("..", import.meta.url).pathname);
const srcTauriRoot = resolve(projectRoot, "src-tauri");
const binariesDir = resolve(srcTauriRoot, "binaries");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
    ...options,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function detectTargetTriple() {
  if (process.env.CARGO_BUILD_TARGET && process.env.CARGO_BUILD_TARGET.trim()) {
    return process.env.CARGO_BUILD_TARGET.trim();
  }
  const result = spawnSync("rustc", ["-vV"], { cwd: projectRoot, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error("failed to detect rust target triple via rustc -vV");
  }
  const line = result.stdout
    .split("\n")
    .find((entry) => entry.startsWith("host: "));
  if (!line) {
    throw new Error("rustc -vV did not return a host triple");
  }
  return line.slice("host: ".length).trim();
}

const targetTriple = detectTargetTriple();

run("cargo", ["build", "--manifest-path", "src-tauri/Cargo.toml", "--release", "--bin", "knotd"]);

const sourceBinary = resolve(srcTauriRoot, "target", "release", "knotd");
if (!existsSync(sourceBinary)) {
  throw new Error(`expected knotd binary at ${sourceBinary}`);
}

const stagedBinary = resolve(binariesDir, `knotd-${targetTriple}`);
mkdirSync(dirname(stagedBinary), { recursive: true });
copyFileSync(sourceBinary, stagedBinary);
chmodSync(stagedBinary, 0o755);

console.log(`[prepare-tauri-sidecars] staged ${stagedBinary}`);
