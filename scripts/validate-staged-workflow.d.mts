export interface StagedWorkflowPlanFile {
  path: string;
  content: string;
}

export interface StagedWorkflowValidationInput {
  stagedFiles: string[];
  addedLines: string;
  stagedPlanFiles: StagedWorkflowPlanFile[];
  projectRegistryResult: {
    ok: boolean;
    errors: string[];
  };
}

export interface StagedWorkflowValidationResult {
  ok: boolean;
  errors: string[];
}

export function shouldValidateProjectRegistry(stagedFiles: string[]): boolean;

export function validateStagedWorkflow(
  input: StagedWorkflowValidationInput
): StagedWorkflowValidationResult;
