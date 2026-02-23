#!/usr/bin/env node
/* eslint-env node */
// Trace: BUG-knotd-mcp-startup-handshake-timeout

import { spawn } from "node:child_process";
import net from "node:net";
import { resolve } from "node:path";

const projectRoot = resolve(process.cwd());
const transportMode = process.env.KNOTD_STARTUP_TRACE_TRANSPORT || "socket"; // socket | bridge
const socketPath = process.env.KNOTD_SOCKET_PATH || "/tmp/knotd.sock";
const timeoutMs = Number.parseInt(process.env.KNOTD_STARTUP_TRACE_TIMEOUT_MS || "15000", 10);
const bridgeScript = process.env.KNOTD_STARTUP_TRACE_BRIDGE || "scripts/mcp-stdio-tap.mjs";

function nowMs(startNs) {
  return Number((process.hrtime.bigint() - startNs) / 1000000n);
}

function frame(json) {
  const text = JSON.stringify(json);
  const body = Buffer.from(text, "utf8");
  return Buffer.from(`Content-Length: ${body.length}\r\n\r\n${text}`, "utf8");
}

function createFramedDecoder(onMessage) {
  let buffer = Buffer.alloc(0);

  return (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);

    for (;;) {
      const sep = buffer.indexOf("\r\n\r\n");
      if (sep < 0) return;

      const header = buffer.subarray(0, sep).toString("utf8");
      const m = header.match(/Content-Length:\s*(\d+)/i);
      if (!m) {
        throw new Error(`Missing Content-Length in header: ${header}`);
      }

      const len = Number.parseInt(m[1], 10);
      if (!Number.isFinite(len) || len < 0) {
        throw new Error(`Invalid Content-Length: ${m[1]}`);
      }

      const start = sep + 4;
      const end = start + len;
      if (buffer.length < end) return;

      const body = buffer.subarray(start, end).toString("utf8");
      buffer = buffer.subarray(end);
      onMessage(JSON.parse(body));
    }
  };
}

function createNdjsonDecoder(onMessage) {
  let buf = "";
  return (chunk) => {
    buf += chunk.toString("utf8");
    for (;;) {
      const idx = buf.indexOf("\n");
      if (idx < 0) return;
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line) continue;
      onMessage(JSON.parse(line));
    }
  };
}

function makeRpc(sendRaw, onMessage) {
  let nextId = 1;
  const pending = new Map();

  function onRpcMessage(msg) {
    if (msg.id !== undefined && pending.has(msg.id)) {
      const waiter = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) {
        waiter.reject(new Error(JSON.stringify(msg.error)));
      } else {
        waiter.resolve(msg.result);
      }
    }
    onMessage(msg);
  }

  function request(method, params) {
    const id = nextId++;
    const payload = { jsonrpc: "2.0", id, method, params };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error(`timeout waiting for ${method} (id=${id})`));
        }
      }, timeoutMs);
      pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      sendRaw(frame(payload));
    });
  }

  function notify(method, params) {
    sendRaw(frame({ jsonrpc: "2.0", method, params }));
  }

  return { onRpcMessage, request, notify };
}

function extractToolResult(result) {
  const text = result?.content?.[0]?.text;
  if (typeof text !== "string") return text ?? null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function connectSocket() {
  const socket = net.createConnection({ path: socketPath });
  await new Promise((resolveConnect, rejectConnect) => {
    const timer = setTimeout(() => rejectConnect(new Error(`connect timeout: ${socketPath}`)), timeoutMs);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolveConnect();
    });
    socket.once("error", (err) => {
      clearTimeout(timer);
      rejectConnect(err);
    });
  });
  return {
    sendRaw: (buf) => socket.write(buf),
    onData: (handler) => socket.on("data", handler),
    close: () => socket.end(),
  };
}

async function connectBridge() {
  const child = spawn(process.execPath, [resolve(projectRoot, bridgeScript)], {
    cwd: projectRoot,
    env: process.env,
    stdio: ["pipe", "pipe", "pipe"],
  });

  const stderr = [];
  child.stderr.on("data", (chunk) => stderr.push(chunk.toString("utf8")));

  await new Promise((resolveSpawn, rejectSpawn) => {
    const timer = setTimeout(() => rejectSpawn(new Error(`bridge spawn timeout: ${bridgeScript}`)), timeoutMs);
    child.once("spawn", () => {
      clearTimeout(timer);
      resolveSpawn();
    });
    child.once("error", (err) => {
      clearTimeout(timer);
      rejectSpawn(err);
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      rejectSpawn(new Error(`bridge exited early: code=${code} stderr=${stderr.join("")}`));
    });
  });

  return {
    sendRaw: (buf) => child.stdin.write(buf),
    onData: (handler) => child.stdout.on("data", handler),
    close: () => {
      child.stdin.end();
      child.kill("SIGTERM");
    },
    getStderr: () => stderr.join(""),
  };
}

async function main() {
  const started = process.hrtime.bigint();
  const timeline = [];
  const meta = { transportMode, socketPath, timeoutMs, bridgeScript };

  function mark(step, details = {}) {
    timeline.push({ t_ms: nowMs(started), step, ...details });
  }

  const transport = transportMode === "bridge" ? await connectBridge() : await connectSocket();
  mark("transport_connected");

  const decoder = transportMode === "bridge" ? createNdjsonDecoder : createFramedDecoder;

  const rpc = makeRpc(transport.sendRaw, (msg) => {
    const kind = msg.method ? `recv:${msg.method}` : msg.id !== undefined ? "recv:response" : "recv:other";
    mark(kind, { id: msg.id ?? null });
  });

  transport.onData(decoder(rpc.onRpcMessage));

  let firstToolName = null;
  let firstToolResult = null;

  try {
    mark("initialize:send");
    await rpc.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "knotd-mcp-startup-trace", version: "1.0.0" },
    });
    mark("initialize:ok");

    mark("initialized:send");
    rpc.notify("initialized", {});
    mark("initialized:sent");

    mark("tools/list:send");
    const toolsList = await rpc.request("tools/list", {});
    const tools = Array.isArray(toolsList?.tools) ? toolsList.tools : [];
    mark("tools/list:ok", { tool_count: tools.length });

    const preferred = ["is_vault_open", "get_vault_info", "list_notes", "list_tags"];
    firstToolName = preferred.find((name) => tools.some((t) => t.name === name)) ?? tools[0]?.name ?? null;

    if (!firstToolName) {
      throw new Error("No tools available from tools/list");
    }

    mark("tools/call:first:send", { tool: firstToolName });
    const callResult = await rpc.request("tools/call", { name: firstToolName, arguments: {} });
    firstToolResult = extractToolResult(callResult);
    mark("tools/call:first:ok", { tool: firstToolName });

    mark("done");

    console.log(
      JSON.stringify(
        {
          ok: true,
          meta,
          timeline,
          firstToolName,
          firstToolResult,
        },
        null,
        2
      )
    );
  } catch (error) {
    mark("failed", { error: String(error?.message || error) });
    console.error(
      JSON.stringify(
        {
          ok: false,
          meta,
          timeline,
          firstToolName,
          error: String(error?.stack || error),
          bridgeStderr: typeof transport.getStderr === "function" ? transport.getStderr() : undefined,
        },
        null,
        2
      )
    );
    process.exitCode = 1;
  } finally {
    transport.close();
  }
}

main();
