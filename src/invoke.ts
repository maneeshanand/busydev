import { invoke } from "@tauri-apps/api/core";

export interface CodexExecInput {
  prompt: string;
  approvalPolicy: string;
  sandboxMode: string;
  workingDirectory: string;
  model?: string;
  skipGitRepoCheck: boolean;
}

export interface CodexExecOutput {
  stdoutRaw: string;
  stderrRaw: string;
  parsedJson: unknown | null;
  exitCode: number | null;
  durationMs: number;
}

export function runCodexExec(input: CodexExecInput): Promise<CodexExecOutput> {
  return invoke<CodexExecOutput>("run_codex_exec", { input });
}
