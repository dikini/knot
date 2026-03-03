import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  deriveRoadmapStatusFromSpecStatus,
  validateProjectRegistry,
} from "../../scripts/validate-project-registry.mjs";

describe("deriveRoadmapStatusFromSpecStatus", () => {
  it("maps draft specs to planned roadmap state", () => {
    expect(deriveRoadmapStatusFromSpecStatus("draft")).toBe("planned");
  });

  it("maps implemented and verified specs to implemented roadmap state", () => {
    expect(deriveRoadmapStatusFromSpecStatus("implemented")).toBe("implemented");
    expect(deriveRoadmapStatusFromSpecStatus("verified")).toBe("implemented");
    expect(deriveRoadmapStatusFromSpecStatus("implemented (M0-M4)")).toBe("implemented");
  });
});

describe("validateProjectRegistry", () => {
  it("fails when spec-map status does not match component spec metadata", () => {
    const result = validateProjectRegistry({
      projectStateMarkdown:
        "# Knot Project State\n\nCanonical component registry: `docs/specs/system/spec-map.md`\n",
      specFiles: [
        {
          path: "docs/specs/component/demo-001.md",
          content: "# Demo\n\n## Metadata\n- ID: `COMP-DEMO-001`\n- Status: `draft`\n",
        },
      ],
      specMapMarkdown:
        "# Knot Specification Registry\n\n## Components\n\n| Spec ID | Component | Source | Path | Concerns | Status |\n| --- | --- | --- | --- | --- | --- |\n| COMP-DEMO-001 | demo | designed | component/demo-001.md | [REL] | implemented |\n\n## Interfaces\n",
      roadmapMarkdown:
        "# Roadmap Index\n\nRoadmap status is a planning view.\n\n| Workstream | Scope | Status | Owner | Dependencies | Target Specs |\n| --- | --- | --- | --- | --- | --- |\n| demo-001 | component | planned | - | [] | [COMP-DEMO-001] |\n",
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "docs/specs/system/spec-map.md row for COMP-DEMO-001 has status `implemented`, expected `draft`."
    );
  });

  it("fails when roadmap contradicts referenced spec status", () => {
    const result = validateProjectRegistry({
      projectStateMarkdown:
        "# Knot Project State\n\nCanonical component registry: `docs/specs/system/spec-map.md`\n",
      specFiles: [
        {
          path: "docs/specs/component/demo-001.md",
          content: "# Demo\n\n## Metadata\n- ID: `COMP-DEMO-001`\n- Status: `draft`\n",
        },
      ],
      specMapMarkdown:
        "# Knot Specification Registry\n\n## Components\n\n| Spec ID | Component | Source | Path | Concerns | Status |\n| --- | --- | --- | --- | --- | --- |\n| COMP-DEMO-001 | demo | designed | component/demo-001.md | [REL] | draft |\n\n## Interfaces\n",
      roadmapMarkdown:
        "# Roadmap Index\n\nRoadmap status is a planning view, not the canonical registry.\n\n| Workstream | Scope | Status | Owner | Dependencies | Target Specs |\n| --- | --- | --- | --- | --- | --- |\n| demo-001 | component | implemented | - | [] | [COMP-DEMO-001] |\n",
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "docs/planning/roadmap-index.md row for COMP-DEMO-001 has status `implemented`, expected `planned`."
    );
  });

  it("passes for an aligned fixture set", () => {
    const result = validateProjectRegistry({
      projectStateMarkdown:
        "# Knot Project State\n\nCanonical component registry: `docs/specs/system/spec-map.md`\nPlanning board: `docs/planning/roadmap-index.md`\n",
      specFiles: [
        {
          path: "docs/specs/component/demo-001.md",
          content: "# Demo\n\n## Metadata\n- ID: `COMP-DEMO-001`\n- Status: `implemented`\n",
        },
      ],
      specMapMarkdown:
        "# Knot Specification Registry\n\n## Components\n\n| Spec ID | Component | Source | Path | Concerns | Status |\n| --- | --- | --- | --- | --- | --- |\n| COMP-DEMO-001 | demo | designed | component/demo-001.md | [REL] | implemented |\n\n## Interfaces\n",
      roadmapMarkdown:
        "# Roadmap Index\n\nRoadmap status is a planning view, not the canonical registry.\n\n| Workstream | Scope | Status | Owner | Dependencies | Target Specs |\n| --- | --- | --- | --- | --- | --- |\n| demo-001 | component | implemented | - | [] | [COMP-DEMO-001] |\n",
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("passes for the repository docs", () => {
    const repoRoot = process.cwd();
    const componentSpecDir = resolve(repoRoot, "docs/specs/component");
    const specFiles = readdirSync(componentSpecDir)
      .filter((file) => file.endsWith(".md"))
      .map((file) => ({
        path: `docs/specs/component/${file}`,
        content: readFileSync(resolve(componentSpecDir, file), "utf8"),
      }));

    const result = validateProjectRegistry({
      projectStateMarkdown: readFileSync(resolve(repoRoot, "docs/PROJECT_STATE.md"), "utf8"),
      specFiles,
      specMapMarkdown: readFileSync(resolve(repoRoot, "docs/specs/system/spec-map.md"), "utf8"),
      roadmapMarkdown: readFileSync(resolve(repoRoot, "docs/planning/roadmap-index.md"), "utf8"),
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });
});
