import type { CodexExecOutput } from "./invoke";

export type EventCategory = "message" | "command" | "file_change" | "status" | "error" | "approval";

export interface StreamRow {
  id: number;
  category: EventCategory;
  text: string;
  command?: string;
  exitCode?: number | null;
  status?: "running" | "done" | "failed";
  filePaths?: string[];
  hidden?: boolean;
  isTodoSummary?: boolean;
  // Approval request fields (Claude permission prompts)
  requestId?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  approvalState?: "pending" | "approved" | "denied";
}

export interface RunEntry {
  id: number;
  prompt: string;
  output: CodexExecOutput;
  streamRows: StreamRow[];
  stopped?: boolean;
  completedAt?: number;
}

export interface PersistedRun {
  id: number;
  prompt: string;
  streamRows: StreamRow[];
  exitCode: number | null;
  completedAt?: number;
  durationMs: number;
  finalSummary: string;
  stopped?: boolean;
}

export interface InFlightRun {
  id: number;
  runId: string;
  prompt: string;
  streamRows: StreamRow[];
}

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  source: "user" | "agent";
  createdAt: number;
  completedAt?: number;
}

export interface SavedPromptEntry {
  id: string;
  name: string;
  kind: "prompt" | "function";
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface Session {
  id: string;
  projectId: string;
  name: string;
  createdAt: number;
  runs: PersistedRun[];
  todos: TodoItem[];
  agent?: string;
  model?: string;
  approvalPolicy?: string;
  sandboxMode?: string;
  worktreePath?: string;
  worktreeBranch?: string;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  createdAt: number;
  sessions: Session[];
  activeSessionId: string | null;
}
