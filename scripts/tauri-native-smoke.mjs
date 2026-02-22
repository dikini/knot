#!/usr/bin/env node
import { spawnSync } from "node:child_process";

function hasCommand(command) {
  const result = spawnSync("bash", ["-lc", `command -v ${command}`], {
    stdio: "ignore",
  });
  return result.status === 0;
}

function runCheck() {
  const checks = [
    ["cargo", hasCommand("cargo")],
    ["npm", hasCommand("npm")],
  ];

  let ok = true;
  for (const [name, passed] of checks) {
    if (!passed) {
      ok = false;
      console.error(`[tauri-smoke] missing dependency: ${name}`);
    }
  }

  if (!ok) process.exit(1);

  console.log("[tauri-smoke] check mode passed.");
  console.log("[tauri-smoke] next: run `npm run tauri dev` and follow docs/testing/tauri-native-smoke.md.");
}

runCheck();

