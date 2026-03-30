import type { CodexStreamEvent } from "../../invoke";
import type { AgentStreamAdapter, ClassifiedRow } from "./types";
import {
  classifyLifecycleEvent,
  classifyFallbackLine,
  formatToolSummary,
} from "./shared";

function classifyEvent(event: CodexStreamEvent): ClassifiedRow {
  const lifecycle = classifyLifecycleEvent(event);
  if (lifecycle) return lifecycle;

  const value = event.parsedJson;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const type = typeof obj.type === "string" ? obj.type : "";

    // init — hide
    if (type === "init") {
      return { category: "status", text: "", hidden: true };
    }

    // user message echo — hide
    if (type === "message" && obj.role === "user") {
      return { category: "status", text: "", hidden: true };
    }

    // assistant message (streaming delta or full)
    if (type === "message" && obj.role === "assistant") {
      const text = typeof obj.content === "string" ? obj.content.trim() : "";
      if (!text) return { category: "status", text: "", hidden: true };
      return { category: "message", text };
    }

    // tool_use — map Gemini tool names to summaries
    if (type === "tool_use") {
      const toolName = typeof obj.tool_name === "string" ? obj.tool_name : "tool";
      const params = obj.parameters as Record<string, unknown> | undefined;

      let filePath: string | undefined;
      let command: string | undefined;
      let pattern: string | undefined;
      let query: string | undefined;
      let url: string | undefined;
      let dirPath: string | undefined;

      if (params) {
        if (typeof params.file_path === "string") filePath = params.file_path;
        if (typeof params.command === "string") command = params.command;
        if (typeof params.pattern === "string") pattern = params.pattern;
        if (typeof params.query === "string") query = params.query;
        if (typeof params.url === "string") url = params.url;

        // list_directory / ls: prefer directory_path, fall back to path
        if (toolName === "list_directory" || toolName === "ls") {
          if (typeof params.directory_path === "string") {
            dirPath = params.directory_path;
          } else if (typeof params.path === "string") {
            dirPath = params.path;
          }
        }
      }

      const summary = formatToolSummary({
        name: toolName,
        filePath,
        command,
        pattern,
        query,
        url,
        dirPath,
      });

      return { category: "command", text: summary, command: summary, status: "running" };
    }

    // tool_result — mark previous tool as done
    if (type === "tool_result") {
      return { category: "command", text: "", command: "", status: "done" };
    }

    // final result — format stats
    if (type === "result") {
      const stats = obj.stats as Record<string, unknown> | undefined;
      const toolCalls =
        typeof stats?.tool_calls === "number" && stats.tool_calls > 0
          ? `${stats.tool_calls} tool calls`
          : "";
      const tokens =
        typeof stats?.total_tokens === "number" ? `${stats.total_tokens} tokens` : "";
      const duration =
        typeof stats?.duration_ms === "number"
          ? `${(stats.duration_ms / 1000).toFixed(1)}s`
          : "";
      const parts = [toolCalls, tokens, duration].filter(Boolean).join(" · ");
      return { category: "status", text: parts || "Done" };
    }
  }

  return classifyFallbackLine(event) ?? { category: "status", text: "", hidden: true };
}

function extractTextChunk(event: CodexStreamEvent): string | null {
  const value = event.parsedJson;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;

  // Return text from all assistant messages (delta and non-delta).
  // This ensures they go through the append-chunk path in App.tsx
  // and classifyEvent doesn't create duplicate message rows.
  if (obj.type === "message" && obj.role === "assistant") {
    const text = typeof obj.content === "string" ? obj.content : "";
    return text.length > 0 ? text : null;
  }

  return null;
}

function extractLastMessage(parsedJson: unknown): string | null {
  if (!Array.isArray(parsedJson)) return null;
  let lastMessage: string | null = null;

  for (const event of parsedJson) {
    if (!event || typeof event !== "object" || Array.isArray(event)) continue;
    const obj = event as Record<string, unknown>;

    if (obj.type === "message" && obj.role === "assistant") {
      const content = typeof obj.content === "string" ? obj.content.trim() : "";
      if (content) lastMessage = content;
    }
  }

  return lastMessage;
}

export const geminiAdapter: AgentStreamAdapter = {
  classifyEvent,
  extractTextChunk,
  extractLastMessage,
};
