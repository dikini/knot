#!/usr/bin/env node
/* eslint-env node */
// Trace: DESIGN-daemon-ui-ipc-cutover

import { mkdtempSync, mkdirSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

const socketPath = process.env.KNOTD_SOCKET_PATH || "/tmp/knotd.sock";
const requestTimeoutMs = Number(process.env.KNOTD_SMOKE_TIMEOUT_MS || 15000);
const totalTimeoutMs = Number(process.env.KNOTD_SMOKE_TOTAL_TIMEOUT_MS || 60000);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function encodeMessage(message) {
  const bodyText = JSON.stringify(message);
  const body = Buffer.from(bodyText, "utf8");
  return Buffer.from(`Content-Length: ${body.length}\r\n\r\n${bodyText}`, "utf8");
}

function createParser(onMessage) {
  let buffer = Buffer.alloc(0);
  return (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    for (;;) {
      const headerBoundary = buffer.indexOf("\r\n\r\n");
      if (headerBoundary === -1) return;

      const header = buffer.slice(0, headerBoundary).toString("utf8");
      const lengthMatch = header.match(/Content-Length:\s*(\d+)/i);
      if (!lengthMatch) {
        throw new Error("Missing Content-Length header");
      }

      const contentLength = Number(lengthMatch[1]);
      const frameLength = headerBoundary + 4 + contentLength;
      if (buffer.length < frameLength) return;

      const payload = buffer.slice(headerBoundary + 4, frameLength).toString("utf8");
      buffer = buffer.slice(frameLength);
      onMessage(JSON.parse(payload));
    }
  };
}

function parseToolResult(result) {
  const text = result?.content?.[0]?.text;
  if (typeof text !== "string") {
    return text ?? null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function main() {
  const watchdog = setTimeout(() => {
    console.error(
      JSON.stringify(
        {
          ok: false,
          step: "watchdog-timeout",
          socketPath,
          error: `total timeout exceeded: ${totalTimeoutMs}ms`,
        },
        null,
        2
      )
    );
    process.exit(1);
  }, totalTimeoutMs);

  const socket = net.createConnection(socketPath);
  socket.setTimeout(requestTimeoutMs);

  let nextId = 1;
  const pending = new Map();
  let initialized = false;

  const request = (method, params) => {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error(`Request timed out: ${method}`));
        }
      }, requestTimeoutMs);
      pending.set(id, {
        resolve: (result) => {
          clearTimeout(timeoutId);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          reject(error);
        },
      });
      socket.write(encodeMessage({ jsonrpc: "2.0", id, method, params }));
    });
  };

  const notify = (method, params) => {
    socket.write(encodeMessage({ jsonrpc: "2.0", method, params }));
  };

  socket.on(
    "data",
    createParser((message) => {
      if (message.id === undefined) return;
      const waiter = pending.get(message.id);
      if (!waiter) return;
      pending.delete(message.id);
      if (message.error) {
        waiter.reject(new Error(JSON.stringify(message.error)));
        return;
      }
      waiter.resolve(message.result);
    })
  );

  await new Promise((resolve, reject) => {
    const connectTimeout = setTimeout(
      () => reject(new Error(`Connect timed out: ${socketPath}`)),
      requestTimeoutMs
    );
    socket.once("connect", resolve);
    socket.once("error", reject);
    socket.once("timeout", () => reject(new Error(`Socket timeout: ${socketPath}`)));
    socket.once("connect", () => clearTimeout(connectTimeout));
    socket.once("error", () => clearTimeout(connectTimeout));
  });

  let originalWasOpen = false;
  let originalVaultPath = null;
  let createdVaultPath = null;
  let step = "initialize";

  try {
    const init = await request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "knotd-daemon-open-new-smoke", version: "1.0.0" },
    });
    initialized = true;
    notify("initialized", {});
    assert(init?.serverInfo, "initialize missing serverInfo");

    step = "tools/list";
    const toolsList = await request("tools/list", {});
    const toolNames = new Set((toolsList?.tools || []).map((tool) => tool.name));
    const requiredTools = ["create_vault", "open_vault", "close_vault", "is_vault_open", "get_vault_info"];
    for (const toolName of requiredTools) {
      assert(toolNames.has(toolName), `missing required tool: ${toolName}`);
    }

    step = "capture-original-state";
    originalWasOpen = Boolean(
      parseToolResult(await request("tools/call", { name: "is_vault_open", arguments: {} }))
    );
    if (originalWasOpen) {
      const originalInfo = parseToolResult(
        await request("tools/call", { name: "get_vault_info", arguments: {} })
      );
      originalVaultPath = originalInfo?.path ?? null;
      assert(typeof originalVaultPath === "string" && originalVaultPath.length > 0, "original vault path missing");
    }

    step = "create-vault";
    const tmpParent = mkdtempSync(join(tmpdir(), "knotd-daemon-open-new-"));
    createdVaultPath = join(tmpParent, "created-vault");
    mkdirSync(createdVaultPath, { recursive: true });

    const createInfo = parseToolResult(
      await request("tools/call", { name: "create_vault", arguments: { path: createdVaultPath } })
    );
    assert(createInfo?.path, "create_vault returned no path");

    const openAfterCreate = parseToolResult(
      await request("tools/call", { name: "is_vault_open", arguments: {} })
    );
    assert(openAfterCreate === true, "expected open vault after create_vault");

    step = "close-vault";
    await request("tools/call", { name: "close_vault", arguments: {} });
    const openAfterClose = parseToolResult(
      await request("tools/call", { name: "is_vault_open", arguments: {} })
    );
    assert(openAfterClose === false, "expected no open vault after close_vault");

    step = "open-created-vault";
    const openInfo = parseToolResult(
      await request("tools/call", { name: "open_vault", arguments: { path: createdVaultPath } })
    );
    assert(openInfo?.path, "open_vault returned no path");

    step = "restore-original";
    if (originalWasOpen && originalVaultPath) {
      await request("tools/call", { name: "open_vault", arguments: { path: originalVaultPath } });
    } else {
      await request("tools/call", { name: "close_vault", arguments: {} });
    }

    const finalOpen = parseToolResult(
      await request("tools/call", { name: "is_vault_open", arguments: {} })
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          socketPath,
          initialized,
          originalWasOpen,
          originalVaultPath,
          createdVaultPath,
          finalOpen,
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          step,
          socketPath,
          initialized,
          originalWasOpen,
          originalVaultPath,
          createdVaultPath,
          error: String(error?.stack || error),
        },
        null,
        2
      )
    );
    process.exitCode = 1;
  } finally {
    clearTimeout(watchdog);
    socket.end();
  }
}

main();
