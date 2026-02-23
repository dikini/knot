#!/usr/bin/env node
/* eslint-env node */
// Trace: DESIGN-knotd-local-ipc

import { existsSync, readFileSync } from "node:fs";
import net from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = resolve(dirname(scriptPath), "..");
const explicitConfig = process.env.KNOTD_MCP_CONFIG;
const localConfigPath = explicitConfig
  ? resolve(projectRoot, explicitConfig)
  : resolve(projectRoot, ".mcp/knotd-mcp.json");
const templateConfigPath = resolve(projectRoot, ".mcp/knotd-mcp.example.json");

const selectedConfigPath = existsSync(localConfigPath)
  ? localConfigPath
  : existsSync(templateConfigPath)
    ? templateConfigPath
    : null;

let config = {};
if (selectedConfigPath) {
  try {
    config = JSON.parse(readFileSync(selectedConfigPath, "utf8"));
  } catch (error) {
    console.error(`[knotd-mcp-bridge] invalid JSON in ${selectedConfigPath}: ${String(error)}`);
    process.exit(1);
  }
}

const socketPath = process.env.KNOTD_MCP_SOCKET_PATH || config.socketPath || "/tmp/knotd.sock";
const connectTimeoutMs = Number.parseInt(
  process.env.KNOTD_MCP_CONNECT_TIMEOUT_MS || config.connectTimeoutMs || "10000",
  10
);
const connectRetryMs = Number.parseInt(
  process.env.KNOTD_MCP_CONNECT_RETRY_MS || config.connectRetryMs || "150",
  10
);

const isRetryableConnectError = (code) => code === "ENOENT" || code === "ECONNREFUSED";

function encodeFramedMessage(jsonText) {
  return `Content-Length: ${Buffer.byteLength(jsonText, "utf8")}\r\n\r\n${jsonText}`;
}

function encodeNdjsonMessage(jsonText) {
  return `${jsonText}\n`;
}

function createStdinDecoder(onJsonText) {
  let mode = "unknown";
  let framedBuffer = Buffer.alloc(0);
  let ndjsonBuffer = "";

  function decodeFramed() {
    while (true) {
      const sep = framedBuffer.indexOf(Buffer.from("\r\n\r\n"));
      if (sep < 0) return;

      const headerText = framedBuffer.subarray(0, sep).toString("utf8");
      const lengthMatch = headerText.match(/Content-Length:\s*(\d+)/i);
      if (!lengthMatch) return;

      const bodyLength = Number.parseInt(lengthMatch[1], 10);
      if (!Number.isFinite(bodyLength) || bodyLength < 0) return;

      const bodyStart = sep + 4;
      const bodyEnd = bodyStart + bodyLength;
      if (framedBuffer.length < bodyEnd) return;

      const body = framedBuffer.subarray(bodyStart, bodyEnd).toString("utf8");
      framedBuffer = framedBuffer.subarray(bodyEnd);
      onJsonText(body);
    }
  }

  function decodeNdjson() {
    while (true) {
      const newlineIdx = ndjsonBuffer.indexOf("\n");
      if (newlineIdx < 0) return;
      const line = ndjsonBuffer.slice(0, newlineIdx).trim();
      ndjsonBuffer = ndjsonBuffer.slice(newlineIdx + 1);
      if (line.length === 0) continue;
      onJsonText(line);
    }
  }

  return (chunk) => {
    if (mode === "unknown") {
      const asText = chunk.toString("utf8").trimStart();
      if (asText.startsWith("Content-Length:")) {
        mode = "framed";
      } else {
        mode = "ndjson";
      }
    }

    if (mode === "framed") {
      framedBuffer = Buffer.concat([framedBuffer, chunk]);
      decodeFramed();
      return;
    }

    ndjsonBuffer += chunk.toString("utf8");
    decodeNdjson();
  };
}

function createSocketDecoder(onJsonText) {
  let framedBuffer = Buffer.alloc(0);

  return (chunk) => {
    framedBuffer = Buffer.concat([framedBuffer, chunk]);
    while (true) {
      const sep = framedBuffer.indexOf(Buffer.from("\r\n\r\n"));
      if (sep < 0) return;

      const headerText = framedBuffer.subarray(0, sep).toString("utf8");
      const lengthMatch = headerText.match(/Content-Length:\s*(\d+)/i);
      if (!lengthMatch) return;

      const bodyLength = Number.parseInt(lengthMatch[1], 10);
      if (!Number.isFinite(bodyLength) || bodyLength < 0) return;

      const bodyStart = sep + 4;
      const bodyEnd = bodyStart + bodyLength;
      if (framedBuffer.length < bodyEnd) return;

      const body = framedBuffer.subarray(bodyStart, bodyEnd).toString("utf8");
      framedBuffer = framedBuffer.subarray(bodyEnd);
      onJsonText(body);
    }
  };
}

function connectOnce() {
  return new Promise((resolveConnect, rejectConnect) => {
    const socket = net.createConnection({ path: socketPath });
    socket.once("connect", () => resolveConnect(socket));
    socket.once("error", rejectConnect);
  });
}

async function connectWithRetry() {
  const deadline = Date.now() + Math.max(connectTimeoutMs, 1000);
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      return await connectOnce();
    } catch (error) {
      lastError = error;
      if (!isRetryableConnectError(error?.code)) {
        throw error;
      }
      await new Promise((r) => setTimeout(r, Math.max(connectRetryMs, 25)));
    }
  }

  throw lastError || new Error("timed out connecting to knotd socket");
}

async function main() {
  let socket;
  try {
    socket = await connectWithRetry();
  } catch (error) {
    const code = error?.code ? ` (${error.code})` : "";
    console.error(
      `[knotd-mcp-bridge] failed to connect to ${socketPath}${code}: ${String(error?.message || error)}`
    );
    console.error(
      `[knotd-mcp-bridge] start knotd first, e.g. knotd --listen-unix ${socketPath} --vault <path>`
    );
    process.exit(1);
  }

  const decodeStdin = createStdinDecoder((jsonText) => {
    socket.write(encodeFramedMessage(jsonText));
  });
  const decodeSocket = createSocketDecoder((jsonText) => {
    process.stdout.write(encodeNdjsonMessage(jsonText));
  });

  process.stdin.on("data", (chunk) => {
    decodeStdin(chunk);
  });
  socket.on("data", (chunk) => {
    decodeSocket(chunk);
  });

  process.stdin.on("end", () => socket.end());

  socket.on("close", () => process.exit(0));
  socket.on("error", (error) => {
    console.error(`[knotd-mcp-bridge] socket error: ${String(error?.message || error)}`);
    process.exit(1);
  });
}

main().catch((error) => {
  console.error(`[knotd-mcp-bridge] fatal error: ${String(error)}`);
  process.exit(1);
});
