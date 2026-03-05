import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

// Trace: DESIGN-debian-packaging-scaffold-027

function mktemp(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

function makeExe(path: string, body = "#!/usr/bin/env sh\necho ok\n"): void {
  writeFileSync(path, body, { mode: 0o755 });
}

describe("debian packaging scaffold", () => {
  it("creates knot and knotd binary .deb packages", () => {
    const root = mktemp("knot-deb-bin-");
    const outDir = join(root, "dist");
    const knotBin = join(root, "knot");
    const knotdBin = join(root, "knotd");
    makeExe(knotBin);
    makeExe(knotdBin);

    execFileSync(
      "bash",
      [
        "scripts/create-deb-packages.sh",
        "--version",
        "0.1.0-test",
        "--arch",
        "amd64",
        "--output-dir",
        outDir,
        "--knot-bin",
        knotBin,
        "--knotd-bin",
        knotdBin,
      ],
      { cwd: process.cwd(), stdio: "pipe" },
    );

    expect(existsSync(join(outDir, "knot_0.1.0-test_amd64.deb"))).toBe(true);
    expect(existsSync(join(outDir, "knotd_0.1.0-test_amd64.deb"))).toBe(true);
  });

  it("creates Debian source package artifacts with knot + knotd stanzas", () => {
    const root = mktemp("knot-deb-src-");
    const outDir = join(root, "dist");

    execFileSync(
      "bash",
      [
        "scripts/create-deb-source.sh",
        "--version",
        "0.1.0-test",
        "--output-dir",
        outDir,
      ],
      { cwd: process.cwd(), stdio: "pipe" },
    );

    const files = readdirSync(outDir);
    expect(files.some((name) => name.endsWith(".dsc"))).toBe(true);
    expect(files.some((name) => name.includes(".orig.tar."))).toBe(true);
    expect(files.some((name) => name.includes(".debian.tar."))).toBe(true);

    const control = readFileSync("packaging/debian/control", "utf8");
    expect(control).toContain("Package: knot");
    expect(control).toContain("Package: knotd");
  });
});
