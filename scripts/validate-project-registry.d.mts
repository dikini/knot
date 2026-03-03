export interface ProjectRegistrySpecFile {
  path: string;
  content: string;
}

export interface ProjectRegistryValidationInput {
  projectStateMarkdown: string;
  specFiles: ProjectRegistrySpecFile[];
  specMapMarkdown: string;
  roadmapMarkdown: string;
}

export interface ProjectRegistryValidationResult {
  ok: boolean;
  errors: string[];
}

export function deriveRoadmapStatusFromSpecStatus(status: string): string;

export function validateProjectRegistry(
  input: ProjectRegistryValidationInput
): ProjectRegistryValidationResult;
