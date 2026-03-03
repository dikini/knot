#!/usr/bin/env node
/* eslint-env node */
// Trace: DESIGN-doc-registry-alignment-020

import fs from "node:fs";
import path from "node:path";

const COMPONENT_SECTION_REGEX = /## Components\s*\n\s*\n([\s\S]*?)\n## Interfaces/;
const TABLE_ROW_REGEX = /^\|/;
const SPEC_ID_REGEX = /^(?:- )?(?:ID|Spec-ID):\s*`?([^`\n]+)`?/m;
const STATUS_REGEX = /^(?:- )?Status:\s*`?([^`\n]+)`?/m;
const CANONICAL_REGISTRY_LINE =
  "Canonical component registry: `docs/specs/system/spec-map.md`";
const PLANNING_BOARD_LINE =
  "Planning board: `docs/planning/roadmap-index.md`";

function cleanCell(value) {
  return value.trim().replace(/^`|`$/g, "");
}

function parseMarkdownTableRows(markdown) {
  return markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => TABLE_ROW_REGEX.test(line))
    .filter((line) => !line.includes("| ---"))
    .map((line) =>
      line
        .split("|")
        .map((cell) => cleanCell(cell))
        .filter(Boolean)
    );
}

function parseSpecMetadata(pathname, content) {
  const id = content.match(SPEC_ID_REGEX)?.[1]?.trim() ?? null;
  const status = content.match(STATUS_REGEX)?.[1]?.trim() ?? null;
  return { path: pathname, id, status };
}

function parseSpecMapRows(markdown) {
  const section = markdown.match(COMPONENT_SECTION_REGEX)?.[1];
  if (!section) {
    return [];
  }

  return parseMarkdownTableRows(section).map((cells) => ({
    specId: cells[0] ?? "",
    component: cells[1] ?? "",
    source: cells[2] ?? "",
    path: cells[3] ?? "",
    concerns: cells[4] ?? "",
    status: cells[5] ?? "",
  }));
}

function parseRoadmapRows(markdown) {
  return parseMarkdownTableRows(markdown).map((cells) => ({
    workstream: cells[0] ?? "",
    scope: cells[1] ?? "",
    status: cells[2] ?? "",
    owner: cells[3] ?? "",
    dependencies: cells[4] ?? "",
    targetSpecs: cells[5] ?? "",
  }));
}

export function deriveRoadmapStatusFromSpecStatus(status) {
  const normalized = status.trim().toLowerCase();
  if (normalized.startsWith("draft")) {
    return "planned";
  }
  return "implemented";
}

export function validateProjectRegistry({
  projectStateMarkdown,
  specFiles,
  specMapMarkdown,
  roadmapMarkdown,
}) {
  const errors = [];

  if (!projectStateMarkdown.includes(CANONICAL_REGISTRY_LINE)) {
    errors.push(
      "docs/PROJECT_STATE.md must declare `docs/specs/system/spec-map.md` as the canonical component registry."
    );
  }

  if (!projectStateMarkdown.includes(PLANNING_BOARD_LINE)) {
    errors.push(
      "docs/PROJECT_STATE.md must declare `docs/planning/roadmap-index.md` as the planning board."
    );
  }

  if (projectStateMarkdown.includes("## Component Status Overview")) {
    errors.push(
      "docs/PROJECT_STATE.md must not duplicate the old component status overview table."
    );
  }

  const specMetadata = specFiles.map(({ path, content }) => parseSpecMetadata(path, content));

  for (const spec of specMetadata) {
    if (!spec.id) {
      errors.push(`${spec.path} is missing an ID/Spec-ID header.`);
    }
    if (!spec.status) {
      errors.push(`${spec.path} is missing a Status header.`);
    }
  }

  const validSpecs = specMetadata.filter((spec) => spec.id && spec.status);
  const specMapRows = parseSpecMapRows(specMapMarkdown);
  const specMapById = new Map(specMapRows.map((row) => [row.specId, row]));

  for (const spec of validSpecs) {
    const row = specMapById.get(spec.id);
    if (!row) {
      errors.push(
        `docs/specs/system/spec-map.md is missing a component row for ${spec.id}.`
      );
      continue;
    }

    const expectedPath = spec.path.replace(/^docs\/specs\//, "");
    if (row.path !== expectedPath) {
      errors.push(
        `docs/specs/system/spec-map.md row for ${spec.id} has path \`${row.path}\`, expected \`${expectedPath}\`.`
      );
    }

    if (row.status !== spec.status) {
      errors.push(
        `docs/specs/system/spec-map.md row for ${spec.id} has status \`${row.status}\`, expected \`${spec.status}\`.`
      );
    }
  }

  const roadmapRows = parseRoadmapRows(roadmapMarkdown);
  if (!/planning view, not the canonical registry/i.test(roadmapMarkdown)) {
    errors.push(
      "docs/planning/roadmap-index.md must describe itself as a planning view, not the canonical registry."
    );
  }

  for (const row of roadmapRows) {
    const targetSpecId = row.targetSpecs.match(/(COMP-[A-Z0-9-]+)/)?.[1];
    if (!targetSpecId) {
      continue;
    }
    const spec = validSpecs.find((entry) => entry.id === targetSpecId);
    if (!spec) {
      continue;
    }
    const expectedStatus = deriveRoadmapStatusFromSpecStatus(spec.status);
    if (row.status !== expectedStatus) {
      errors.push(
        `docs/planning/roadmap-index.md row for ${targetSpecId} has status \`${row.status}\`, expected \`${expectedStatus}\`.`
      );
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

function readRepositorySources(repoRoot) {
  const componentSpecDir = path.join(repoRoot, "docs", "specs", "component");
  const specFiles = fs
    .readdirSync(componentSpecDir)
    .filter((file) => file.endsWith(".md"))
    .sort()
    .map((file) => ({
      path: path.posix.join("docs/specs/component", file),
      content: fs.readFileSync(path.join(componentSpecDir, file), "utf8"),
    }));

  return {
    projectStateMarkdown: fs.readFileSync(
      path.join(repoRoot, "docs", "PROJECT_STATE.md"),
      "utf8"
    ),
    specFiles,
    specMapMarkdown: fs.readFileSync(
      path.join(repoRoot, "docs", "specs", "system", "spec-map.md"),
      "utf8"
    ),
    roadmapMarkdown: fs.readFileSync(
      path.join(repoRoot, "docs", "planning", "roadmap-index.md"),
      "utf8"
    ),
  };
}

function main() {
  const result = validateProjectRegistry(readRepositorySources(process.cwd()));

  if (!result.ok) {
    console.error("Project registry check failed:");
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log("[project-registry] passed");
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main();
}
