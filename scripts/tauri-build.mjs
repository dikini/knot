#!/usr/bin/env node
/* eslint-env node */

import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const isLinux = process.platform === "linux";
const wantsAppImage = args.some((arg) => arg.toLowerCase().includes("appimage"));

function check(command, commandArgs, failureLines) {
  const result = spawnSync(command, commandArgs, {
    stdio: "ignore",
    env: process.env,
  });

  if (result.status === 0) {
    return;
  }

  for (const line of failureLines) {
    console.error(line);
  }
  process.exit(result.status ?? 1);
}

if (isLinux && wantsAppImage) {
  check("patchelf", ["--version"], [
    "[tauri-build] missing required host tool 'patchelf' for Linux AppImage bundling",
    "[tauri-build] install it and retry, for example: sudo apt install patchelf",
  ]);

  check("pkg-config", ["--exists", "librsvg-2.0"], [
    "[tauri-build] missing required pkg-config metadata for 'librsvg-2.0'",
    "[tauri-build] install the librsvg development package and retry, for example: sudo apt install librsvg2-dev",
  ]);
}

const env = { ...process.env };
if (isLinux && wantsAppImage) {
  // Some environments cannot FUSE-mount nested helper AppImages used by linuxdeploy.
  env.APPIMAGE_EXTRACT_AND_RUN = "1";
}

const result = spawnSync("tauri", ["build", ...args], {
  stdio: "inherit",
  env,
  shell: true,
});

process.exit(result.status ?? 1);
