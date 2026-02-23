#!/usr/bin/env node
/* eslint-env node */
// Trace: DESIGN-daemon-ui-ipc-cutover

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import net from "node:net";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

function hasCommand(command) {
  const result = spawnSync("bash", ["-lc", `command -v ${command}`], { stdio: "ignore" });
  return result.status === 0;
}

function parseTimeoutSeconds(argv) {
  const timeoutArg = argv.find((arg) => arg.startsWith("--timeout="));
  if (!timeoutArg) return 180;
  const parsed = Number(timeoutArg.split("=")[1]);
  if (!Number.isFinite(parsed) || parsed <= 0) return 180;
  return Math.floor(parsed);
}

function tail(text, lines = 60) {
  return text
    .split("\n")
    .slice(-lines)
    .join("\n");
}

function waitForSocket(path, timeoutMs) {
  return new Promise((resolveWait, rejectWait) => {
    const deadline = Date.now() + timeoutMs;

    const tryConnect = () => {
      const client = net.createConnection({ path });
      client.once("connect", () => {
        client.end();
        resolveWait();
      });
      client.once("error", () => {
        if (Date.now() >= deadline) {
          rejectWait(new Error(`timed out waiting for socket ${path}`));
          return;
        }
        setTimeout(tryConnect, 100);
      });
    };

    tryConnect();
  });
}

async function stopProcess(child, name) {
  if (!child || child.killed) return;

  await new Promise((resolveStop) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolveStop();
    };

    child.once("exit", finish);
    child.kill("SIGTERM");
    setTimeout(() => {
      if (done) return;
      child.kill("SIGKILL");
      finish();
    }, 2000);
  });
}

function runCheck() {
  const checks = [
    ["cargo", hasCommand("cargo")],
    ["npm", hasCommand("npm")],
    ["node", hasCommand("node")],
  ];

  let ok = true;
  for (const [name, passed] of checks) {
    if (!passed) {
      ok = false;
      console.error(`[tauri-daemon-smoke] missing dependency: ${name}`);
    }
  }

  if (!ok) process.exit(1);

  console.log("[tauri-daemon-smoke] check mode passed.");
  console.log("[tauri-daemon-smoke] next: run with --launch-smoke (prefer xvfb-run in headless environments)");
}

async function runLaunchSmoke(timeoutSeconds) {
  const socketPath = process.env.KNOTD_SMOKE_SOCKET || "/tmp/knotd-tauri-smoke.sock";
  const explicitVaultPath = process.env.KNOTD_SMOKE_VAULT;
  let tempVaultRoot = null;
  const vaultPath = explicitVaultPath
    ? resolve(explicitVaultPath)
    : (() => {
        tempVaultRoot = mkdtempSync(join(tmpdir(), "knotd-tauri-smoke-vault-"));
        return resolve(tempVaultRoot);
      })();
  const knotdBin = resolve(process.env.KNOTD_SMOKE_KNOTD_BIN || "src-tauri/target/debug/knotd");
  const tauriCmd = process.env.TAURI_DAEMON_SMOKE_CMD || "npm run tauri dev -- --no-watch";

  console.log(`[tauri-daemon-smoke] socket=${socketPath}`);
  console.log(`[tauri-daemon-smoke] vault=${vaultPath}`);

  if (existsSync(socketPath)) {
    rmSync(socketPath, { force: true });
  }

  if (!existsSync(knotdBin)) {
    console.log("[tauri-daemon-smoke] knotd binary missing; building...");
    const build = spawnSync(
      "cargo",
      ["build", "--manifest-path", "src-tauri/Cargo.toml", "--bin", "knotd"],
      { encoding: "utf8" }
    );
    if (build.status !== 0) {
      console.error("[tauri-daemon-smoke] failed to build knotd");
      console.error(tail(`${build.stdout || ""}\n${build.stderr || ""}`));
      process.exit(1);
    }
  }

  if (!explicitVaultPath) {
    const init = spawnSync(knotdBin, ["--check", "--create", "--vault", vaultPath], {
      env: process.env,
      encoding: "utf8",
    });
    if (init.status !== 0) {
      console.error("[tauri-daemon-smoke] failed to initialize temporary smoke vault");
      console.error(tail(`${init.stdout || ""}\n${init.stderr || ""}`));
      process.exit(1);
    }
  }

  const knotd = spawn(knotdBin, ["--listen-unix", socketPath, "--vault", vaultPath], {
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let knotdOut = "";
  knotd.stdout.on("data", (chunk) => {
    knotdOut += chunk.toString("utf8");
  });
  knotd.stderr.on("data", (chunk) => {
    knotdOut += chunk.toString("utf8");
  });

  try {
    await waitForSocket(socketPath, 10000);
    console.log("[tauri-daemon-smoke] knotd socket ready");

    const tauri = spawnSync("bash", ["-lc", `timeout ${timeoutSeconds}s ${tauriCmd}`], {
      env: {
        ...process.env,
        KNOT_UI_RUNTIME_MODE: "daemon_ipc",
        KNOTD_SOCKET_PATH: socketPath,
      },
      encoding: "utf8",
    });

    const output = `${tauri.stdout || ""}\n${tauri.stderr || ""}`;
    const startupSignal = /(tauri|running|dev server|ready|frontend)/i.test(output);

    if ((tauri.status === 124 || tauri.status === 0) && startupSignal) {
      console.log("[tauri-daemon-smoke] launch smoke passed");
      return;
    }

    console.error("[tauri-daemon-smoke] launch smoke failed");
    console.error(`[tauri-daemon-smoke] exit status: ${tauri.status}`);
    console.error(tail(output));
    process.exit(1);
  } finally {
    await stopProcess(knotd, "knotd");
    knotd.stdout?.destroy();
    knotd.stderr?.destroy();
    if (existsSync(socketPath)) {
      rmSync(socketPath, { force: true });
    }
    if (tempVaultRoot && existsSync(tempVaultRoot)) {
      rmSync(tempVaultRoot, { recursive: true, force: true });
    }
  }
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
  runLaunchSmoke(timeoutSeconds).catch((error) => {
    console.error(`[tauri-daemon-smoke] fatal: ${String(error?.stack || error)}`);
    process.exit(1);
  });
}
