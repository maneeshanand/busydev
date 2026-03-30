import type { CodexStreamEvent } from "../../invoke";
import type { AgentStreamAdapter, ClassifiedRow } from "./types";
import {
  classifyLifecycleEvent,
  classifyFallbackLine,
  cleanCommand,
  shortenPath,
  stripTodoMarkers,
} from "./shared";

function classifyEvent(event: CodexStreamEvent): ClassifiedRow {
  const lifecycle = classifyLifecycleEvent(event);
  if (lifecycle) return lifecycle;

  const value = event.parsedJson;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const type = typeof obj.type === "string" ? obj.type : "";

    if (type === "thread.started" || type === "turn.started" || type === "turn.completed") {
      return { category: "status", text: "", hidden: true };
    }

    const item =
      obj.item && typeof obj.item === "object" && !Array.isArray(obj.item)
        ? (obj.item as Record<string, unknown>)
        : null;

    if (item) {
      const itemType = typeof item.type === "string" ? item.type : "";

      if (itemType === "agent_message") {
        const raw = typeof item.text === "string" ? item.text.trim() : "";
        const text = stripTodoMarkers(raw);
        const isTodoSummary =
          /working on #\d/i.test(text) || (/todo/i.test(text) && /#\d/.test(text));
        return { category: "message", text: text || "Thinking...", isTodoSummary };
      }

      if (itemType === "command_execution") {
        const rawCmd = typeof item.command === "string" ? item.command : "command";
        const cmd = cleanCommand(rawCmd);
        const itemStatus = typeof item.status === "string" ? item.status : "";
        const exitCode = typeof item.exit_code === "number" ? item.exit_code : null;

        if (itemStatus === "in_progress") {
          return { category: "command", text: cmd, command: cmd, status: "running" };
        }
        if (itemStatus === "completed") {
          const failed = exitCode !== null && exitCode !== 0;
          return {
            category: "command",
            text: cmd,
            command: cmd,
            status: failed ? "failed" : "done",
            exitCode,
          };
        }
        return { category: "command", text: cmd, command: cmd, status: "running" };
      }

      if (itemType === "file_change") {
        const changes = Array.isArray(item.changes) ? item.changes : [];
        const paths = changes
          .map((c) => {
            if (
              c &&
              typeof c === "object" &&
              "path" in c &&
              typeof (c as Record<string, unknown>).path === "string"
            ) {
              return shortenPath((c as Record<string, unknown>).path as string);
            }
            return null;
          })
          .filter(Boolean) as string[];
        const count = changes.length;
        const text =
          paths.length > 0
            ? paths.join(", ")
            : count > 0
              ? `${count} file${count === 1 ? "" : "s"}`
              : "files";
        return { category: "file_change", text, filePaths: paths };
      }
    }
  }

  return classifyFallbackLine(event) ?? { category: "status", text: "", hidden: true };
}

function extractTextChunk(_event: CodexStreamEvent): string | null {
  // Codex delivers messages as complete agent_message items, not streamed chunks.
  return null;
}

function extractLastMessage(parsedJson: unknown): string | null {
  if (!Array.isArray(parsedJson)) return null;
  let lastMessage: string | null = null;

  for (const event of parsedJson) {
    if (!event || typeof event !== "object" || Array.isArray(event)) continue;
    const obj = event as Record<string, unknown>;

    const item = obj.item;
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const eventItem = item as Record<string, unknown>;
      if (eventItem.type === "agent_message") {
        const text = typeof eventItem.text === "string" ? eventItem.text.trim() : "";
        if (text) lastMessage = text;
      }
    }
  }

  return lastMessage;
}

export const codexAdapter: AgentStreamAdapter = {
  classifyEvent,
  extractTextChunk,
  extractLastMessage,
};
