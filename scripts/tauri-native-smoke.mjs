#!/usr/bin/env node
import { spawnSync } from "node:child_process";

function hasCommand(command) {
  const result = spawnSync("bash", ["-lc", `command -v ${command}`], {
    stdio: "ignore",
  });
  return result.status === 0;
}

function parseTimeoutSeconds(argv) {
  const timeoutArg = argv.find((arg) => arg.startsWith("--timeout="));
  if (!timeoutArg) return 180;
  const parsed = Number(timeoutArg.split("=")[1]);
  if (!Number.isFinite(parsed) || parsed <= 0) return 180;
  return Math.floor(parsed);
}

function tail(text, lines = 40) {
  return text
    .split("\n")
    .slice(-lines)
    .join("\n");
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
  console.log("[tauri-smoke] next: run `npm run tauri dev` and follow docs/testing/tauri-native-smoke.md");
}

function runLaunchSmoke(timeoutSeconds) {
  const launchCmd = process.env.TAURI_SMOKE_CMD ?? "npm run tauri dev -- --no-watch";
  console.log(`[tauri-smoke] launch mode: ${launchCmd}`);
  console.log(`[tauri-smoke] timeout: ${timeoutSeconds}s`);

  const result = spawnSync(
    "bash",
    ["-lc", `timeout ${timeoutSeconds}s ${launchCmd}`],
    { encoding: "utf8" }
  );

  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const startupSignal = /(tauri|running|dev server|ready|frontend)/i.test(output);

  if ((result.status === 124 || result.status === 0) && startupSignal) {
    console.log("[tauri-smoke] launch smoke passed.");
    return;
  }

  console.error("[tauri-smoke] launch smoke failed.");
  console.error(`[tauri-smoke] exit status: ${result.status}`);
  if (output.trim()) {
    console.error("[tauri-smoke] output tail:");
    console.error(tail(output));
  }
  process.exit(1);
}

const args = process.argv.slice(2);
const launchSmoke = args.includes("--launch-smoke");
const checkOnly = args.includes("--check") || (!launchSmoke && args.length === 0);
const timeoutSeconds = parseTimeoutSeconds(args);

runCheck();
if (checkOnly && !launchSmoke) {
  process.exit(0);
}
if (launchSmoke) {
  runLaunchSmoke(timeoutSeconds);
}
