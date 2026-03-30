import type { CodexStreamEvent } from "../../invoke";
import type { ClassifiedRow } from "./types";

// ---------------------------------------------------------------------------
// cleanCommand
// Strips shell wrapper like `/bin/zsh -lc '...'` to show the inner command.
// ---------------------------------------------------------------------------
export function cleanCommand(raw: string): string {
  const m = raw.match(/^\/bin\/(?:ba|z)?sh\s+-\w*c\s+['"](.+)['"]$/s);
  if (m) return m[1];
  const m2 = raw.match(/^\/bin\/(?:ba|z)?sh\s+-\w*c\s+'(.+)'$/s);
  return m2 ? m2[1] : raw;
}

// ---------------------------------------------------------------------------
// shortenPath
// Keeps only the last 2 path segments for brevity.
// ---------------------------------------------------------------------------
export function shortenPath(path: string): string {
  const parts = path.split("/");
  return parts.length > 2 ? parts.slice(-2).join("/") : path;
}

// ---------------------------------------------------------------------------
// isNoisyInfraOutput
// Returns true for stderr/stdout lines that are low-signal infrastructure
// noise and should be hidden from the stream view.
// ---------------------------------------------------------------------------
export function isNoisyInfraOutput(text: string): boolean {
  return /(rmcp::transport::worker|unexpectedcontenttype|transport channel closed|cloudflare|cf-error|<!doctype html>|cdn-cgi\/styles|yolo mode is enabled|loaded cached credentials)/i.test(
    text
  );
}

// ---------------------------------------------------------------------------
// stripTodoMarkers
// Removes DONE: and ADD_TODO: lines emitted by the agent for internal
// bookkeeping so they don't surface in the UI.
// ---------------------------------------------------------------------------
export function stripTodoMarkers(text: string): string {
  return text
    .replace(/^\s*DONE:\s*\d+\s*[.)]?\s*$/gim, "")
    .replace(/^\s*ADD_TODO:\s*.+\s*$/gim, "")
    .trim();
}

// ---------------------------------------------------------------------------
// ToolInfo
// Normalized tool descriptor shared by all adapters.
// ---------------------------------------------------------------------------
export interface ToolInfo {
  name: string;
  filePath?: string;
  command?: string;
  pattern?: string;
  query?: string;
  url?: string;
  dirPath?: string;
}

// ---------------------------------------------------------------------------
// formatToolSummary
// Maps a ToolInfo to a human-readable one-line summary.
// Handles both Claude tool names (Read, Edit, Write, Bash, Glob, Grep,
// WebSearch, WebFetch) and Gemini tool names (read_file, read_many_files,
// edit, write_file, shell, glob, grep, web_search, web_fetch,
// list_directory, ls).
// ---------------------------------------------------------------------------
export function formatToolSummary(tool: ToolInfo): string {
  const { name, filePath, command, pattern, query, url, dirPath } = tool;

  // Claude tool names
  if (name === "Read" && filePath) return `Read ${shortenPath(filePath)}`;
  if (name === "Edit" && filePath) return `Edit ${shortenPath(filePath)}`;
  if (name === "Write" && filePath) return `Write ${shortenPath(filePath)}`;
  if (name === "Bash" && command) return cleanCommand(command);
  if (name === "Glob" && pattern) return `Glob ${pattern}`;
  if (name === "Grep" && pattern) return `Grep ${pattern}`;
  if (name === "WebSearch" && query) return `Search: ${query}`;
  if (name === "WebFetch" && url) return `Fetch ${url}`;

  // Gemini tool names
  if ((name === "read_file" || name === "read_many_files") && filePath)
    return `Read ${shortenPath(filePath)}`;
  if (name === "edit" && filePath) return `Edit ${shortenPath(filePath)}`;
  if (name === "write_file" && filePath) return `Write ${shortenPath(filePath)}`;
  if (name === "shell" && command) return cleanCommand(command);
  if (name === "glob" && pattern) return `Glob ${pattern}`;
  if (name === "grep" && pattern) return `Grep ${pattern}`;
  if (name === "web_search" && query) return `Search: ${query}`;
  if (name === "web_fetch" && url) return `Fetch ${url}`;
  if ((name === "list_directory" || name === "ls") && dirPath)
    return `ls ${shortenPath(dirPath)}`;
  if (name === "list_directory" || name === "ls") return `ls .`;

  return name;
}

// ---------------------------------------------------------------------------
// classifyLifecycleEvent
// Handles the non-stdout lifecycle events emitted by the Tauri runner:
// completed, started, spawn_error, and stderr (with noise filtering).
// Returns null if the event is not a lifecycle event.
// ---------------------------------------------------------------------------
export function classifyLifecycleEvent(
  event: CodexStreamEvent
): ClassifiedRow | null {
  if (event.kind === "completed") {
    return { category: "status", text: "", hidden: true };
  }
  if (event.kind === "started") {
    return { category: "status", text: "Starting...", hidden: true };
  }
  if (event.kind === "spawn_error") {
    return { category: "error", text: event.line ?? "Failed to start process" };
  }
  if (event.kind === "stderr") {
    const text = event.line?.trim() || "stderr output";
    if (isNoisyInfraOutput(text)) {
      return { category: "status", text: "", hidden: true };
    }
    const clipped = text.length > 260 ? `${text.slice(0, 260)}...` : text;
    return { category: "error", text: clipped };
  }
  return null;
}

// ---------------------------------------------------------------------------
// classifyFallbackLine
// Handles unstructured stdout lines (non-JSON) as plain messages.
// Returns null if the line is empty or absent.
// ---------------------------------------------------------------------------
export function classifyFallbackLine(
  event: CodexStreamEvent
): ClassifiedRow | null {
  if (!event.line || event.line.trim().length === 0) return null;
  const trimmed = event.line.trim();
  if (isNoisyInfraOutput(trimmed)) {
    return { category: "status", text: "", hidden: true };
  }
  const text = trimmed.length > 220 ? `${trimmed.slice(0, 220)}...` : trimmed;
  return { category: "message", text };
}
