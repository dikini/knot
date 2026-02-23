#!/usr/bin/env node
/* eslint-env node */
// Trace: BUG-knotd-mcp-startup-handshake-timeout

import { spawnSync } from "node:child_process";

const childTimeoutMs = Number(process.env.KNOTD_TRIAGE_CHILD_TIMEOUT_MS || 70000);

const runs = [
  {
    id: "daemon_smoke",
    label: "Daemon Open/New/Close Smoke",
    command: ["node", "scripts/knotd-daemon-open-new-smoke.mjs"],
  },
  {
    id: "startup_trace_socket",
    label: "Startup Trace (socket)",
    command: ["node", "scripts/knotd-mcp-startup-trace.mjs"],
  },
  {
    id: "startup_trace_bridge",
    label: "Startup Trace (bridge)",
    command: ["node", "scripts/knotd-mcp-startup-trace.mjs"],
    env: { KNOTD_STARTUP_TRACE_TRANSPORT: "bridge" },
  },
];

function parseJsonFromText(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const direct = (() => {
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  })();
  if (direct) return direct;

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const candidate = trimmed.slice(start, end + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      return null;
    }
  }

  return null;
}

function stageFromTrace(payload) {
  if (!payload || !Array.isArray(payload.timeline) || payload.timeline.length === 0) return "n/a";
  const last = payload.timeline[payload.timeline.length - 1];
  return typeof last.step === "string" ? last.step : "n/a";
}

function runOne(spec) {
  const env = { ...process.env, ...(spec.env || {}) };
  if (env.KNOTD_SOCKET_PATH && !env.KNOTD_MCP_SOCKET_PATH) {
    env.KNOTD_MCP_SOCKET_PATH = env.KNOTD_SOCKET_PATH;
  }

  const [cmd, ...args] = spec.command;
  const result = spawnSync(cmd, args, {
    env,
    encoding: "utf8",
    timeout: childTimeoutMs,
    killSignal: "SIGKILL",
  });

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const payload = parseJsonFromText(stdout) || parseJsonFromText(stderr);
  const ok = result.status === 0;

  return {
    id: spec.id,
    label: spec.label,
    ok,
    exit: result.status,
    stage: payload?.step || stageFromTrace(payload),
    payload,
    stdout,
    stderr,
    timedOut: Boolean(result.error && String(result.error).includes("ETIMEDOUT")),
  };
}

function printMatrix(rows) {
  console.log("knotd triage matrix");
  console.log("-------------------");
  for (const row of rows) {
    const status = row.ok ? "PASS" : "FAIL";
    const timeout = row.timedOut ? " timeout=true" : "";
    console.log(`${status.padEnd(5)}  ${row.id.padEnd(22)}  stage=${String(row.stage || "n/a")}${timeout}`);
  }
}

function printFailureDetails(rows) {
  const failed = rows.filter((row) => !row.ok);
  if (failed.length === 0) return;

  console.log("\nFailure details");
  console.log("---------------");
  for (const row of failed) {
    console.log(`\n[${row.id}] exit=${row.exit}`);
    if (row.payload) {
      console.log(JSON.stringify(row.payload, null, 2));
      continue;
    }
    const text = `${row.stdout}\n${row.stderr}`.trim();
    if (text) {
      console.log(text.split("\n").slice(-40).join("\n"));
    } else {
      console.log("(no output)");
    }
  }
}

const results = runs.map(runOne);
printMatrix(results);
printFailureDetails(results);

if (results.some((row) => !row.ok)) {
  process.exit(1);
}
