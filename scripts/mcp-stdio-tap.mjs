#!/usr/bin/env node
/* eslint-env node */
// Trace: DESIGN-knotd-mcp-ops

import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";

const projectRoot = resolve(process.cwd());
const targetScript = process.env.KNOTD_MCP_TAP_TARGET
  ? resolve(projectRoot, process.env.KNOTD_MCP_TAP_TARGET)
  : resolve(projectRoot, "scripts/knotd-mcp-bridge.mjs");
const logPath = process.env.KNOTD_MCP_TAP_LOG
  ? resolve(projectRoot, process.env.KNOTD_MCP_TAP_LOG)
  : "/tmp/knot-mcp-stdio-tap.log";
const maxPreviewBytes = Number.parseInt(process.env.KNOTD_MCP_TAP_PREVIEW_BYTES || "512", 10);
const parseFrames = process.env.KNOTD_MCP_TAP_PARSE_FRAMES !== "0";

mkdirSync(dirname(logPath), { recursive: true });

function ts() {
  return new Date().toISOString();
}

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return "\"<unserializable>\"";
  }
}

function log(event, data = {}) {
  const line = `${ts()} event=${event} ${Object.entries(data)
    .map(([k, v]) => `${k}=${safeJson(v)}`)
    .join(" ")}\n`;
  appendFileSync(logPath, line, "utf8");
}

function previewText(buf) {
  const slice = buf.subarray(0, Math.max(0, maxPreviewBytes));
  const text = slice
    .toString("utf8")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t");
  return text;
}

function previewHex(buf) {
  const slice = buf.subarray(0, Math.max(0, maxPreviewBytes));
  return slice.toString("hex");
}

function logChunk(direction, chunk) {
  const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
  log("chunk", {
    direction,
    bytes: buf.length,
    preview_text: previewText(buf),
    preview_hex: previewHex(buf),
    truncated: buf.length > maxPreviewBytes,
  });
}

function parseMcpFrames(direction, state, chunk) {
  if (!parseFrames) return;
  state.buffer = Buffer.concat([state.buffer, Buffer.from(chunk)]);

  while (true) {
    const sep = state.buffer.indexOf(Buffer.from("\r\n\r\n"));
    if (sep < 0) return;

    const headerBuf = state.buffer.subarray(0, sep);
    const header = headerBuf.toString("utf8");
    const m = header.match(/Content-Length:\s*(\d+)/i);
    if (!m) {
      log("frame_parse_error", { direction, reason: "missing_content_length", header: previewText(headerBuf) });
      return;
    }

    const length = Number.parseInt(m[1], 10);
    if (!Number.isFinite(length) || length < 0) {
      log("frame_parse_error", { direction, reason: "invalid_content_length", value: m[1] });
      return;
    }

    const bodyStart = sep + 4;
    const bodyEnd = bodyStart + length;
    if (state.buffer.length < bodyEnd) return;

    const bodyBuf = state.buffer.subarray(bodyStart, bodyEnd);
    state.buffer = state.buffer.subarray(bodyEnd);

    let method = null;
    let id = null;
    let jsonrpc = null;
    let resultKeys = null;
    let errorCode = null;
    let errorMessage = null;
    let parseError = null;

    try {
      const obj = JSON.parse(bodyBuf.toString("utf8"));
      method = typeof obj.method === "string" ? obj.method : null;
      id = Object.prototype.hasOwnProperty.call(obj, "id") ? obj.id : null;
      jsonrpc = typeof obj.jsonrpc === "string" ? obj.jsonrpc : null;
      if (obj.result && typeof obj.result === "object") {
        resultKeys = Object.keys(obj.result).slice(0, 12);
      }
      if (obj.error && typeof obj.error === "object") {
        errorCode = Object.prototype.hasOwnProperty.call(obj.error, "code") ? obj.error.code : null;
        errorMessage = typeof obj.error.message === "string" ? obj.error.message : null;
      }
    } catch (err) {
      parseError = String(err);
    }

    log("frame", {
      direction,
      content_length: length,
      header_preview: previewText(headerBuf),
      body_preview: previewText(bodyBuf),
      method,
      id,
      jsonrpc,
      result_keys: resultKeys,
      error_code: errorCode,
      error_message: errorMessage,
      json_parse_error: parseError,
    });
  }
}

const child = spawn(process.execPath, [targetScript], {
  cwd: projectRoot,
  env: process.env,
  stdio: ["pipe", "pipe", "pipe"],
});

const stdinState = { buffer: Buffer.alloc(0) };
const stdoutState = { buffer: Buffer.alloc(0) };

log("tap_start", {
  pid: process.pid,
  ppid: process.ppid,
  target_script: targetScript,
  log_path: logPath,
  parse_frames: parseFrames,
  max_preview_bytes: maxPreviewBytes,
});

child.on("spawn", () => {
  log("child_spawn", { pid: child.pid });
});

process.stdin.on("data", (chunk) => {
  logChunk("codex.stdin->bridge.stdin", chunk);
  parseMcpFrames("codex.stdin->bridge.stdin", stdinState, chunk);
});

child.stdout.on("data", (chunk) => {
  logChunk("bridge.stdout->codex.stdout", chunk);
  parseMcpFrames("bridge.stdout->codex.stdout", stdoutState, chunk);
});

child.stderr.on("data", (chunk) => {
  logChunk("bridge.stderr->codex.stderr", chunk);
});

process.stdin.on("end", () => {
  log("stdin_end");
});

child.stdout.on("end", () => {
  log("child_stdout_end");
});

child.stderr.on("end", () => {
  log("child_stderr_end");
});

child.on("error", (err) => {
  log("child_error", { error: String(err) });
});

child.on("exit", (code, signal) => {
  log("child_exit", { code, signal: signal ?? null });
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

process.stdin.pipe(child.stdin);
child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);

process.on("SIGINT", () => {
  log("signal", { signal: "SIGINT" });
  child.kill("SIGINT");
});

process.on("SIGTERM", () => {
  log("signal", { signal: "SIGTERM" });
  child.kill("SIGTERM");
});
