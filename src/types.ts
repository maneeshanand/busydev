import type { CodexExecOutput } from "./invoke";

export type EventCategory = "message" | "command" | "file_change" | "status" | "error";

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
}

export interface RunEntry {
  id: number;
  prompt: string;
  output: CodexExecOutput;
  streamRows: StreamRow[];
  stopped?: boolean;
}

export interface PersistedRun {
  id: number;
  prompt: string;
  streamRows: StreamRow[];
  exitCode: number | null;
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
