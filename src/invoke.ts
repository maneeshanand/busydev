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
  previousPrompts?: string[]; // prompts from earlier runs for session context
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

export function writeToAgent(runId: string, data: string): Promise<void> {
  return invoke<void>("write_to_agent", { runId, data });
}

export function createWorktree(repoPath: string, worktreePath: string, branch: string): Promise<void> {
  return invoke<void>("create_worktree", { repoPath, worktreePath, branch });
}

export function deleteWorktree(repoPath: string, worktreePath: string): Promise<void> {
  return invoke<void>("delete_worktree", { repoPath, worktreePath });
}

export function isGitRepo(path: string): Promise<boolean> {
  return invoke<boolean>("is_git_repo", { path });
}
