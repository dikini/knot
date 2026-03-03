import { describe, expect, it } from "vitest";
import {
  shouldValidateProjectRegistry,
  validateStagedWorkflow,
} from "../../scripts/validate-staged-workflow.mjs";

describe("shouldValidateProjectRegistry", () => {
  it("runs registry validation for component spec changes", () => {
    expect(
      shouldValidateProjectRegistry(["docs/specs/component/example-001.md"])
    ).toBe(true);
  });

  it("skips registry validation for unrelated source-only changes", () => {
    expect(shouldValidateProjectRegistry(["src/components/Editor/index.tsx"])).toBe(false);
  });
});

describe("validateStagedWorkflow", () => {
  it("fails when UI implementation changes are missing UI doc sync evidence", () => {
    const result = validateStagedWorkflow({
      stagedFiles: ["src/components/Editor/index.tsx"],
      addedLines: "DESIGN-workflow-freshness-hardening-021",
      stagedPlanFiles: [],
      projectRegistryResult: { ok: true, errors: [] },
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "UI implementation files changed without browser evidence updates. Add/update at least one spec in e2e/browser/*.spec.ts."
    );
  });

  it("fails when registry-relevant staged changes have registry drift", () => {
    const result = validateStagedWorkflow({
      stagedFiles: ["docs/specs/component/example-001.md"],
      addedLines: "DESIGN-workflow-freshness-hardening-021",
      stagedPlanFiles: [],
      projectRegistryResult: {
        ok: false,
        errors: ["docs/specs/system/spec-map.md is missing a component row for COMP-EXAMPLE-001."],
      },
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "docs/specs/system/spec-map.md is missing a component row for COMP-EXAMPLE-001."
    );
  });

  it("passes when traceability, UI doc sync, and registry inputs are aligned", () => {
    const result = validateStagedWorkflow({
      stagedFiles: [
        "src/components/Editor/index.tsx",
        "src/components/Editor/Editor.stories.tsx",
        "e2e/browser/editor.spec.ts",
        "docs/testing/ui-review-artifacts.md",
      ],
      addedLines: "DESIGN-workflow-freshness-hardening-021",
      stagedPlanFiles: [],
      projectRegistryResult: { ok: true, errors: [] },
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });
});
