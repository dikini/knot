import { describe, expect, it } from "vitest";
import {
  TRACE_ID_REGEX,
  validateStagedTraceability
} from "./traceabilityPolicy";

describe("validateStagedTraceability", () => {
  it("fails when staged changes have no trace ID", () => {
    const result = validateStagedTraceability({
      addedLines: "const nextMode = 'graph';",
      stagedPlanFiles: [],
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "Missing trace ID in staged additions. Add DESIGN-<slug> or BUG-<slug>."
    );
  });

  it("requires Change-Type in staged plan files", () => {
    const result = validateStagedTraceability({
      addedLines: "BUG-note-editor-default-view",
      stagedPlanFiles: [
        {
          path: "docs/plans/traceability-lite-001-plan.md",
          content: "# Plan\n\nTrace: BUG-note-editor-default-view\n",
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "docs/plans/traceability-lite-001-plan.md is missing `Change-Type: design-update|bug-fix|hybrid` in the header."
    );
  });

  it("passes when trace ID exists and plan header is valid", () => {
    const result = validateStagedTraceability({
      addedLines:
        "Change-Type: bug-fix\nTrace: BUG-note-editor-default-view\nit('BUG-note-editor-default-view')",
      stagedPlanFiles: [
        {
          path: "docs/plans/traceability-lite-001-plan.md",
          content:
            "# Implementation Plan\n\nChange-Type: bug-fix\nTrace: BUG-note-editor-default-view\n",
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

describe("TRACE_ID_REGEX", () => {
  it("matches DESIGN and BUG trace IDs", () => {
    expect("DESIGN-shell-layout-defaults").toMatch(TRACE_ID_REGEX);
    expect("BUG-note-editor-default-view").toMatch(TRACE_ID_REGEX);
  });
});
