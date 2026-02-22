#!/usr/bin/env node
/* eslint-env node */
// Trace: DESIGN-ui-qa-dx-storybook-matrix-2026-02-22

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const auditPath = path.join(
  repoRoot,
  "docs",
  "audit",
  "storybook-design-coverage-inventory-2026-02-22.md"
);

function fail(message) {
  console.error(`[storybook-matrix] ${message}`);
  process.exit(1);
}

function readAuditFile() {
  if (!fs.existsSync(auditPath)) {
    fail(`missing audit file: ${auditPath}`);
  }
  return fs.readFileSync(auditPath, "utf8");
}

function extractStoryFiles(markdown) {
  const sectionMatch = markdown.match(/Story files present:\n([\s\S]*?)\n\nStory exports present \(/);
  if (!sectionMatch) {
    fail("could not parse 'Story files present' section");
  }

  const files = sectionMatch[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- `") && line.endsWith("`"))
    .map((line) => line.slice(3, -1));

  if (files.length === 0) {
    fail("no story files found in coverage inventory");
  }

  return files;
}

function extractDeclaredStoryCount(markdown) {
  const match = markdown.match(/Story exports present \((\d+)\):/);
  if (!match) {
    fail("could not parse declared story export count");
  }
  return Number(match[1]);
}

function countStoryExports(files) {
  let total = 0;

  for (const file of files) {
    const absolute = path.join(repoRoot, file);
    if (!fs.existsSync(absolute)) {
      fail(`story file listed in inventory does not exist: ${file}`);
    }
    const content = fs.readFileSync(absolute, "utf8");
    const matches = content.match(/^export const [A-Za-z0-9_]+: Story\s*=/gm);
    total += matches ? matches.length : 0;
  }

  return total;
}

function parseUiSpecRows(markdown) {
  const sectionMatch = markdown.match(
    /### UI-facing specs\n\n\| Spec ID \| Status \| Evidence \| Gap \|\n\| --- \| --- \| --- \| --- \|\n([\s\S]*?)\n\n### Process\/tooling specs/
  );
  if (!sectionMatch) {
    fail("could not parse UI-facing spec coverage table");
  }

  return sectionMatch[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("| `COMP-"))
    .map((line) => {
      const cells = line
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean);
      return {
        specId: cells[0] ?? "",
        status: cells[1] ?? "",
      };
    });
}

function parseGapSummary(markdown) {
  const partialMatch = markdown.match(/UI-facing specs missing or partial story coverage: `(\d+)`/);
  const coveredMatch = markdown.match(/UI-facing specs fully covered: `(\d+)`/);
  if (!partialMatch || !coveredMatch) {
    fail("could not parse gap summary counts");
  }
  return {
    partialOrMissing: Number(partialMatch[1]),
    covered: Number(coveredMatch[1]),
  };
}

function ensureUiQaDxCovered(markdown) {
  const rowMatch = markdown.match(
    /\| `COMP-UI-QA-DX-001` \| ([a-z]+) \| ([^|]+) \|/
  );
  if (!rowMatch) {
    fail("could not find COMP-UI-QA-DX-001 row in process/tooling table");
  }
  if (rowMatch[1] !== "covered") {
    fail("COMP-UI-QA-DX-001 must be marked covered");
  }
}

function main() {
  const markdown = readAuditFile();
  const storyFiles = extractStoryFiles(markdown);
  const declaredCount = extractDeclaredStoryCount(markdown);
  const actualCount = countStoryExports(storyFiles);

  if (declaredCount !== actualCount) {
    fail(
      `declared story export count (${declaredCount}) does not match actual exports in listed files (${actualCount})`
    );
  }

  const uiRows = parseUiSpecRows(markdown);
  const nonCovered = uiRows.filter((row) => row.status !== "covered");
  if (nonCovered.length > 0) {
    const summary = nonCovered.map((row) => `${row.specId}=${row.status}`).join(", ");
    fail(`UI-facing spec table still contains non-covered statuses: ${summary}`);
  }

  const gapSummary = parseGapSummary(markdown);
  if (gapSummary.partialOrMissing !== 0) {
    fail(
      `gap summary must report 0 partial/missing UI-facing specs, got ${gapSummary.partialOrMissing}`
    );
  }
  if (gapSummary.covered !== uiRows.length) {
    fail(
      `gap summary covered count (${gapSummary.covered}) must equal UI-facing table rows (${uiRows.length})`
    );
  }

  ensureUiQaDxCovered(markdown);

  console.log(
    `[storybook-matrix] passed (${storyFiles.length} files, ${actualCount} story exports, ${uiRows.length} UI specs covered)`
  );
}

main();
