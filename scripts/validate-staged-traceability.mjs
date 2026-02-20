#!/usr/bin/env node
/* eslint-env node */

import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const TRACE_ID_REGEX = /\b(?:DESIGN|BUG)-[a-z0-9][a-z0-9-]*\b/i;
const CHANGE_TYPE_REGEX = /^Change-Type:\s*(design-update|bug-fix|hybrid)\s*$/m;

/**
 * SPEC: COMP-TRACE-LITE-001 FR-1 FR-2 FR-3
 */
export function validateStagedTraceability({ addedLines, stagedPlanFiles }) {
  const errors = [];

  if (!TRACE_ID_REGEX.test(addedLines)) {
    errors.push("Missing trace ID in staged additions. Add DESIGN-<slug> or BUG-<slug>.");
  }

  for (const plan of stagedPlanFiles) {
    if (!CHANGE_TYPE_REGEX.test(plan.content)) {
      errors.push(
        `${plan.path} is missing \`Change-Type: design-update|bug-fix|hybrid\` in the header.`
      );
    }
    if (!TRACE_ID_REGEX.test(plan.content)) {
      errors.push(`${plan.path} is missing a trace ID (DESIGN-<slug> or BUG-<slug>).`);
    }
  }

  return { ok: errors.length === 0, errors };
}

function run(cmd) {
  return execSync(cmd, { encoding: "utf8" }).trim();
}

function getStagedFiles() {
  const output = run("git diff --cached --name-only --diff-filter=ACMR");
  return output === "" ? [] : output.split("\n");
}

function getAddedLines() {
  const diff = run("git diff --cached -U0 --no-color");
  return diff
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1))
    .join("\n");
}

function readStagedFile(path) {
  return run(`git show :${path}`);
}

function main() {
  const stagedFiles = getStagedFiles();
  if (stagedFiles.length === 0) {
    process.exit(0);
  }

  const stagedPlanFiles = stagedFiles
    .filter((path) => path.startsWith("docs/plans/") && path.endsWith(".md"))
    .map((path) => ({ path, content: readStagedFile(path) }));

  const result = validateStagedTraceability({
    addedLines: getAddedLines(),
    stagedPlanFiles,
  });

  if (!result.ok) {
    console.error("Traceability check failed:");
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
