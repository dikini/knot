import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  resolveDaemonSmokeRuntime,
  runLocalCiDaemonSmoke,
} from "../../scripts/run-knotd-daemon-smoke.mjs";

describe("resolveDaemonSmokeRuntime", () => {
  it("uses the repo-local runtime defaults when env does not override them", () => {
    const repoRoot = "/repo/knot";
    const runtime = resolveDaemonSmokeRuntime({ repoRoot, env: {} });

    expect(runtime.runDir).toBe(path.join(repoRoot, ".run", "knotd-dev"));
    expect(runtime.socketPath).toBe(path.join(repoRoot, ".run", "knotd-dev", "knotd.sock"));
    expect(runtime.env.KNOT_DEV_RUN_DIR).toBe(runtime.runDir);
    expect(runtime.env.KNOTD_SOCKET_PATH).toBe(runtime.socketPath);
  });

  it("respects explicit daemon runtime overrides from env", () => {
    const runtime = resolveDaemonSmokeRuntime({
      repoRoot: "/repo/knot",
      env: {
        KNOT_DEV_RUN_DIR: "/tmp/knot-dev",
        KNOTD_SOCKET_PATH: "/tmp/knot-dev/custom.sock",
      },
    });

    expect(runtime.runDir).toBe("/tmp/knot-dev");
    expect(runtime.socketPath).toBe("/tmp/knot-dev/custom.sock");
  });
});

describe("runLocalCiDaemonSmoke", () => {
  it("checks, provisions, triages, and tears down daemon smoke in order", () => {
    const calls: Array<{ command: string; args: string[]; env: NodeJS.ProcessEnv }> = [];

    runLocalCiDaemonSmoke({
      repoRoot: "/repo/knot",
      env: {},
      log: () => undefined,
      runCommand: ({ command, args, env }) => {
        calls.push({ command, args, env });
        return { status: 0 };
      },
    });

    expect(calls.map((call) => `${call.command} ${call.args.join(" ")}`)).toEqual([
      "bash scripts/dev-up.sh --check",
      "bash scripts/dev-up.sh",
      "npm run -s knotd:triage",
      "bash scripts/dev-down.sh",
    ]);
    expect(calls[0]?.env.KNOTD_SOCKET_PATH).toBe("/repo/knot/.run/knotd-dev/knotd.sock");
    expect(calls[2]?.env.KNOT_DEV_RUN_DIR).toBe("/repo/knot/.run/knotd-dev");
  });

  it("still tears down daemon lifecycle when triage fails", () => {
    const calls: Array<string> = [];

    expect(() =>
      runLocalCiDaemonSmoke({
        repoRoot: "/repo/knot",
        env: {},
        log: () => undefined,
        runCommand: ({ command, args }) => {
          const label = `${command} ${args.join(" ")}`;
          calls.push(label);
          if (label === "npm run -s knotd:triage") {
            return { status: 1, stderr: "triage failed" };
          }
          return { status: 0 };
        },
      })
    ).toThrow(/knotd MCP triage/);

    expect(calls).toEqual([
      "bash scripts/dev-up.sh --check",
      "bash scripts/dev-up.sh",
      "npm run -s knotd:triage",
      "bash scripts/dev-down.sh",
    ]);
  });
});
