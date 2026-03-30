import type { CodexStreamEvent } from "../../invoke";
import type { AgentStreamAdapter, ClassifiedRow } from "./types";
import {
  classifyLifecycleEvent,
  classifyFallbackLine,
  cleanCommand,
  formatToolSummary,
  shortenPath,
  stripTodoMarkers,
} from "./shared";
import type { ToolInfo } from "./shared";

function classifyEvent(event: CodexStreamEvent): ClassifiedRow {
  const lifecycle = classifyLifecycleEvent(event);
  if (lifecycle) return lifecycle;

  const value = event.parsedJson;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const type = typeof obj.type === "string" ? obj.type : "";

    if (type === "system") {
      return { category: "status", text: "", hidden: true };
    }

    if (type === "rate_limit_event") {
      return { category: "status", text: "", hidden: true };
    }

    if (type === "control_request") {
      const request = obj.request as Record<string, unknown> | undefined;
      if (request?.subtype === "can_use_tool") {
        const toolName = typeof request.tool_name === "string" ? request.tool_name : "unknown";
        const input = request.input as Record<string, unknown> | undefined;
        const requestId = typeof obj.request_id === "string" ? obj.request_id : "";

        let summary: string;
        if (toolName === "Bash" && input?.command) {
          summary = `Bash: ${cleanCommand(String(input.command))}`;
        } else if ((toolName === "Edit" || toolName === "Write" || toolName === "Read") && input?.file_path) {
          summary = `${toolName}: ${shortenPath(String(input.file_path))}`;
        } else {
          summary = toolName;
        }

        return {
          category: "approval",
          text: summary,
          toolName,
          toolInput: input ?? {},
          requestId,
          approvalState: "pending" as const,
        };
      }
    }

    if (type === "assistant") {
      const message = obj.message as Record<string, unknown> | undefined;
      const content = message?.content;
      if (Array.isArray(content) && content.length > 0) {
        const block = content[content.length - 1] as Record<string, unknown>;
        const blockType = typeof block.type === "string" ? block.type : "";

        if (blockType === "thinking") {
          const thinking = typeof block.thinking === "string" ? block.thinking.trim() : "";
          if (!thinking) return { category: "status", text: "", hidden: true };
          const display = thinking.length > 200 ? `${thinking.slice(0, 200)}...` : thinking;
          return { category: "message", text: display };
        }

        if (blockType === "tool_use") {
          const toolName = typeof block.name === "string" ? block.name : "tool";
          const input = block.input as Record<string, unknown> | undefined;
          const toolInfo: ToolInfo = {
            name: toolName,
            filePath: input?.file_path != null ? String(input.file_path) : undefined,
            command: input?.command != null ? String(input.command) : undefined,
            pattern: input?.pattern != null ? String(input.pattern) : undefined,
            query: input?.query != null ? String(input.query) : undefined,
            url: input?.url != null ? String(input.url) : undefined,
          };
          const summary = formatToolSummary(toolInfo);
          return { category: "command", text: summary, command: summary, status: "running" };
        }

        if (blockType === "text") {
          const raw = typeof block.text === "string" ? block.text.trim() : "";
          const text = stripTodoMarkers(raw);
          if (!text) return { category: "status", text: "", hidden: true };
          const isTodoSummary = /working on #\d/i.test(text) || (/todo/i.test(text) && /#\d/.test(text));
          return { category: "message", text, isTodoSummary };
        }
      }
      return { category: "status", text: "", hidden: true };
    }

    if (type === "user") {
      const toolResult = obj.tool_use_result as Record<string, unknown> | undefined;
      if (toolResult) {
        return { category: "command", text: "", command: "", status: "done" };
      }
      return { category: "status", text: "", hidden: true };
    }

    if (type === "result") {
      const cost = typeof obj.total_cost_usd === "number" ? `$${obj.total_cost_usd.toFixed(4)}` : "";
      const turns = typeof obj.num_turns === "number" ? `${obj.num_turns} turns` : "";
      const parts = [turns, cost].filter(Boolean).join(" · ");
      return { category: "status", text: parts || "Done" };
    }
  }

  return classifyFallbackLine(event) ?? { category: "status", text: "", hidden: true };
}

function extractTextChunk(event: CodexStreamEvent): string | null {
  const value = event.parsedJson;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  if (obj.type !== "assistant") return null;
  const message = obj.message as Record<string, unknown> | undefined;
  const content = message?.content;
  if (!Array.isArray(content) || content.length === 0) return null;
  const lastBlock = content[content.length - 1] as Record<string, unknown>;
  if (lastBlock.type !== "text") return null;
  return typeof lastBlock.text === "string" ? lastBlock.text : null;
}

function extractLastMessage(parsedJson: unknown): string | null {
  if (!Array.isArray(parsedJson)) return null;
  let lastMessage: string | null = null;

  for (const event of parsedJson) {
    if (!event || typeof event !== "object" || Array.isArray(event)) continue;
    const obj = event as Record<string, unknown>;

    if (obj.type === "assistant") {
      const message = obj.message as Record<string, unknown> | undefined;
      const content = message?.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block && typeof block === "object" && (block as Record<string, unknown>).type === "text") {
            const text = typeof (block as Record<string, unknown>).text === "string"
              ? ((block as Record<string, unknown>).text as string).trim()
              : "";
            if (text) lastMessage = text;
          }
        }
      }
    }
  }

  return lastMessage;
}

export const claudeAdapter: AgentStreamAdapter = {
  classifyEvent,
  extractTextChunk,
  extractLastMessage,
};
