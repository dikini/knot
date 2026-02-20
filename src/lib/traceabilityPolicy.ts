export const TRACE_ID_REGEX = /\b(?:DESIGN|BUG)-[a-z0-9][a-z0-9-]*\b/i;
const CHANGE_TYPE_REGEX = /^Change-Type:\s*(design-update|bug-fix|hybrid)\s*$/m;

export interface StagedPlanFile {
  path: string;
  content: string;
}

export interface TraceabilityInput {
  addedLines: string;
  stagedPlanFiles: StagedPlanFile[];
}

export interface TraceabilityResult {
  ok: boolean;
  errors: string[];
}

/**
 * SPEC: COMP-TRACE-LITE-001 FR-1 FR-2 FR-3
 */
export function validateStagedTraceability({
  addedLines,
  stagedPlanFiles,
}: TraceabilityInput): TraceabilityResult {
  const errors: string[] = [];

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
