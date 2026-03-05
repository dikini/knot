#!/usr/bin/env node
/* eslint-env node */

import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const result = spawnSync("tauri", ["build", ...args], {
  stdio: "inherit",
  env: process.env,
  shell: true,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
