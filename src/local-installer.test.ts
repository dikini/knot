import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

function mktemp(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

describe("local installer scaffold", () => {
  it("installs and uninstalls with manifest-only deletions", () => {
    const root = mktemp("knot-local-installer-");
    const sourceDir = join(root, "payload");
    mkdirSync(join(sourceDir, "bin"), { recursive: true });
    writeFileSync(join(sourceDir, "bin", "knot"), "#!/usr/bin/env sh\necho knot\n", { mode: 0o755 });
    writeFileSync(join(sourceDir, "bin", "knotd"), "#!/usr/bin/env sh\necho knotd\n", { mode: 0o755 });

    const env = {
      ...process.env,
      KNOT_INSTALL_ROOT: join(root, "opt"),
      KNOT_BIN_DIR: join(root, "bin"),
      KNOT_SHARE_DIR: join(root, "share"),
    };

    execFileSync("bash", ["scripts/local-installer.sh", "install", "--version", "0.1.0-test", "--source-dir", sourceDir], {
      cwd: process.cwd(),
      env,
      stdio: "pipe",
    });

    const installDir = join(root, "opt", "knot", "0.1.0-test");
    const manifest = join(root, "share", "knot", "manifest-0.1.0-test.txt");

    expect(existsSync(join(installDir, "bin", "knot"))).toBe(true);
    expect(existsSync(join(root, "bin", "knot"))).toBe(true);
    expect(existsSync(manifest)).toBe(true);

    writeFileSync(join(installDir, "keep.txt"), "outside manifest");

    execFileSync("bash", ["scripts/local-installer.sh", "uninstall", "--version", "0.1.0-test"], {
      cwd: process.cwd(),
      env,
      stdio: "pipe",
    });

    expect(existsSync(join(installDir, "keep.txt"))).toBe(true);
    expect(existsSync(join(root, "bin", "knot"))).toBe(false);
    expect(existsSync(manifest)).toBe(false);

    execFileSync("bash", ["scripts/local-installer.sh", "uninstall", "--version", "0.1.0-test"], {
      cwd: process.cwd(),
      env,
      stdio: "pipe",
    });
  });

  it("creates tarball and self-extracting installer artifacts", () => {
    const root = mktemp("knot-local-package-");
    const outDir = join(root, "dist");
    const knotBin = join(root, "knot");
    const knotdBin = join(root, "knotd");
    writeFileSync(knotBin, "#!/usr/bin/env sh\necho knot\n", { mode: 0o755 });
    writeFileSync(knotdBin, "#!/usr/bin/env sh\necho knotd\n", { mode: 0o755 });

    execFileSync(
      "bash",
      [
        "scripts/create-local-tarball.sh",
        "--version",
        "0.1.0-test",
        "--arch",
        "x86_64",
        "--output-dir",
        outDir,
        "--knot-bin",
        knotBin,
        "--knotd-bin",
        knotdBin,
      ],
      { cwd: process.cwd(), stdio: "pipe" },
    );

    const tarballPath = join(outDir, "knot-local-0.1.0-test-linux-x86_64.tar.gz");
    expect(existsSync(tarballPath)).toBe(true);

    execFileSync(
      "bash",
      [
        "scripts/create-self-extracting-installer.sh",
        "--version",
        "0.1.0-test",
        "--arch",
        "x86_64",
        "--output-dir",
        outDir,
        "--tarball",
        tarballPath,
      ],
      { cwd: process.cwd(), stdio: "pipe" },
    );

    const installerPath = join(outDir, "knot-installer-0.1.0-test-linux-x86_64.sh");
    expect(existsSync(installerPath)).toBe(true);
    const content = readFileSync(installerPath, "utf8");
    expect(content).toContain("__KNOT_PAYLOAD_TAR_GZ__");
    expect(content).toContain("install|uninstall");
  });
});
