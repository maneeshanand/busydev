import { invoke } from "@tauri-apps/api/core";

export const CODEX_STREAM_EVENT = "codex://stream";

export interface CodexExecInput {
  runId: string;
  agent?: string; // "codex" (default) or "claude"
  prompt: string;
  approvalPolicy: string;
  sandboxMode: string;
  workingDirectory: string;
  model?: string;
  skipGitRepoCheck: boolean;
}

export interface CodexStreamEvent {
  runId: string;
  kind: "started" | "stdout" | "stderr" | "completed" | "spawn_error";
  line?: string;
  parsedJson?: unknown | null;
  exitCode?: number | null;
  durationMs?: number;
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

export function stopCodexExec(runId?: string): Promise<void> {
  return invoke<void>("stop_codex_exec", { runId: runId ?? null });
}
