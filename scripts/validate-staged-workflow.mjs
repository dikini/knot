#!/usr/bin/env node
/* eslint-env node */
// Trace: DESIGN-workflow-freshness-hardening-021

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { validateProjectRegistry } from "./validate-project-registry.mjs";
import { validateStagedTraceability } from "./validate-staged-traceability.mjs";
import { validateUiDocSync } from "./validate-ui-doc-sync.mjs";

const REGISTRY_RELEVANT_PREFIXES = [
  "docs/specs/component/",
  "docs/specs/system/",
  "docs/planning/",
  "docs/PROJECT_STATE.md",
];

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function getStagedFiles() {
  const output = git(["diff", "--cached", "--name-only", "--diff-filter=ACMR"]);
  return output === "" ? [] : output.split("\n");
}

function getAddedLines() {
  const diff = git(["diff", "--cached", "-U0", "--no-color"]);
  return diff
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1))
    .join("\n");
}

function readStagedFile(pathname) {
  return git(["show", `:${pathname}`]);
}

function readPreferStaged(repoRoot, pathname, stagedPaths) {
  if (stagedPaths.has(pathname)) {
    return readStagedFile(pathname);
  }
  return fs.readFileSync(path.join(repoRoot, pathname), "utf8");
}

function listComponentSpecs(repoRoot) {
  const componentDir = path.join(repoRoot, "docs", "specs", "component");
  return fs
    .readdirSync(componentDir)
    .filter((file) => file.endsWith(".md"))
    .sort()
    .map((file) => path.posix.join("docs/specs/component", file));
}

export function shouldValidateProjectRegistry(stagedFiles) {
  return stagedFiles.some(
    (pathname) =>
      pathname === "docs/PROJECT_STATE.md" ||
      REGISTRY_RELEVANT_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

function readStagedProjectRegistrySources(repoRoot, stagedFiles) {
  const stagedPaths = new Set(stagedFiles);
  const specFiles = listComponentSpecs(repoRoot).map((pathname) => ({
    path: pathname,
    content: readPreferStaged(repoRoot, pathname, stagedPaths),
  }));

  return {
    projectStateMarkdown: readPreferStaged(repoRoot, "docs/PROJECT_STATE.md", stagedPaths),
    specFiles,
    specMapMarkdown: readPreferStaged(
      repoRoot,
      "docs/specs/system/spec-map.md",
      stagedPaths
    ),
    roadmapMarkdown: readPreferStaged(repoRoot, "docs/planning/roadmap-index.md", stagedPaths),
  };
}

export function validateStagedWorkflow({
  stagedFiles,
  addedLines,
  stagedPlanFiles,
  projectRegistryResult,
}) {
  const errors = [];

  const traceability = validateStagedTraceability({
    addedLines,
    stagedPlanFiles,
  });
  errors.push(...traceability.errors);

  const uiDocSync = validateUiDocSync(stagedFiles);
  errors.push(...uiDocSync.errors);

  if (shouldValidateProjectRegistry(stagedFiles)) {
    errors.push(...projectRegistryResult.errors);
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

function main() {
  const stagedFiles = getStagedFiles();
  if (stagedFiles.length === 0) {
    process.exit(0);
  }

  const stagedPlanFiles = stagedFiles
    .filter((pathname) => pathname.startsWith("docs/plans/") && pathname.endsWith(".md"))
    .map((pathname) => ({ path: pathname, content: readStagedFile(pathname) }));

  const projectRegistryResult = shouldValidateProjectRegistry(stagedFiles)
    ? validateProjectRegistry(readStagedProjectRegistrySources(process.cwd(), stagedFiles))
    : { ok: true, errors: [] };

  const result = validateStagedWorkflow({
    stagedFiles,
    addedLines: getAddedLines(),
    stagedPlanFiles,
    projectRegistryResult,
  });

  if (!result.ok) {
    console.error("Staged workflow check failed:");
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log("[staged-workflow] passed");
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main();
}
