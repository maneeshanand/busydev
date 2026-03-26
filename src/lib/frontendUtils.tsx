import React from "react";
import type { CodexExecOutput, CodexStreamEvent } from "../invoke";
import type { StreamRow, TodoItem } from "../types";

export type ClassifiedRow = Omit<StreamRow, "id">;

function extractLastAgentMessage(parsedJson: unknown): string | null {
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

export function stripTodoMarkers(text: string): string {
  return text
    .replace(/^\s*DONE:\s*\d+\s*[.)]?\s*$/gim, "")
    .replace(/^\s*ADD_TODO:\s*.+\s*$/gim, "")
    .trim();
}

export function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return time;
  const date = d.toLocaleDateString([], { month: "short", day: "numeric" });
  return `${date}, ${time}`;
}

export function cleanCommand(raw: string): string {
  const m = raw.match(/^\/bin\/(?:ba|z)?sh\s+-\w*c\s+['"](.+)['"]$/s);
  if (m) return m[1];
  const m2 = raw.match(/^\/bin\/(?:ba|z)?sh\s+-\w*c\s+'(.+)'$/s);
  return m2 ? m2[1] : raw;
}

function shortenPath(path: string): string {
  const parts = path.split("/");
  return parts.length > 2 ? parts.slice(-2).join("/") : path;
}

export function classifyEvent(event: CodexStreamEvent): ClassifiedRow {
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
    return { category: "error", text };
  }

  const value = event.parsedJson;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const type = typeof obj.type === "string" ? obj.type : "";

    if (type === "system") {
      const subtype = typeof obj.subtype === "string" ? obj.subtype : "";
      if (subtype === "init") {
        return { category: "status", text: "", hidden: true };
      }
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

        let summary = toolName;
        if (toolName === "Bash" && input?.command) {
          summary = `Bash: ${cleanCommand(String(input.command))}`;
        } else if ((toolName === "Edit" || toolName === "Write" || toolName === "Read") && input?.file_path) {
          summary = `${toolName}: ${shortenPath(String(input.file_path))}`;
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
          let summary = toolName;
          if (toolName === "Read" && input?.file_path) {
            summary = `Read ${shortenPath(String(input.file_path))}`;
          } else if (toolName === "Edit" && input?.file_path) {
            summary = `Edit ${shortenPath(String(input.file_path))}`;
          } else if (toolName === "Write" && input?.file_path) {
            summary = `Write ${shortenPath(String(input.file_path))}`;
          } else if (toolName === "Bash" && input?.command) {
            summary = cleanCommand(String(input.command));
          } else if (toolName === "Glob" && input?.pattern) {
            summary = `Glob ${String(input.pattern)}`;
          } else if (toolName === "Grep" && input?.pattern) {
            summary = `Grep ${String(input.pattern)}`;
          } else if (toolName === "WebSearch" && input?.query) {
            summary = `Search: ${String(input.query)}`;
          } else if (toolName === "WebFetch" && input?.url) {
            summary = `Fetch ${String(input.url)}`;
          }
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

    const item = obj.item && typeof obj.item === "object" && !Array.isArray(obj.item)
      ? (obj.item as Record<string, unknown>)
      : null;

    if (type === "thread.started" || type === "turn.started") {
      return { category: "status", text: "", hidden: true };
    }

    if (type === "turn.completed") {
      return { category: "status", text: "", hidden: true };
    }

    if (item) {
      const itemType = typeof item.type === "string" ? item.type : "";

      if (itemType === "agent_message") {
        const raw = typeof item.text === "string" ? item.text.trim() : "";
        const text = stripTodoMarkers(raw);
        const isTodoSummary = /working on #\d/i.test(text) || (/todo/i.test(text) && /#\d/.test(text));
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
            if (c && typeof c === "object" && "path" in c && typeof (c as Record<string, unknown>).path === "string") {
              return shortenPath((c as Record<string, unknown>).path as string);
            }
            return null;
          })
          .filter(Boolean) as string[];
        const count = changes.length;
        const text = paths.length > 0
          ? paths.join(", ")
          : count > 0 ? `${count} file${count === 1 ? "" : "s"}` : "files";
        return { category: "file_change", text, filePaths: paths };
      }
    }
  }

  if (event.line && event.line.trim().length > 0) {
    const trimmed = event.line.trim();
    const text = trimmed.length > 220 ? `${trimmed.slice(0, 220)}...` : trimmed;
    return { category: "message", text };
  }

  return { category: "status", text: "", hidden: true };
}

function normalizeMessageText(text: string): string {
  return stripTodoMarkers(text).replace(/\s+/g, " ").trim();
}

export function shouldRenderFinalSummary(streamRows: StreamRow[], finalSummary: string): boolean {
  const normalizedSummary = normalizeMessageText(finalSummary);
  if (!normalizedSummary) return false;

  for (let i = streamRows.length - 1; i >= 0; i -= 1) {
    const row = streamRows[i];
    if (row.hidden || row.category !== "message") continue;
    const normalizedRow = normalizeMessageText(row.text);
    if (!normalizedRow) continue;
    return normalizedRow !== normalizedSummary;
  }

  return true;
}

