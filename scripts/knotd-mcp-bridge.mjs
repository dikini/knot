#!/usr/bin/env node
/* eslint-env node */
// Trace: DESIGN-knotd-local-ipc

import { existsSync, readFileSync } from "node:fs";
import net from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createReconnectController } from "./knotd-mcp-bridge-runtime.mjs";

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
const connectMaxRetryMs = Number.parseInt(
  process.env.KNOTD_MCP_CONNECT_MAX_RETRY_MS || config.connectMaxRetryMs || "5000",
  10
);
const maxConsecutiveFailuresBeforeWait = Number.parseInt(
  process.env.KNOTD_MCP_MAX_RECONNECT_FAILURES || config.maxConsecutiveFailuresBeforeWait || "8",
  10
);

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

async function main() {
  let socket = null;
  let reconnectTimer = null;
  let connecting = false;
  let exiting = false;
  const pendingMessages = [];

  const log = (event, details = {}) => {
    const detailText = Object.entries(details)
      .map(([key, value]) => `${key}=${String(value)}`)
      .join(" ");
    console.error(
      detailText.length > 0 ? `[knotd-mcp-bridge] ${event} ${detailText}` : `[knotd-mcp-bridge] ${event}`
    );
  };

  const clearReconnectTimer = () => {
    if (reconnectTimer === null) {
      return;
    }
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  };

  const flushPendingMessages = () => {
    if (!socket) {
      return;
    }
    while (pendingMessages.length > 0) {
      socket.write(encodeFramedMessage(pendingMessages.shift()));
    }
  };

  const teardownSocket = () => {
    if (!socket) {
      return;
    }
    socket.removeAllListeners("data");
    socket.removeAllListeners("close");
    socket.removeAllListeners("error");
    socket = null;
  };

  const handleDisconnect = (error) => {
    teardownSocket();
    if (exiting) {
      process.exit(0);
      return;
    }
    reconnectController.onDisconnect(error);
  };

  const decodeSocket = createSocketDecoder((jsonText) => {
    process.stdout.write(encodeNdjsonMessage(jsonText));
  });

  const attachSocket = (nextSocket) => {
    socket = nextSocket;
    socket.setNoDelay(true);
    socket.on("data", (chunk) => {
      decodeSocket(chunk);
    });
    socket.on("close", () => {
      handleDisconnect(new Error("socket closed"));
    });
    socket.on("error", (error) => {
      log("socket_error", { error: String(error?.message || error) });
      handleDisconnect(error);
    });
    reconnectController.onConnect();
    flushPendingMessages();
    log("connected", { socketPath });
  };

  const connect = async () => {
    if (connecting || socket || exiting) {
      return;
    }
    connecting = true;
    try {
      const nextSocket = await Promise.race([
        connectOnce(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`connect timed out after ${connectTimeoutMs}ms`)), connectTimeoutMs)
        ),
      ]);
      attachSocket(nextSocket);
    } catch (error) {
      const code = error?.code ? ` (${error.code})` : "";
      log("connect_failed", {
        socketPath,
        code: code || "none",
        error: String(error?.message || error),
      });
      reconnectController.onDisconnect(error);
    } finally {
      connecting = false;
    }
  };

  const reconnectController = createReconnectController({
    connect: () => {
      void connect();
    },
    schedule: (delayMs, callback) => {
      clearReconnectTimer();
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        callback();
      }, delayMs);
    },
    clearScheduled: clearReconnectTimer,
    log: (event, details) => log(event, details),
    connectRetryMs,
    connectMaxRetryMs,
    maxConsecutiveFailuresBeforeWait,
  });

  const decodeStdin = createStdinDecoder((jsonText) => {
    pendingMessages.push(jsonText);
    if (socket) {
      flushPendingMessages();
      return;
    }
    if (!connecting) {
      void connect();
    }
  });

  process.stdin.on("data", (chunk) => {
    decodeStdin(chunk);
  });
  process.stdin.on("end", () => {
    exiting = true;
    clearReconnectTimer();
    if (socket) {
      socket.end();
      return;
    }
    process.exit(0);
  });
  process.on("SIGHUP", () => {
    log("signal_received", { signal: "SIGHUP" });
    reconnectController.onSignal("SIGHUP");
  });

  void connect();
}

main().catch((error) => {
  console.error(`[knotd-mcp-bridge] fatal error: ${String(error)}`);
  process.exit(1);
});
