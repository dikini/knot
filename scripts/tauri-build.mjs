#!/usr/bin/env node
/* eslint-env node */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const isLinux = process.platform === "linux";
const wantsAppImage = args.some((arg) => arg.toLowerCase().includes("appimage"));
const projectRoot = process.cwd();
const appImageBundleDir = path.join(
  projectRoot,
  "src-tauri",
  "target",
  "release",
  "bundle",
  "appimage",
);
const tauriCacheDir = path.join(os.homedir(), ".cache", "tauri");
const appImagePluginPath = path.join(tauriCacheDir, "linuxdeploy-plugin-appimage.AppImage");
const tauriConfigPath = path.join(projectRoot, "src-tauri", "tauri.conf.json");

function check(command, commandArgs, failureLines) {
  const result = spawnSync(command, commandArgs, {
    stdio: "ignore",
    env: process.env,
  });

  if (result.status === 0) {
    return;
  }

  for (const line of failureLines) {
    console.error(line);
  }
  process.exit(result.status ?? 1);
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    stdio: "inherit",
    env: options.env ?? process.env,
    cwd: options.cwd ?? projectRoot,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function findSingleEntry(dirPath, suffix) {
  const matches = fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.name.endsWith(suffix))
    .map((entry) => path.join(dirPath, entry.name))
    .sort();

  if (matches.length !== 1) {
    console.error(
      `[tauri-build] expected exactly one ${suffix} entry in ${dirPath}, found ${matches.length}`,
    );
    process.exit(1);
  }

  return matches[0];
}

function parseDesktopIconName(appDirPath) {
  const desktopFile = findSingleEntry(appDirPath, ".desktop");
  const content = fs.readFileSync(desktopFile, "utf8");
  const iconLine = content
    .split(/\r?\n/u)
    .find((line) => line.startsWith("Icon="));

  if (!iconLine) {
    console.error(`[tauri-build] could not find Icon= entry in ${desktopFile}`);
    process.exit(1);
  }

  return iconLine.slice("Icon=".length).trim();
}

function chooseRootIconTarget(appDirPath, iconName) {
  const candidates = [
    path.join("usr", "share", "icons", "hicolor", "512x512", "apps", `${iconName}.png`),
    path.join("usr", "share", "icons", "hicolor", "256x256@2", "apps", `${iconName}.png`),
    path.join("usr", "share", "icons", "hicolor", "128x128", "apps", `${iconName}.png`),
    path.join("usr", "share", "icons", "hicolor", "64x64", "apps", `${iconName}.png`),
    path.join("usr", "share", "icons", "hicolor", "32x32", "apps", `${iconName}.png`),
  ];

  const relativeTarget = candidates.find((candidate) =>
    fs.existsSync(path.join(appDirPath, candidate)),
  );

  if (!relativeTarget) {
    console.error(
      `[tauri-build] could not find a bundled PNG icon for ${iconName} in ${appDirPath}`,
    );
    process.exit(1);
  }

  return relativeTarget;
}

function expectedAppImagePath() {
  const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, "utf8"));
  const archName = process.arch === "x64" ? "amd64" : process.arch;
  return path.join(
    appImageBundleDir,
    `${tauriConfig.productName}_${tauriConfig.version}_${archName}.AppImage`,
  );
}

function rewriteRootAppImageIcon() {
  const appDirPath = findSingleEntry(appImageBundleDir, ".AppDir");
  const appImagePath = expectedAppImagePath();
  const iconName = parseDesktopIconName(appDirPath);
  const iconTarget = chooseRootIconTarget(appDirPath, iconName);
  const rootIconPath = path.join(appDirPath, `${iconName}.png`);
  const dirIconPath = path.join(appDirPath, ".DirIcon");

  // AppImage consumers often read these root links directly, so make them
  // point at the highest-resolution bundled PNG rather than the default 32x32 icon.
  fs.rmSync(rootIconPath, { force: true });
  fs.symlinkSync(iconTarget, rootIconPath);
  fs.rmSync(dirIconPath, { force: true });
  fs.symlinkSync(`${iconName}.png`, dirIconPath);

  const extractDir = fs.mkdtempSync(path.join(os.tmpdir(), "knot-appimagetool-"));
  const repairedOutputPath = `${appImagePath}.repacked`;

  try {
    console.error(`[tauri-build] repairing AppImage root icon for ${path.basename(appImagePath)}`);
    run(appImagePluginPath, ["--appimage-extract"], { cwd: extractDir, env: process.env });

    const appImageToolPath = path.join(extractDir, "squashfs-root", "usr", "bin", "appimagetool");
    run(appImageToolPath, [appDirPath, repairedOutputPath], {
      env: { ...process.env, ARCH: "x86_64" },
    });

    fs.rmSync(appImagePath, { force: true });
    fs.renameSync(repairedOutputPath, appImagePath);
  } finally {
    fs.rmSync(repairedOutputPath, { force: true });
    fs.rmSync(extractDir, { recursive: true, force: true });
  }
}

if (isLinux && wantsAppImage) {
  check("patchelf", ["--version"], [
    "[tauri-build] missing required host tool 'patchelf' for Linux AppImage bundling",
    "[tauri-build] install it and retry, for example: sudo apt install patchelf",
  ]);

  check("pkg-config", ["--exists", "librsvg-2.0"], [
    "[tauri-build] missing required pkg-config metadata for 'librsvg-2.0'",
    "[tauri-build] install the librsvg development package and retry, for example: sudo apt install librsvg2-dev",
  ]);
}

const env = { ...process.env };
if (isLinux && wantsAppImage) {
  // Some environments cannot FUSE-mount nested helper AppImages used by linuxdeploy.
  env.APPIMAGE_EXTRACT_AND_RUN = "1";
}

const result = spawnSync("tauri", ["build", ...args], {
  stdio: "inherit",
  env,
  shell: true,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

if (isLinux && wantsAppImage) {
  rewriteRootAppImageIcon();
}
