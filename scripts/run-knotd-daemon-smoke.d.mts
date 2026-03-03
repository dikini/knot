export interface DaemonSmokeRuntime {
  repoRoot: string;
  runDir: string;
  socketPath: string;
  env: NodeJS.ProcessEnv;
}

export interface RunCommandInput {
  command: string;
  args: string[];
  env: NodeJS.ProcessEnv;
  repoRoot: string;
}

export interface RunCommandResult {
  status: number;
  stderr?: string;
  stdout?: string;
}

export function resolveDaemonSmokeRuntime(options?: {
  repoRoot?: string;
  env?: NodeJS.ProcessEnv;
}): DaemonSmokeRuntime;

export function runLocalCiDaemonSmoke(options?: {
  repoRoot?: string;
  env?: NodeJS.ProcessEnv;
  runCommand?: (input: RunCommandInput) => RunCommandResult;
  log?: (message: string) => void;
}): DaemonSmokeRuntime;
