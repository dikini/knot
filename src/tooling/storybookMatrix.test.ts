import { describe, expect, it } from "vitest";
import {
  ensureUiQaDxCovered,
  parseGapSummary,
  parseUiSpecRows,
} from "../../scripts/validate-storybook-coverage-matrix.mjs";

const compactMarkdown = `# Storybook Design Coverage Inventory

### UI-facing specs

| Spec ID | Status | Evidence | Gap |
| --- | --- | --- | --- |
| \`COMP-ICON-CHROME-001\` | covered | \`IconButton.stories.tsx\` | None |

### Process/tooling specs (Storybook stories not primary artifact)

| Spec ID | Status | Notes |
| --- | --- | --- |
| \`COMP-UI-QA-DX-001\` | covered | \`scripts/validate-storybook-coverage-matrix.mjs\` | None |

## Gap Summary

- UI-facing specs missing or partial story coverage: \`0\`
- UI-facing specs fully covered: \`1\`
`;

const alignedMarkdown = `# Storybook Design Coverage Inventory

### UI-facing specs

| Spec ID                          | Status  | Evidence                    | Gap  |
| -------------------------------- | ------- | --------------------------- | ---- |
| \`COMP-ICON-CHROME-001\`           | covered | \`IconButton.stories.tsx\`    | None |

### Process/tooling specs (Storybook stories not primary artifact)

| Spec ID                     | Status  | Notes                                           |
| --------------------------- | ------- | ----------------------------------------------- |
| \`COMP-UI-QA-DX-001\`         | covered | \`scripts/validate-storybook-coverage-matrix.mjs\` | None |

## Gap Summary

- UI-facing specs missing or partial story coverage: \`0\`
- UI-facing specs fully covered: \`1\`
`;

describe("parseUiSpecRows", () => {
  it("parses compact markdown tables", () => {
    expect(parseUiSpecRows(compactMarkdown)).toEqual([
      { specId: "COMP-ICON-CHROME-001", status: "covered" },
    ]);
  });

  it("parses aligned markdown tables emitted by prettier", () => {
    expect(parseUiSpecRows(alignedMarkdown)).toEqual([
      { specId: "COMP-ICON-CHROME-001", status: "covered" },
    ]);
  });
});

describe("parseGapSummary", () => {
  it("parses the gap summary counts", () => {
    expect(parseGapSummary(alignedMarkdown)).toEqual({
      partialOrMissing: 0,
      covered: 1,
    });
  });
});

describe("ensureUiQaDxCovered", () => {
  it("accepts the process/tooling row with aligned table spacing", () => {
    expect(() => ensureUiQaDxCovered(alignedMarkdown)).not.toThrow();
  });
});
