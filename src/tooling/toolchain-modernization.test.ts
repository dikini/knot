import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface PackageJsonShape {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function major(versionRange: string | undefined): number {
  if (!versionRange) return 0;
  const normalized = versionRange.replace(/^[~^]/, "");
  const parsed = Number.parseInt(normalized.split(".")[0] ?? "0", 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

// TEST: COMP-TOOLCHAIN-001 FR-5
describe("Toolchain modernization version policy", () => {
  const packageJsonPath = resolve(process.cwd(), "package.json");
  const raw = readFileSync(packageJsonPath, "utf-8");
  const pkg = JSON.parse(raw) as PackageJsonShape;
  const deps = pkg.dependencies ?? {};
  const devDeps = pkg.devDependencies ?? {};

  it("uses modernized runtime majors", () => {
    expect(major(deps.react)).toBeGreaterThanOrEqual(19);
    expect(major(deps["react-dom"])).toBeGreaterThanOrEqual(19);
  });

  it("uses modernized build/test majors", () => {
    expect(major(devDeps.vite)).toBeGreaterThanOrEqual(7);
    expect(major(devDeps.vitest)).toBeGreaterThanOrEqual(4);
    expect(major(devDeps["@vitest/coverage-v8"])).toBeGreaterThanOrEqual(4);
    expect(major(devDeps["@vitejs/plugin-react"])).toBeGreaterThanOrEqual(5);
  });

  it("uses modernized TypeScript major", () => {
    expect(major(devDeps.typescript)).toBeGreaterThanOrEqual(5);
  });
});