export function formatInline(text: string, onOpenPath?: (path: string) => void): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|`([^`]+)`|\*(.+?)\*|(\/[\w./-]+\.\w+))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(<strong key={key++}>{match[2]}</strong>);
    } else if (match[3]) {
      const code = match[3];
      if (/^\/[\w./-]+\.\w+$/.test(code)) {
        const clickable = typeof onOpenPath === "function";
        parts.push(
          <code
            key={key++}
            className="fmt-code fmt-path"
            onClick={clickable ? () => onOpenPath(code) : undefined}
            title={clickable ? "Open file" : undefined}
          >
            {code}
          </code>
        );
      } else {
        parts.push(<code key={key++} className="fmt-code">{code}</code>);
      }
    } else if (match[4]) {
      parts.push(<em key={key++}>{match[4]}</em>);
    } else if (match[5]) {
      const path = match[5];
      const clickable = typeof onOpenPath === "function";
      parts.push(
        <span
          key={key++}
          className="fmt-path"
          onClick={clickable ? () => onOpenPath(path) : undefined}
          title={clickable ? "Open file" : undefined}
        >
          {path}
        </span>
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 0 ? text : parts;
}

export function formatMessage(text: string, onOpenPath?: (path: string) => void): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i > 0) elements.push(<br key={`br-${i}`} />);

    const bulletMatch = line.match(/^(\s*)[*-]\s+(.*)/);
    if (bulletMatch) {
      elements.push(
        <span key={`line-${i}`} className="fmt-bullet">
          <span className="fmt-bullet-dot" />
          {formatInline(bulletMatch[2], onOpenPath)}
        </span>
      );
      continue;
    }

    elements.push(<span key={`line-${i}`}>{formatInline(line, onOpenPath)}</span>);
  }

  return elements;
}

export function highlightText(text: string, query: string): React.ReactNode {
  if (!query || !text) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="search-highlight">{part}</mark>
      : part
  );
}

export function buildTodoPrompt(userPrompt: string, todos: TodoItem[]): string {
  if (todos.length === 0) return userPrompt;

  const todoLines = todos.map((t, i) =>
    `${i + 1}. [${t.done ? "x" : " "}] ${t.text}`
  ).join("\n");

  const pending = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done);

  return `## Active Todo List (${done.length}/${todos.length} complete)\n\n${todoLines}\n\n## Todo Mode Instructions\n\nYou are working in todo mode. Start your response by briefly acknowledging which todo item(s) you'll be working on from the list above (e.g., "Working on #3: fix the login bug").\n\nAs you work, use these markers at the END of your final message:\n\nTo mark items complete:\nDONE: <number>\n\nTo suggest new todos:\nADD_TODO: <description>\n\nExamples:\nDONE: 1\nDONE: 3\nADD_TODO: write unit tests for the new auth module\nADD_TODO: update README with setup instructions\n\nOnly mark items you actually completed. Only suggest todos that are concrete next steps.${pending.length === 0 ? "\n\nAll todos are complete! Focus on the user's prompt below." : ""}\n\n---\n\n${userPrompt}`;
}

export function parseTodoCompletions(output: CodexExecOutput, todos: TodoItem[]): string[] {
  const lastMessage = extractLastAgentMessage(output.parsedJson);
  if (!lastMessage) return [];

  const completedIds: string[] = [];
  const seen = new Set<string>();
  const matches = lastMessage.matchAll(/^\s*DONE:\s*(\d+)\s*[.)]?\s*$/gim);
  for (const m of matches) {
    const idx = Number.parseInt(m[1], 10) - 1;
    if (idx >= 0 && idx < todos.length && !todos[idx].done && !seen.has(todos[idx].id)) {
      completedIds.push(todos[idx].id);
      seen.add(todos[idx].id);
    }
  }
  return completedIds;
}

export interface ParsedTodoAddition {
  text: string;
  agentSlug?: string;
}

export function parseTodoAdditions(output: CodexExecOutput): ParsedTodoAddition[] {
  const lastMessage = extractLastAgentMessage(output.parsedJson);
  if (!lastMessage) return [];

  const newTodos: ParsedTodoAddition[] = [];
  const matches = lastMessage.matchAll(/^\s*ADD_TODO:\s*(.+)\s*$/gim);
  const agentTagRegex = /^\[agent:([a-z0-9-]+)\]\s*/i;
  for (const m of matches) {
    const text = m[1].trim();
    if (text) {
      const agentMatch = text.match(agentTagRegex);
      if (agentMatch) {
        newTodos.push({ text: text.replace(agentTagRegex, "").trim(), agentSlug: agentMatch[1].toLowerCase() });
      } else {
        newTodos.push({ text });
      }
    }
  }
  return newTodos;
}

export function getTodoAutoPlayDecision(
  todos: TodoItem[],
  requestedTodoId: string | null,
  todoProgressMade: boolean,
): { nextTodo: TodoItem | null; nextIndex: number | null; shouldPauseForLoop: boolean } {
  const remaining = todos.filter((t) => !t.done);
  if (remaining.length === 0) {
    return { nextTodo: null, nextIndex: null, shouldPauseForLoop: false };
  }

  const nextTodo = remaining[0];
  const nextIndex = todos.indexOf(nextTodo);
  const wouldRepeatSameTodo = requestedTodoId !== null && nextTodo.id === requestedTodoId;
  const shouldPauseForLoop = !todoProgressMade && wouldRepeatSameTodo;

  return { nextTodo, nextIndex, shouldPauseForLoop };
}
