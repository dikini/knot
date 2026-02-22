#!/usr/bin/env node
/* eslint-env node */

import { execSync } from "node:child_process";

function run(cmd) {
  return execSync(cmd, { encoding: "utf8" }).trim();
}

function changedFilesFromStaged() {
  const output = run("git diff --cached --name-only --diff-filter=ACMR");
  return output === "" ? [] : output.split("\n");
}

function changedFilesFromRef(baseRef) {
  const output = run(`git diff --name-only --diff-filter=ACMR ${baseRef}...HEAD`);
  return output === "" ? [] : output.split("\n");
}

function isUiImplementationPath(path) {
  if (path.endsWith(".stories.tsx")) {
    return false;
  }
  return (
    path === "src/App.tsx" ||
    path.startsWith("src/components/") ||
    path.startsWith("src/editor/") ||
    path.startsWith("src/styles/") ||
    path === "src/lib/store.ts" ||
    path === "src/lib/api.ts" ||
    path === "src/lib/vaultSwitchGuard.ts"
  );
}

function isUiEvidencePath(path) {
  return path.startsWith("e2e/browser/") && path.endsWith(".spec.ts");
}

function isStorybookStoryPath(path) {
  return path.startsWith("src/") && path.endsWith(".stories.tsx");
}

function isUiDocumentationPath(path) {
  return (
    path === "docs/testing/ui-review-artifacts.md" ||
    path === "docs/testing/ui-automation-dx.md" ||
    path === "docs/testing/storybook-dx.md" ||
    path === "docs/testing/storybook-mcp.md" ||
    path === "docs/process/storybook-doc-freshness.md" ||
    path === "docs/specs/component/ui-quality-assurance-dx-001.md" ||
    path === "docs/specs/component/storybook-dx-001.md" ||
    path === "docs/specs/system/spec-map.md" ||
    path === "docs/planning/roadmap-index.md"
  );
}

function validateUiDocSync(files) {
  const uiImplementationChanges = files.filter(isUiImplementationPath);
  if (uiImplementationChanges.length === 0) {
    return { ok: true, errors: [] };
  }

  const hasUiEvidenceUpdate = files.some(isUiEvidencePath);
  const hasUiDocumentationUpdate = files.some(isUiDocumentationPath);
  const hasStoryUpdate = files.some(isStorybookStoryPath);
  const hasComponentUiChanges = uiImplementationChanges.some((path) => path.startsWith("src/components/"));

  const errors = [];
  if (!hasUiEvidenceUpdate) {
    errors.push(
      "UI implementation files changed without browser evidence updates. Add/update at least one spec in e2e/browser/*.spec.ts."
    );
  }
  if (!hasUiDocumentationUpdate) {
    errors.push(
      "UI implementation files changed without UI review documentation updates. Update docs/testing/ui-review-artifacts.md or docs/testing/ui-automation-dx.md (and related tracking docs when needed)."
    );
  }
  if (hasComponentUiChanges && !hasStoryUpdate) {
    errors.push(
      "Component UI files changed without Storybook updates. Add/update at least one *.stories.tsx file."
    );
  }

  return { ok: errors.length === 0, errors };
}

function main() {
  const args = process.argv.slice(2);
  const staged = args.includes("--staged");
  const againstArg = args.find((arg) => arg.startsWith("--against="));
  const against = againstArg ? againstArg.slice("--against=".length) : process.env.BASE_REF;

  const files = staged ? changedFilesFromStaged() : changedFilesFromRef(against || "origin/main");
  const result = validateUiDocSync(files);

  if (!result.ok) {
    console.error("UI doc/evidence sync check failed:");
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    console.error("");
    console.error("Changed UI implementation files:");
    for (const path of files.filter(isUiImplementationPath)) {
      console.error(`- ${path}`);
    }
    process.exit(1);
  }

  console.log("[ui-doc-sync] passed");
}

main();
