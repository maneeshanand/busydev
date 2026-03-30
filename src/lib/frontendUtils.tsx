import React from "react";
import type { CodexExecOutput } from "../invoke";
import type { StreamRow, TodoItem } from "../types";
import { getAdapter } from "./adapters";
import type { AgentType } from "./adapters";
import { stripTodoMarkers } from "./adapters/shared";

// Re-export adapter types/helpers for consumers that previously imported from here
export { stripTodoMarkers, cleanCommand } from "./adapters/shared";
export type { ClassifiedRow } from "./adapters/types";

/**
 * Try all adapters to extract the last agent message (agent type unknown).
 */
function extractLastAgentMessage(parsedJson: unknown): string | null {
  for (const agent of ["codex", "claude", "gemini"] as AgentType[]) {
    const msg = getAdapter(agent).extractLastMessage(parsedJson);
    if (msg) return msg;
  }
  return null;
}

export function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return time;
  const date = d.toLocaleDateString([], { month: "short", day: "numeric" });
  return `${date}, ${time}`;
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

export function buildTodoWorkPrompt(itemNumber: number, itemText: string, notes?: string): string {
  const trimmedNotes = notes?.trim();
  let prompt = `Work on todo #${itemNumber}: ${itemText}`;
  if (trimmedNotes) {
    prompt += `\n\nContext: ${trimmedNotes}`;
  }
  prompt += `\n\nComplete this single item and mark it done with DONE: ${itemNumber}`;
  prompt += "\nIf you discover sub-tasks needed to complete this item, output ADD_TODO: lines to add them to the list.";
  return prompt;
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
