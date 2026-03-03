#!/usr/bin/env node
/* eslint-env node */
// Trace: DESIGN-knotd-dev-lifecycle

import { spawnSync } from "node:child_process";
import path from "node:path";

function toError(error, fallback) {
  return error instanceof Error ? error : new Error(fallback);
}

function formatCommand(command, args) {
  return [command, ...args].join(" ");
}

export function resolveDaemonSmokeRuntime({ repoRoot = process.cwd(), env = process.env } = {}) {
  const runDir = env.KNOT_DEV_RUN_DIR || path.join(repoRoot, ".run", "knotd-dev");
  const socketPath = env.KNOTD_SOCKET_PATH || path.join(runDir, "knotd.sock");

  return {
    repoRoot,
    runDir,
    socketPath,
    env: {
      ...env,
      KNOT_DEV_RUN_DIR: runDir,
      KNOTD_SOCKET_PATH: socketPath,
    },
  };
}

function defaultRunCommand({ command, args, env, repoRoot }) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env,
    stdio: "inherit",
    encoding: "utf8",
  });

  if (result.error) {
    throw result.error;
  }

  return {
    status: result.status ?? 1,
    stderr: result.stderr ?? "",
    stdout: result.stdout ?? "",
  };
}

function runStep({ label, command, args, runtime, runCommand, log }) {
  log("");
  log(`==> ${label}`);
  const result = runCommand({
    command,
    args,
    env: runtime.env,
    repoRoot: runtime.repoRoot,
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    const detail = stderr || stdout;
    throw new Error(
      detail
        ? `${label} failed (${formatCommand(command, args)}): ${detail}`
        : `${label} failed (${formatCommand(command, args)})`
    );
  }
}

export function runLocalCiDaemonSmoke({
  repoRoot = process.cwd(),
  env = process.env,
  runCommand = defaultRunCommand,
  log = console.log,
} = {}) {
  const runtime = resolveDaemonSmokeRuntime({ repoRoot, env });
  let primaryError = null;
  let teardownError = null;

  runStep({
    label: "Repo-managed daemon prerequisite check",
    command: "bash",
    args: ["scripts/dev-up.sh", "--check"],
    runtime,
    runCommand,
    log,
  });

  try {
    runStep({
      label: "Repo-managed daemon bootstrap",
      command: "bash",
      args: ["scripts/dev-up.sh"],
      runtime,
      runCommand,
      log,
    });

    runStep({
      label: "knotd MCP triage",
      command: "npm",
      args: ["run", "-s", "knotd:triage"],
      runtime,
      runCommand,
      log,
    });
  } catch (error) {
    primaryError = toError(error, "Daemon smoke failed");
  } finally {
    try {
      runStep({
        label: "Repo-managed daemon teardown",
        command: "bash",
        args: ["scripts/dev-down.sh"],
        runtime,
        runCommand,
        log,
      });
    } catch (error) {
      teardownError = toError(error, "Daemon teardown failed");
    }
  }

  if (primaryError && teardownError) {
    throw new Error(`${primaryError.message}; ${teardownError.message}`);
  }
  if (primaryError) {
    throw primaryError;
  }
  if (teardownError) {
    throw teardownError;
  }

  return runtime;
}

function main() {
  try {
    runLocalCiDaemonSmoke();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main();
}
