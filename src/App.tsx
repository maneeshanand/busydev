import { useEffect, useRef, useState, useCallback } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { openPath } from "@tauri-apps/plugin-opener";
import { load as loadStore } from "@tauri-apps/plugin-store";
import {
  CODEX_STREAM_EVENT,
  runCodexExec,
  stopCodexExec,
  writeToAgent,
  createWorktree,
  deleteWorktree,
  isGitRepo,
  updateTrayBadge,
  type CodexExecOutput,
  type CodexStreamEvent,
} from "./invoke";
import type { StreamRow, RunEntry, PersistedRun, InFlightRun, TodoItem, Project, Session } from "./types";
import { ProjectNavigator } from "./components/ProjectNavigator";
import { TodoPanel } from "./components/TodoPanel";
import { ResizeHandle } from "./components/ResizeHandle";
import { SettingsView, type SectionId } from "./components/SettingsView";
import { SETTINGS_VERSION, migrateStoredSettings, type StoredSettings } from "./lib/settings";
import { getSettings, saveSettings } from "./settingsInvoke";
// Terminal hidden — MAN-157
// import { TerminalPanel } from "./components/Terminal";
import { TabBar, type Tab } from "./components/TabBar";
import { useNotificationStore } from "./stores/notificationStore";
import { NotificationToasts } from "./components/NotificationToasts";

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 4V2m0 20v-2m8-8h2M2 12h2m12.95 4.95 1.41 1.41M3.64 3.64l1.41 1.41m11.9-1.41-1.41 1.41M5.05 16.95l-1.41 1.41M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M20 15.3A8.5 8.5 0 1 1 8.7 4a7 7 0 0 0 11.3 11.3Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}


function WrenchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M20.2 6.9a4.7 4.7 0 0 1-6.3 4.5L7 18.3a1.8 1.8 0 0 1-2.5 0l-.8-.8a1.8 1.8 0 0 1 0-2.5l6.9-6.9a4.7 4.7 0 0 1 4.5-6.3l-2.1 2.1a1.2 1.2 0 0 0 0 1.7l2.4 2.4a1.2 1.2 0 0 0 1.7 0l2.1-2.1Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="6.6" cy="16.4" r="0.9" fill="currentColor" />
    </svg>
  );
}


function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
    </svg>
  );
}

function RunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M8 18c2 0 3.5-1.2 4.2-3l.8-2.2 2.2 1.2c.4.2.9.3 1.3.3H21m-9-7.8a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Zm-1.5 2.1-1.8 2.1H5m7.5.6 2.3-2.3h2.7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChecklistIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M9 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"
        fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"
      />
      <path d="M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2Z"
        fill="none" stroke="currentColor" strokeWidth="1.7"
      />
      <path d="m9 14 2 2 4-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}





function summarizePrompt(prompt: string): string {
  const compact = prompt.trim().replace(/\s+/g, " ");
  if (!compact) return "complete the requested task";
  return compact.length > 90 ? `${compact.slice(0, 90)}...` : compact;
}

function extractLastAgentMessage(parsedJson: unknown): string | null {
  if (!Array.isArray(parsedJson)) return null;
  let lastMessage: string | null = null;

  for (const event of parsedJson) {
    if (!event || typeof event !== "object" || Array.isArray(event)) continue;
    const obj = event as Record<string, unknown>;

    // Codex: item.type === "agent_message"
    const item = obj.item;
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const eventItem = item as Record<string, unknown>;
      if (eventItem.type === "agent_message") {
        const text = typeof eventItem.text === "string" ? eventItem.text.trim() : "";
        if (text) lastMessage = text;
      }
    }

    // Claude: type === "assistant" with text content blocks
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

function stripTodoMarkers(text: string): string {
  return text.replace(/^DONE:\s*\d+\s*$/gm, "").replace(/^ADD_TODO:\s*.+\s*$/gm, "").trim();
}

function buildFinalSummary(run: RunEntry): string {
  if (run.stopped) {
    return "Stopped. What should I do instead?";
  }

  const lastAgentMessage = extractLastAgentMessage(run.output.parsedJson);
  if (lastAgentMessage) return stripTodoMarkers(lastAgentMessage);

  if ((run.output.exitCode ?? 1) === 0) {
    return `You asked me to ${summarizePrompt(run.prompt)}, and I finished it.`;
  }
  return `You asked me to ${summarizePrompt(run.prompt)}, but the run ended with exit code ${run.output.exitCode ?? "N/A"}.`;
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return time;
  const date = d.toLocaleDateString([], { month: "short", day: "numeric" });
  return `${date}, ${time}`;
}

function cleanCommand(raw: string): string {
  const m = raw.match(/^\/bin\/(?:ba|z)?sh\s+-\w*c\s+['"](.+)['"]$/s);
  if (m) return m[1];
  const m2 = raw.match(/^\/bin\/(?:ba|z)?sh\s+-\w*c\s+'(.+)'$/s);
  return m2 ? m2[1] : raw;
}

function shortenPath(path: string): string {
  const parts = path.split("/");
  return parts.length > 2 ? parts.slice(-2).join("/") : path;
}

type ClassifiedRow = Omit<StreamRow, "id">;

function classifyEvent(event: CodexStreamEvent): ClassifiedRow {
  // Handle non-stdout lifecycle events from the runner
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

  // Parse structured JSON events from stdout
  const value = event.parsedJson;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const type = typeof obj.type === "string" ? obj.type : "";

    // ── Claude Code events ──────────────────────────────────────
    // System events (hooks, init) — hide
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

    // Claude: permission request via --permission-prompt-tool stdio
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

    // Assistant messages — thinking, tool_use, text
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

    // Tool results — mark the corresponding tool_use as done
    if (type === "user") {
      const toolResult = obj.tool_use_result as Record<string, unknown> | undefined;
      if (toolResult) {
        // This is a tool result — we want to merge into the running command row
        // Return as a completed command so the listener merges it
        return { category: "command", text: "", command: "", status: "done" };
      }
      return { category: "status", text: "", hidden: true };
    }

    // Final result — show cost/duration
    if (type === "result") {
      const cost = typeof obj.total_cost_usd === "number" ? `$${obj.total_cost_usd.toFixed(4)}` : "";
      const turns = typeof obj.num_turns === "number" ? `${obj.num_turns} turns` : "";
      const parts = [turns, cost].filter(Boolean).join(" · ");
      return { category: "status", text: parts || "Done" };
    }

    // ── Codex events ────────────────────────────────────────────
    const item = obj.item && typeof obj.item === "object" && !Array.isArray(obj.item)
      ? (obj.item as Record<string, unknown>)
      : null;

    // Hide plumbing events
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

  // Fallback for unstructured stdout lines
  if (event.line && event.line.trim().length > 0) {
    const trimmed = event.line.trim();
    const text = trimmed.length > 220 ? `${trimmed.slice(0, 220)}...` : trimmed;
    return { category: "message", text };
  }

  return { category: "status", text: "", hidden: true };
}

function formatMessage(text: string): React.ReactNode {
  // Split into lines for block-level formatting
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i > 0) elements.push(<br key={`br-${i}`} />);

    // Bullet points
    const bulletMatch = line.match(/^(\s*)[*-]\s+(.*)/);
    if (bulletMatch) {
      elements.push(
        <span key={`line-${i}`} className="fmt-bullet">
          <span className="fmt-bullet-dot" />
          {formatInline(bulletMatch[2])}
        </span>
      );
      continue;
    }

    elements.push(<span key={`line-${i}`}>{formatInline(line)}</span>);
  }

  return elements;
}

function handleOpenPath(path: string) {
  void openPath(path);
}

function formatInline(text: string): React.ReactNode {
  // Process inline: **bold**, `code`, *italic*, /absolute/file/paths
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|`([^`]+)`|\*(.+?)\*|(\/[\w./-]+\.\w+))/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(<strong key={key++}>{match[2]}</strong>);
    } else if (match[3]) {
      // Code blocks — also check if content is a file path
      const code = match[3];
      if (/^\/[\w./-]+\.\w+$/.test(code)) {
        parts.push(
          <code key={key++} className="fmt-code fmt-path" onClick={() => handleOpenPath(code)} title="Open file">
            {code}
          </code>
        );
      } else {
        parts.push(<code key={key++} className="fmt-code">{code}</code>);
      }
    } else if (match[4]) {
      parts.push(<em key={key++}>{match[4]}</em>);
    } else if (match[5]) {
      // Bare file path
      parts.push(
        <span key={key++} className="fmt-path" onClick={() => handleOpenPath(match![5])} title="Open file">
          {match[5]}
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

function highlightText(text: string, query: string): React.ReactNode {
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

function renderStreamRow(
  row: StreamRow,
  searchQuery = "",
  onApproval?: (requestId: string, decision: "allow" | "deny") => void,
) {
  if (row.hidden) return null;

  const hl = (text: string) => highlightText(text, searchQuery);

  switch (row.category) {
    case "message":
      return (
        <div key={row.id} className="chat-row chat-row-agent">
          <div className={`ev-message ${row.isTodoSummary ? "ev-message-todo" : ""}`}>{searchQuery ? hl(row.text) : formatMessage(row.text)}</div>
        </div>
      );
    case "command":
      return (
        <div key={row.id} className="ev-command">
          <span className="ev-command-prefix">$</span>
          <span className="ev-command-text">{hl(row.command ?? row.text)}</span>
          <span className={`ev-command-status is-${row.status}`}>
            {row.status === "running" && <span className="ev-spinner" />}
            {row.status === "done" && "done"}
            {row.status === "failed" && `exit ${row.exitCode}`}
          </span>
        </div>
      );
    case "file_change":
      return (
        <div key={row.id} className="ev-file-change">
          <span className="ev-file-label">edited</span>
          <span className="ev-file-paths">{hl(row.text)}</span>
        </div>
      );
    case "status":
      return (
        <div key={row.id} className="ev-status">{hl(row.text)}</div>
      );
    case "error":
      return (
        <div key={row.id} className="ev-error">{hl(row.text)}</div>
      );
    case "approval":
      return (
        <div key={row.id} className="ev-approval">
          <div className="ev-approval-header">
            <span className="ev-approval-icon">?</span>
            <span className="ev-approval-text">{row.text}</span>
          </div>
          {row.approvalState === "pending" && onApproval && row.requestId && (
            <div className="ev-approval-actions">
              <button
                type="button"
                className="ev-approval-allow"
                onClick={() => onApproval(row.requestId!, "allow")}
              >
                Allow
              </button>
              <button
                type="button"
                className="ev-approval-deny"
                onClick={() => onApproval(row.requestId!, "deny")}
              >
                Deny
              </button>
            </div>
          )}
          {row.approvalState === "approved" && (
            <span className="ev-approval-badge ev-approval-approved">Allowed</span>
          )}
          {row.approvalState === "denied" && (
            <span className="ev-approval-badge ev-approval-denied">Denied</span>
          )}
        </div>
      );
    default:
      return null;
  }
}

function renderPersistedRun(run: PersistedRun, debugMode: boolean, searchQuery = "") {
  const hl = (text: string) => highlightText(text, searchQuery);
  return (
    <div key={`persisted-${run.id}`} className="output-section">
      <div className="chat-thread">
        <div className="chat-row chat-row-user">
          <div className="chat-bubble chat-bubble-user">{hl(run.prompt)}</div>
        </div>

        {run.streamRows.length > 0 && (
          <div className="stream-events">
            {run.streamRows.filter((r) => !r.hidden).map((r) => renderStreamRow(r, searchQuery))}
          </div>
        )}

        <div className="chat-row chat-row-agent chat-row-final">
          <div className="ev-message ev-message-final">{searchQuery ? hl(run.finalSummary) : formatMessage(run.finalSummary)}</div>
        </div>
      </div>

      <div className="run-footer">
        {debugMode && <div>Run #{run.id}</div>}
        <div>{run.stopped ? `Stopped after ${(run.durationMs / 1000).toFixed(1)}s` : `Finished in ${(run.durationMs / 1000).toFixed(1)}s`}</div>
        {debugMode && <div>Exit code: {run.exitCode ?? "N/A"}</div>}
        {run.completedAt && <div className="run-timestamp">{formatTimestamp(run.completedAt)}</div>}
      </div>
    </div>
  );
}

function buildTodoPrompt(userPrompt: string, todos: TodoItem[]): string {
  if (todos.length === 0) return userPrompt;

  const todoLines = todos.map((t, i) =>
    `${i + 1}. [${t.done ? "x" : " "}] ${t.text}`
  ).join("\n");

  const pending = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done);

  return `## Active Todo List (${done.length}/${todos.length} complete)

${todoLines}

## Todo Mode Instructions

You are working in todo mode. Start your response by briefly acknowledging which todo item(s) you'll be working on from the list above (e.g., "Working on #3: fix the login bug").

As you work, use these markers at the END of your final message:

To mark items complete:
DONE: <number>

To suggest new todos:
ADD_TODO: <description>

Examples:
DONE: 1
DONE: 3
ADD_TODO: write unit tests for the new auth module
ADD_TODO: update README with setup instructions

Only mark items you actually completed. Only suggest todos that are concrete next steps.${pending.length === 0 ? "\n\nAll todos are complete! Focus on the user's prompt below." : ""}

---

${userPrompt}`;
}

function parseTodoCompletions(output: CodexExecOutput, todos: TodoItem[]): string[] {
  const lastMessage = extractLastAgentMessage(output.parsedJson);
  if (!lastMessage) return [];

  const completedIds: string[] = [];
  const matches = lastMessage.matchAll(/^DONE:\s*(\d+)\s*$/gm);
  for (const m of matches) {
    const idx = parseInt(m[1], 10) - 1;
    if (idx >= 0 && idx < todos.length && !todos[idx].done) {
      completedIds.push(todos[idx].id);
    }
  }
  return completedIds;
}

function parseTodoAdditions(output: CodexExecOutput): string[] {
  const lastMessage = extractLastAgentMessage(output.parsedJson);
  if (!lastMessage) return [];

  const newTodos: string[] = [];
  const matches = lastMessage.matchAll(/^ADD_TODO:\s*(.+)\s*$/gm);
  for (const m of matches) {
    const text = m[1].trim();
    if (text) newTodos.push(text);
  }
  return newTodos;
}

function NotificationPanel({ onClose, onNavigate }: { onClose: () => void; onNavigate?: (projectId: string, sessionId: string) => void }) {
  const notifications = useNotificationStore((s) => s.notifications);
  const clearAll = useNotificationStore((s) => s.clearNotifications);
  const dismiss = useNotificationStore((s) => s.dismissNotification);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".bell-wrapper")) onClose();
    };
    // Use setTimeout to avoid closing on the same click that opened the panel
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);
    return () => { clearTimeout(timer); document.removeEventListener("mousedown", handleClickOutside); };
  }, [onClose]);

  return (
    <div className="notif-panel">
      <div className="notif-panel-header">
        <span>Notifications</span>
        {notifications.length > 0 && (
          <button type="button" className="notif-panel-clear" onClick={clearAll}>Clear all</button>
        )}
      </div>
      {notifications.length === 0 ? (
        <div className="notif-panel-empty">No notifications</div>
      ) : (
        <div className="notif-panel-list">
          {[...notifications].reverse().map((n) => {
            const canNav = !!(n.projectId && n.sessionId && onNavigate);
            return (
              <div
                key={n.id}
                className={`notif-panel-item notif-panel-item--${n.level} ${canNav ? "notif-panel-item--clickable" : ""}`}
                onClick={() => {
                  if (canNav) {
                    onNavigate(n.projectId!, n.sessionId!);
                    dismiss(n.id);
                    onClose();
                  }
                }}
              >
                <div className="notif-panel-item-content">
                  <strong>{n.title}</strong>
                  <span>{n.message}</span>
                </div>
                <button type="button" className="notif-panel-item-dismiss" onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}>×</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SessionTabs({ sessions, activeSessionId, sessionRunCounts, sessionAlerts, projectId, onSelect, onNew, onRename, onDelete }: {
  sessions: Session[];
  activeSessionId: string | null;
  sessionRunCounts: Record<string, number>;
  sessionAlerts: Record<string, "done" | "approval">;
  projectId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const sessionToDelete = confirmDeleteId ? sessions.find((s) => s.id === confirmDeleteId) : null;

  return (
    <>
      <div className="session-bar">
        {sessions.map((s) => (
          editingId === s.id ? (
            <input
              key={s.id}
              className="session-tab-edit"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={() => { onRename(s.id, editName); setEditingId(null); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") { onRename(s.id, editName); setEditingId(null); }
                if (e.key === "Escape") setEditingId(null);
              }}
              autoFocus
            />
          ) : (
            <div key={s.id} className={`session-tab ${s.id === activeSessionId ? "session-tab-active" : ""}`}>
              <span
                className="session-tab-label"
                onClick={() => onSelect(s.id)}
                onDoubleClick={() => { setEditingId(s.id); setEditName(s.name); }}
              >
                {s.name}
              </span>
              {s.worktreeBranch && (
                <span className="session-tab-branch" title={s.worktreeBranch}>⑂</span>
              )}
              {(sessionRunCounts[`${projectId}:${s.id}`] ?? 0) > 0 && (
                <span className="session-tab-spinner" />
              )}
              {sessionAlerts[s.id] === "done" && (
                <span className="session-tab-done" title="Agent finished">✓</span>
              )}
              {sessionAlerts[s.id] === "approval" && (
                <span className="session-tab-approval" title="Needs approval">!</span>
              )}
              {sessions.length > 1 && (
                <button
                  type="button"
                  className="session-tab-close"
                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(s.id); }}
                  title="Close session"
                >
                  ×
                </button>
              )}
            </div>
          )
        ))}
        <button type="button" className="session-tab-add" onClick={onNew}>+</button>
      </div>

      {confirmDeleteId && sessionToDelete && (
        <div className="confirm-overlay" onClick={() => setConfirmDeleteId(null)}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-title">Delete "{sessionToDelete.name}"?</div>
            <div className="confirm-body">
              All session history and data will be permanently deleted. This cannot be undone.
            </div>
            <div className="confirm-actions">
              <button type="button" className="confirm-cancel" onClick={() => setConfirmDeleteId(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="confirm-delete"
                onClick={() => { onDelete(confirmDeleteId); setConfirmDeleteId(null); }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function App() {
  const [loading, setLoading] = useState(true);
  const [splashFading, setSplashFading] = useState(false);
  const [colorMode, setColorMode] = useState<"light" | "dark">("light");
  const [uiDensity, setUiDensity] = useState<"comfortable" | "compact">("comfortable");
  const [splashEnabled, setSplashEnabled] = useState(true);
  const [splashDurationMs, setSplashDurationMs] = useState(3000);
  const [debugMode, setDebugMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SectionId>("general");
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [skipGitRepoCheck, setSkipGitRepoCheck] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [promptHistory, setPromptHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  // Transition state for smooth session/project switching
  const [transitioning, setTransitioning] = useState(false);

  // In-flight runs (global, keyed by runId — survive session/project switches)
  const [inFlightRuns, setInFlightRuns] = useState<Record<string, InFlightRun>>({});
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoPlayTodos, setAutoPlayTodos] = useState(false);
  const [todoAutoPlayDefault, setTodoAutoPlayDefault] = useState(false);
  const [includeSessionHistoryInPrompt, setIncludeSessionHistoryInPrompt] = useState(true);
  const [claudeAutoContinue, setClaudeAutoContinue] = useState(true);
  const [terminalFontSize, setTerminalFontSize] = useState(13);
  const [terminalLineHeight, setTerminalLineHeight] = useState(1.3);

  // Global state
  const [todoMode, setTodoMode] = useState(false);
  const [rightPanelWidth, setRightPanelWidth] = useState(280);
  const [rightCollapsed, setRightCollapsed] = useState(true);

  // Track which session owns which runId (for background run completion)
  const runSessionMapRef = useRef<Record<string, { projectId: string; sessionId: string }>>({});

  const [showScrollDown, setShowScrollDown] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const streamPanelRef = useRef<HTMLDivElement | null>(null);
  const streamBottomRef = useRef<HTMLDivElement | null>(null);
  const streamRowsMapRef = useRef<Record<string, StreamRow[]>>({});
  const nextRowIdRef = useRef<Record<string, number>>({});
  const stoppedMapRef = useRef<Record<string, boolean>>({});
  const startTimeMapRef = useRef<Record<string, number>>({});
  const badgeCountRef = useRef(0);
  const [missedAlerts, setMissedAlerts] = useState(0);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const storeReadyRef = useRef(false);
  const [windowSize, setWindowSize] = useState<{ windowWidth?: number; windowHeight?: number }>({});

  const anyRunning = Object.keys(inFlightRuns).length > 0;
  const activeInFlightRun = activeTabId ? inFlightRuns[activeTabId] ?? null : null;
  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;
  const activeSession = activeProject?.sessions.find((s) => s.id === activeProject.activeSessionId) ?? null;
  const sessionRuns = activeSession?.runs ?? [];
  const todos = activeSession?.todos ?? [];
  const agent = activeSession?.agent ?? "codex";
  const model = activeSession?.model ?? "";
  const approvalPolicy = activeSession?.approvalPolicy ?? "full-auto";
  const sandboxMode = activeSession?.sandboxMode ?? "read-only";
  const workingDirectory = activeSession?.worktreePath ?? activeProject?.path ?? "";
  const canRun = workingDirectory.length > 0 && prompt.length > 0;
  const modelLabel = model || (agent === "claude" ? "claude-sonnet-4-6" : "codex-mini");
  const approvalLabel = approvalPolicy === "unless-allow-listed"
    ? "allow-listed"
    : approvalPolicy === "never"
      ? "manual"
      : "full-auto";

  function openSettings(section: SectionId) {
    setSettingsSection(section);
    setSettingsOpen(true);
  }

  const buildSettingsSnapshot = useCallback((): StoredSettings => ({
    settingsVersion: SETTINGS_VERSION,
    colorMode,
    uiDensity,
    splashEnabled,
    splashDurationMs,
    debugMode,
    projects,
    activeProjectId,
    skipGitRepoCheck,
    todoMode,
    todoAutoPlayDefault,
    rightPanelWidth,
    includeSessionHistoryInPrompt,
    claudeAutoContinue,
    terminalFontSize,
    terminalLineHeight,
    windowWidth: windowSize.windowWidth,
    windowHeight: windowSize.windowHeight,
  }), [
    colorMode,
    uiDensity,
    splashEnabled,
    splashDurationMs,
    debugMode,
    projects,
    activeProjectId,
    skipGitRepoCheck,
    todoMode,
    todoAutoPlayDefault,
    rightPanelWidth,
    includeSessionHistoryInPrompt,
    claudeAutoContinue,
    terminalFontSize,
    terminalLineHeight,
    windowSize.windowWidth,
    windowSize.windowHeight,
  ]);

  // Count in-flight runs per session for spinner indicators
  const sessionRunCounts: Record<string, number> = {};
  const runningProjectIds = new Set<string>();
  for (const [rid] of Object.entries(inFlightRuns)) {
    const owner = runSessionMapRef.current[rid];
    if (owner) {
      const key = `${owner.projectId}:${owner.sessionId}`;
      sessionRunCounts[key] = (sessionRunCounts[key] || 0) + 1;
      runningProjectIds.add(owner.projectId);
    }
  }

  // Compute per-session alert indicators from notification store
  const storeNotifications = useNotificationStore((s) => s.notifications);
  const sessionAlerts: Record<string, "done" | "approval"> = {};
  for (const n of storeNotifications) {
    if (!n.sessionId) continue;
    if (n.level === "warning") {
      sessionAlerts[n.sessionId] = "approval"; // approval takes priority
    } else if (!sessionAlerts[n.sessionId]) {
      sessionAlerts[n.sessionId] = "done";
    }
  }

  // Load persisted state on mount
  // Request notification permission on mount
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, []);

  // Reset tray badge when window gains focus
  useEffect(() => {
    const handleFocus = () => {
      badgeCountRef.current = 0;
      void updateTrayBadge(0);
      // Bell icon persists until user clicks it — don't reset missedAlerts here
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        // Primary source: backend SQLite settings.
        const backendSettings = await getSettings();
        let migrated = migrateStoredSettings(backendSettings);

        // Fallback path: one-time migration from legacy session.json.
        if (!migrated) {
          const store = await loadStore("session.json");
          const saved = await store.get<unknown>("session");
          migrated = migrateStoredSettings(saved);
          if (migrated) {
            await saveSettings(migrated);
          }
        }

        if (migrated) {
          // Restore window size
          if (migrated.windowWidth && migrated.windowHeight) {
            void getCurrentWindow().setSize(new LogicalSize(migrated.windowWidth, migrated.windowHeight));
          }
          setColorMode(migrated.colorMode);
          setUiDensity(migrated.uiDensity);
          setSplashEnabled(migrated.splashEnabled);
          setSplashDurationMs(migrated.splashDurationMs);
          setDebugMode(migrated.debugMode);
          setProjects(migrated.projects);
          setActiveProjectId(migrated.activeProjectId);
          setSkipGitRepoCheck(migrated.skipGitRepoCheck);
          setTodoMode(migrated.todoMode);
          setTodoAutoPlayDefault(migrated.todoAutoPlayDefault);
          setAutoPlayTodos(migrated.todoAutoPlayDefault);
          setRightCollapsed(!migrated.todoMode);
          setRightPanelWidth(migrated.rightPanelWidth);
          setIncludeSessionHistoryInPrompt(migrated.includeSessionHistoryInPrompt);
          setClaudeAutoContinue(migrated.claudeAutoContinue);
          setTerminalFontSize(migrated.terminalFontSize);
          setTerminalLineHeight(migrated.terminalLineHeight);
          setWindowSize({
            windowWidth: migrated.windowWidth,
            windowHeight: migrated.windowHeight,
          });
        }
      } catch {
        // First launch or corrupted store — start fresh
      }
      storeReadyRef.current = true;
    })();
  }, []);

  // Save state whenever persisted values change
  const saveSession = useCallback(async () => {
    if (!storeReadyRef.current) return;
    try {
      await saveSettings(buildSettingsSnapshot());
    } catch {
      // Silently ignore save errors
    }
  }, [buildSettingsSnapshot]);

  useEffect(() => {
    void saveSession();
  }, [saveSession]);

  // Save window size on resize (debounced)
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(timeout);
      timeout = setTimeout(async () => {
        try {
          const size = await getCurrentWindow().innerSize();
          setWindowSize({ windowWidth: size.width, windowHeight: size.height });
        } catch { /* ignore */ }
      }, 500);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    let cancelled = false;

    void listen<CodexStreamEvent>(CODEX_STREAM_EVENT, (event) => {
      const payload = event.payload;
      if (!payload) return;
      const rid = payload.runId;

      // Only process events for runs we're tracking
      if (!streamRowsMapRef.current[rid]) return;

      const classified = classifyEvent(payload);
      if (classified.hidden) return;

      const isCommandDone = classified.category === "command" &&
        (classified.status === "done" || classified.status === "failed");

      if (isCommandDone) {
        const markDone = (rows: StreamRow[]): StreamRow[] => {
          if (classified.command) {
            return rows.map((r) =>
              r.category === "command" && r.command === classified.command && r.status === "running"
                ? { ...r, status: classified.status, exitCode: classified.exitCode }
                : r
            );
          }
          let idx = -1;
          for (let i = rows.length - 1; i >= 0; i--) {
            if (rows[i].category === "command" && rows[i].status === "running") { idx = i; break; }
          }
          if (idx === -1) return rows;
          return rows.map((r, i) =>
            i === idx ? { ...r, status: classified.status ?? "done", exitCode: classified.exitCode } : r
          );
        };

        streamRowsMapRef.current[rid] = markDone(streamRowsMapRef.current[rid]);
        setInFlightRuns((prev) => {
          const run = prev[rid];
          if (!run) return prev;
          return { ...prev, [rid]: { ...run, streamRows: markDone(run.streamRows) } };
        });
      } else {
        if (!nextRowIdRef.current[rid]) nextRowIdRef.current[rid] = 1;
        const row: StreamRow = { ...classified, id: nextRowIdRef.current[rid]++ };
        if (classified.category === "approval") {
          const approvalOwner = runSessionMapRef.current[rid];
          fireNotification("Approval needed", classified.text, "warning", approvalOwner?.projectId, approvalOwner?.sessionId);
        }
        streamRowsMapRef.current[rid] = [...(streamRowsMapRef.current[rid] || []), row];
        setInFlightRuns((prev) => {
          const run = prev[rid];
          if (!run) return prev;
          return { ...prev, [rid]: { ...run, streamRows: [...run.streamRows, row] } };
        });
      }
    }).then((fn) => {
      if (cancelled) {
        void fn();
        return;
      }
      unlisten = fn;
    });

    return () => {
      cancelled = true;
      if (unlisten) void unlisten();
    };
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => {
      streamBottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }, [loading, sessionRuns, activeInFlightRun, anyRunning, error]);

  useEffect(() => {
    const panel = streamPanelRef.current;
    if (!panel) return;
    function handleScroll() {
      if (!panel) return;
      const distFromBottom = panel.scrollHeight - panel.scrollTop - panel.clientHeight;
      setShowScrollDown(distFromBottom > 100);
    }
    panel.addEventListener("scroll", handleScroll);
    return () => panel.removeEventListener("scroll", handleScroll);
  }, [loading]);

  useEffect(() => {
    if (!splashEnabled) {
      setSplashFading(true);
      setLoading(false);
      return;
    }
    const duration = Math.max(0, splashDurationMs);
    const fadeTimer = setTimeout(() => setSplashFading(true), duration);
    const removeTimer = setTimeout(() => setLoading(false), duration + 600);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [splashEnabled, splashDurationMs]);

  useEffect(() => {
    if (!anyRunning || !activeTabId) return;
    const startTime = startTimeMapRef.current[activeTabId];
    if (!startTime) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 10) / 100);
    }, 10);
    return () => clearInterval(interval);
  }, [anyRunning, activeTabId]);

  useEffect(() => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setColorMode(prefersDark ? "dark" : "light");
  }, []);

  useEffect(() => {
    document.body.classList.toggle("body-dark", colorMode === "dark");
    return () => document.body.classList.remove("body-dark");
  }, [colorMode]);

  // Terminal hidden for now — MAN-157

  // Todo handlers
  function handleAddTodo(text: string) {
    setTodos((prev) => [...prev, {
      id: crypto.randomUUID(), text, done: false, source: "user", createdAt: Date.now(),
    }]);
  }
  function handleToggleTodo(id: string) {
    setTodos((prev) => prev.map((t) =>
      t.id === id ? { ...t, done: !t.done, completedAt: !t.done ? Date.now() : undefined } : t
    ));
  }
  function handleDeleteTodo(id: string) {
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }
  function handleEditTodo(id: string, text: string) {
    setTodos((prev) => prev.map((t) => t.id === id ? { ...t, text } : t));
  }
  function handleClearTodos() {
    setTodos([]);
    setAutoPlayTodos(false);
  }
  async function handleSaveTodos() {
    const filePath = await save({
      defaultPath: "todos.json",
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!filePath) return;
    const data = JSON.stringify(todos, null, 2);
    await writeTextFile(filePath, data);
  }

  // Resize handler
  function handleRightResize(delta: number) {
    setRightPanelWidth((prev) => Math.max(220, Math.min(500, prev - delta)));
  }
  function handleResizeEnd() {
    // Save triggers via the effect dependency on rightPanelWidth
  }

  async function handleApproval(runId: string, requestId: string, decision: "allow" | "deny") {
    const response = JSON.stringify({
      type: "control_response",
      request_id: requestId,
      permission_decision: decision === "allow"
        ? { type: "allow", tool_name: "", updated_input: null }
        : { type: "deny", message: "User denied permission" },
    });
    try {
      await writeToAgent(runId, response);
    } catch {
      // Process may have exited
    }
    // Update the approval row state
    setInFlightRuns((prev) => {
      const run = prev[runId];
      if (!run) return prev;
      return {
        ...prev,
        [runId]: {
          ...run,
          streamRows: run.streamRows.map((r) =>
            r.requestId === requestId
              ? { ...r, approvalState: decision === "allow" ? "approved" as const : "denied" as const }
              : r
          ),
        },
      };
    });
    // Also update the ref
    if (streamRowsMapRef.current[runId]) {
      streamRowsMapRef.current[runId] = streamRowsMapRef.current[runId].map((r) =>
        r.requestId === requestId
          ? { ...r, approvalState: decision === "allow" ? "approved" as const : "denied" as const }
          : r
      );
    }
  }

  // Update the active session's data directly in projects state
  function updateActiveSession(updater: (session: Session) => Session) {
    setProjects((prev) => prev.map((p) => {
      if (p.id !== activeProjectId || !p.activeSessionId) return p;
      return {
        ...p,
        sessions: p.sessions.map((s) =>
          s.id === p.activeSessionId ? updater(s) : s
        ),
      };
    }));
  }

  // Update a specific session (for background run completion)
  function updateSession(projectId: string, sessionId: string, updater: (session: Session) => Session) {
    setProjects((prev) => prev.map((p) => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        sessions: p.sessions.map((s) =>
          s.id === sessionId ? updater(s) : s
        ),
      };
    }));
  }

  function setTodos(newTodos: TodoItem[] | ((prev: TodoItem[]) => TodoItem[])) {
    updateActiveSession((s) => ({
      ...s,
      todos: typeof newTodos === "function" ? newTodos(s.todos) : newTodos,
    }));
  }

  function setAgent(v: string) { updateActiveSession((s) => ({ ...s, agent: v })); }
  function setModel(v: string) { updateActiveSession((s) => ({ ...s, model: v })); }
  function setApprovalPolicy(v: string) { updateActiveSession((s) => ({ ...s, approvalPolicy: v })); }
  function setSandboxMode(v: string) { updateActiveSession((s) => ({ ...s, sandboxMode: v })); }

  function makeSession(projectId: string, index: number): Session {
    return {
      id: crypto.randomUUID(),
      projectId,
      name: `Session ${index + 1}`,
      createdAt: Date.now(),
      runs: [],
      todos: [],
    };
  }

  // No flush needed — completed runs write directly to sessions via updateSession.
  // Switching just resets ephemeral UI state; derived values auto-update from projects.

  function resetEphemeralState() {
    setTransitioning(true);
    setTimeout(() => {
      setActiveTabId(null);
      setError(null);
      setPrompt("");
      setPromptHistory([]);
      setHistoryIndex(-1);
      setAutoPlayTodos(todoAutoPlayDefault);
      setSearchQuery("");
      setSearchOpen(false);
      requestAnimationFrame(() => setTransitioning(false));
    }, 120);
  }

  function switchSession(projectId: string, sessionId: string) {
    setProjects((prev) => prev.map((p) =>
      p.id === projectId ? { ...p, activeSessionId: sessionId } : p
    ));
    resetEphemeralState();
  }

  async function handleNewSession() {
    if (!activeProjectId || !activeProject) return;
    const session = makeSession(activeProjectId, activeProject.sessions.length);

    // Create a git worktree for non-first sessions
    if (activeProject.sessions.length > 0) {
      try {
        const isGit = await isGitRepo(activeProject.path);
        if (isGit) {
          const slug = session.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
          const branch = `busydev/${slug}`;
          const projectSlug = activeProject.path.replace(/\//g, "-").replace(/^-/, "");
          const wtPath = `/tmp/busydev-worktrees/${projectSlug}/${session.id}`;
          await createWorktree(activeProject.path, wtPath, branch);
          session.worktreePath = wtPath;
          session.worktreeBranch = branch;
        }
      } catch (err) {
        console.warn("Worktree creation failed:", err);
      }
    }

    setProjects((prev) => prev.map((p) =>
      p.id === activeProjectId
        ? { ...p, sessions: [...p.sessions, session], activeSessionId: session.id }
        : p
    ));
    resetEphemeralState();
  }

  async function handleDeleteSession(sessionId: string) {
    if (!activeProjectId || !activeProject) return;
    // Clean up worktree if it exists
    const session = activeProject.sessions.find((s) => s.id === sessionId);
    if (session?.worktreePath) {
      try {
        await deleteWorktree(activeProject.path, session.worktreePath);
      } catch {
        // Worktree may already be gone
      }
    }
    setProjects((prev) => prev.map((p) => {
      if (p.id !== activeProjectId) return p;
      const remaining = p.sessions.filter((s) => s.id !== sessionId);
      if (remaining.length === 0) return p;
      const newActiveId = p.activeSessionId === sessionId ? remaining[0].id : p.activeSessionId;
      return { ...p, sessions: remaining, activeSessionId: newActiveId };
    }));
    if (activeProject?.activeSessionId === sessionId) resetEphemeralState();
  }

  function handleRenameSession(sessionId: string, name: string) {
    if (!activeProjectId || !name.trim()) return;
    setProjects((prev) => prev.map((p) => {
      if (p.id !== activeProjectId) return p;
      return { ...p, sessions: p.sessions.map((s) => s.id === sessionId ? { ...s, name: name.trim() } : s) };
    }));
  }

  async function handleAddProject() {
    const dir = await open({ directory: true, multiple: false });
    if (!dir) return;
    const path = dir as string;
    const existing = projects.find((p) => p.path === path);
    if (existing) { switchToProject(existing.id); return; }
    const name = path.split("/").pop() || "project";
    const projId = crypto.randomUUID();
    const firstSession = makeSession(projId, 0);
    const project: Project = {
      id: projId, name, path, createdAt: Date.now(),
      sessions: [firstSession], activeSessionId: firstSession.id,
    };
    setProjects((prev) => [...prev, project]);
    setActiveProjectId(projId);
    resetEphemeralState();
  }

  function switchToProject(projectId: string) {
    if (projectId === activeProjectId) return;
    setActiveProjectId(projectId);
    resetEphemeralState();
  }

  function navigateToSession(projectId: string, sessionId: string) {
    if (projectId !== activeProjectId) setActiveProjectId(projectId);
    switchSession(projectId, sessionId);
  }

  function handleRemoveProject(id: string) {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (activeProjectId === id) {
      const remaining = projects.filter((p) => p.id !== id);
      if (remaining.length > 0) {
        setActiveProjectId(remaining[0].id);
      } else {
        setActiveProjectId(null);
      }
      resetEphemeralState();
    }
  }

  function fireNotification(title: string, message: string, level: "success" | "error" | "warning", projectId?: string, sessionId?: string) {
    const { addNotification } = useNotificationStore.getState();
    addNotification({ title, message, level, projectId, sessionId });
    if (!document.hasFocus()) {
      badgeCountRef.current += 1;
      setMissedAlerts(badgeCountRef.current);
      void updateTrayBadge(badgeCountRef.current);
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("busydev", { body: `${title}: ${message}` });
      }
    }
  }

  async function handleRun(overridePrompt?: string) {
    const submittedPrompt = overridePrompt ?? prompt;
    if (submittedPrompt.trim()) {
      setPromptHistory((prev) => [...prev, submittedPrompt]);
      setHistoryIndex(-1);
    }
    const runNumber = sessionRuns.length + Object.keys(inFlightRuns).length + 1;
    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    setPrompt("");
    setError(null);

    // Initialize per-run tracking
    streamRowsMapRef.current[runId] = [];
    nextRowIdRef.current[runId] = 1;

    // Track which session owns this run
    if (activeProjectId && activeProject?.activeSessionId) {
      runSessionMapRef.current[runId] = {
        projectId: activeProjectId,
        sessionId: activeProject.activeSessionId,
      };
    }
    stoppedMapRef.current[runId] = false;
    startTimeMapRef.current[runId] = Date.now();
    setElapsed(0);

    // Add to in-flight runs and switch to this tab
    setInFlightRuns((prev) => ({
      ...prev,
      [runId]: { id: runNumber, runId, prompt: submittedPrompt, streamRows: [] },
    }));
    setActiveTabId(runId);

    // Build session context from recent runs (toggleable in settings)
    const recentRuns = sessionRuns.slice(-5);
    let sessionContext = "";
    if (includeSessionHistoryInPrompt && recentRuns.length > 0) {
      const history = recentRuns.map((r, i) => {
        const summary = r.finalSummary?.slice(0, 150) || "(no summary)";
        return `${i + 1}. Prompt: "${r.prompt.slice(0, 100)}"\n   Result: ${summary}`;
      }).join("\n");
      sessionContext = `## Session History (last ${recentRuns.length} runs)\n\n${history}\n\n---\n\n`;
    }

    const basePrompt = todoMode && todos.length > 0
      ? buildTodoPrompt(submittedPrompt, todos)
      : submittedPrompt;

    const effectivePrompt = sessionContext + basePrompt;

    try {
      const out = await runCodexExec({
        runId,
        agent,
        prompt: effectivePrompt,
        approvalPolicy,
        sandboxMode,
        workingDirectory,
        model: model || undefined,
        skipGitRepoCheck,
        previousPrompts: agent === "claude" && claudeAutoContinue
          ? sessionRuns.map((r) => r.prompt).slice(-10)
          : undefined,
      });

      // Mark any remaining "running" commands as "done" — the agent exited without explicit completion events
      const finalStreamRows = (streamRowsMapRef.current[runId] || []).map((r) =>
        r.category === "command" && r.status === "running" ? { ...r, status: "done" as const } : r
      );
      const wasStopped = stoppedMapRef.current[runId] || false;
      const persistedRun: PersistedRun = {
        id: runNumber,
        prompt: submittedPrompt,
        streamRows: finalStreamRows,
        exitCode: out.exitCode,
        durationMs: out.durationMs,
        finalSummary: buildFinalSummary({ id: runNumber, prompt: submittedPrompt, output: out, streamRows: finalStreamRows, stopped: wasStopped }),
        stopped: wasStopped,
        completedAt: Date.now(),
      };

      // Write completed run to the owning session (may be different from active if user switched)
      const owner = runSessionMapRef.current[runId];

      // Fire notification for completed run
      if (!wasStopped) {
        if (out.exitCode === 0) {
          fireNotification("Agent completed", submittedPrompt.slice(0, 60), "success", owner?.projectId, owner?.sessionId);
        } else {
          fireNotification("Agent failed", `Exit code ${out.exitCode}`, "error", owner?.projectId, owner?.sessionId);
        }
      }

      if (owner) {
        updateSession(owner.projectId, owner.sessionId, (s) => ({
          ...s,
          runs: [...s.runs, persistedRun],
        }));
      }

      // Auto-update todos in the owning session
      if (todoMode && !wasStopped && owner) {
        const ownerSession = projects.find((p) => p.id === owner.projectId)
          ?.sessions.find((s) => s.id === owner.sessionId);
        const ownerTodos = ownerSession?.todos ?? [];
        const completedIds = parseTodoCompletions(out, ownerTodos);
        const newTodoTexts = parseTodoAdditions(out);

        if (completedIds.length > 0 || newTodoTexts.length > 0) {
          updateSession(owner.projectId, owner.sessionId, (s) => ({
            ...s,
            todos: [
              ...s.todos.map((t) =>
                completedIds.includes(t.id)
                  ? { ...t, done: true, source: "agent" as const, completedAt: Date.now() }
                  : t
              ),
              ...newTodoTexts.map((text) => ({
                id: crypto.randomUUID(),
                text,
                done: false,
                source: "agent" as const,
                createdAt: Date.now(),
              })),
            ],
          }));
        }

        // Auto-play: if enabled and the run was for the active session
        if (autoPlayTodos && !wasStopped && owner &&
            owner.projectId === activeProjectId &&
            owner.sessionId === activeProject?.activeSessionId) {
          setTimeout(() => {
            // Read latest todos from projects state
            const latestTodos = projects.find((p) => p.id === owner.projectId)
              ?.sessions.find((s) => s.id === owner.sessionId)?.todos ?? [];
            const remaining = latestTodos.filter((t) => !t.done);
            if (remaining.length > 0) {
              const next = remaining[0];
              const nextIdx = latestTodos.indexOf(next);
              void handleRun(`Work on todo #${nextIdx + 1}: ${next.text}\n\nComplete this single item and mark it done with DONE: ${nextIdx + 1}`);
            }
          }, 1000);
        }
      }
    } catch (e) {
      setError(String(e));
      fireNotification("Agent error", String(e), "error");
    } finally {
      // Clean up per-run state
      delete streamRowsMapRef.current[runId];
      delete nextRowIdRef.current[runId];
      delete stoppedMapRef.current[runId];
      delete startTimeMapRef.current[runId];
      setInFlightRuns((prev) => {
        const next = { ...prev };
        delete next[runId];
        return next;
      });
      // If this was the active tab, clear it
      setActiveTabId((prev) => prev === runId ? null : prev);
    }
  }

  async function handleStop() {
    if (!activeTabId) return;
    stoppedMapRef.current[activeTabId] = true;
    try {
      await stopCodexExec(activeTabId);
    } catch {
      // Process may have already exited
    }
  }

  function handlePromptKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canRun) void handleRun();
      return;
    }
    if (event.key === "ArrowUp" && promptHistory.length > 0) {
      // Only navigate history when cursor is at the start of the text
      const el = event.currentTarget;
      if (el.selectionStart !== 0 || el.selectionEnd !== 0) return;
      event.preventDefault();
      const newIndex = historyIndex === -1 ? promptHistory.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(newIndex);
      setPrompt(promptHistory[newIndex]);
      return;
    }
    if (event.key === "ArrowDown" && historyIndex !== -1) {
      event.preventDefault();
      if (historyIndex >= promptHistory.length - 1) {
        setHistoryIndex(-1);
        setPrompt("");
      } else {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setPrompt(promptHistory[newIndex]);
      }
    }
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (settingsOpen && e.key === "Escape") {
        e.preventDefault();
        setSettingsOpen(false);
        return;
      }
      // Cmd/Ctrl+F to toggle search
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setSearchOpen((prev) => {
          if (prev) { setSearchQuery(""); return false; }
          setTimeout(() => searchInputRef.current?.focus(), 0);
          return true;
        });
        return;
      }
      // Escape closes search or stops run
      if (e.key === "Escape") {
        if (searchOpen) {
          setSearchOpen(false);
          setSearchQuery("");
          return;
        }
        if (anyRunning && activeTabId) {
          e.preventDefault();
          void handleStop();
        }
        return;
      }
      if (anyRunning && activeTabId && e.ctrlKey && e.key === "c") {
        e.preventDefault();
        void handleStop();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  if (loading) {
    return (
      <div className={`splash ${splashFading ? "splash-fade-out" : ""}`}>
        <div className="splash-text">
          {"busy".split("").map((char, i) => (
            <span key={i} className="splash-char" style={{ animationDelay: `${i * 0.18}s` }}>
              {char}
            </span>
          ))}
          {"dev".split("").map((char, i) => (
            <span key={i + 4} className="splash-char splash-char-blue" style={{ animationDelay: `${(i + 4) * 0.18}s` }}>
              {char}
            </span>
          ))}
          <span className="splash-cursor" />
        </div>
      </div>
    );
  }

  return (
    <div className={`container theme-${colorMode} density-${uiDensity}`}>
      <div className="main-column">
        <div className="app-header">
          <h1>busydev</h1>
          <div className="header-controls">
            {/* Terminal hidden — MAN-157: re-enable when scoped per project/session */}
            <button
              type="button"
              className={`todo-toggle ${todoMode ? "is-active" : ""}`}
              onClick={() => {
                const next = !todoMode;
                setTodoMode(next);
                setRightCollapsed(!next);
                if (next && rightPanelWidth < 220) setRightPanelWidth(280);
              }}
              title={todoMode ? "Hide todos" : "Show todos"}
            >
              <ChecklistIcon />
            </button>
            <div className="bell-wrapper">
              <button
                type="button"
                className={`bell-icon ${missedAlerts > 0 ? "has-alerts" : ""}`}
                onClick={() => {
                  setNotifPanelOpen((prev) => !prev);
                  if (missedAlerts > 0) {
                    setMissedAlerts(0);
                    badgeCountRef.current = 0;
                    void updateTrayBadge(0);
                  }
                }}
                title={missedAlerts > 0 ? `${missedAlerts} missed alert${missedAlerts > 1 ? "s" : ""}` : "Notifications"}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {missedAlerts > 0 && <span className="bell-badge">{missedAlerts}</span>}
              </button>
              {notifPanelOpen && <NotificationPanel onClose={() => setNotifPanelOpen(false)} onNavigate={navigateToSession} />}
            </div>
            <button
              type="button"
              className="todo-toggle"
              onClick={() => openSettings("general")}
              title="Open settings"
              aria-label="Open settings"
            >
              <WrenchIcon />
            </button>
            <button
              type="button"
              className="theme-toggle"
              onClick={() => setColorMode((prev) => (prev === "light" ? "dark" : "light"))}
              title={colorMode === "light" ? "Switch to dark mode" : "Switch to light mode"}
              aria-label={colorMode === "light" ? "Switch to dark mode" : "Switch to light mode"}
            >
              <span className="theme-toggle-icon"><SunIcon /></span>
              <span className="theme-toggle-icon"><MoonIcon /></span>
              <span className={`theme-toggle-knob ${colorMode === "dark" ? "is-dark" : ""}`} />
            </button>
          </div>
        </div>

        <div className="project-container">
          <ProjectNavigator
            projects={projects}
            activeProjectId={activeProjectId}
            runningProjectIds={runningProjectIds}
            onSelect={switchToProject}
            onAdd={handleAddProject}
            onRemove={handleRemoveProject}
          />
        </div>

        {activeProject && activeProject.sessions.length > 0 && (
          <SessionTabs
            sessions={activeProject.sessions}
            activeSessionId={activeProject.activeSessionId}
            sessionRunCounts={sessionRunCounts}
            sessionAlerts={sessionAlerts}
            projectId={activeProject.id}
            onSelect={(sid) => switchSession(activeProject.id, sid)}
            onNew={handleNewSession}
            onRename={handleRenameSession}
            onDelete={handleDeleteSession}
          />
        )}

        <div className="session-workspace">
        <div className="session-main">
        {searchOpen && (
          <div className="search-bar">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="search-icon">
              <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="1.7" />
              <path d="m16 16 4 4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search agent log..."
            />
            {searchQuery && (
              <button type="button" className="search-clear" onClick={() => setSearchQuery("")}>
                ×
              </button>
            )}
          </div>
        )}

        {(() => {
          // Filter in-flight runs to only show current session's runs
          const currentSessionId = activeProject?.activeSessionId;
          const sessionInFlight = Object.values(inFlightRuns).filter((r) => {
            const owner = runSessionMapRef.current[r.runId];
            return owner && owner.projectId === activeProjectId && owner.sessionId === currentSessionId;
          });
          return sessionInFlight.length > 0 ? (
          <TabBar
            tabs={sessionInFlight.map((r): Tab => ({
              id: r.runId,
              label: r.prompt.length > 30 ? r.prompt.slice(0, 30) + "..." : r.prompt,
              agent,
              running: true,
            }))}
            activeTabId={activeTabId}
            onSelectTab={setActiveTabId}
            onCloseTab={(id) => {
              stoppedMapRef.current[id] = true;
              void stopCodexExec(id);
            }}
          />
        ) : null;
        })()}

        <div className={`stream-panel ${transitioning ? "stream-panel-transitioning" : ""}`} ref={streamPanelRef}>
          {error && (
            <div className="output-section">
              <h2>Error</h2>
              <pre className="stderr">{error}</pre>
            </div>
          )}

          {sessionRuns.length === 0 && !activeInFlightRun && (
            <div className="empty-stream">Run results will appear here as a single scrollable thread.</div>
          )}

          {sessionRuns.map((run) => renderPersistedRun(run, debugMode, searchQuery))}


              {activeInFlightRun && (
                <div className="output-section output-section-live">
                  {todoMode && todos.length > 0 && (
                    <div className="todo-mode-banner">
                      Working through {todos.filter((t) => !t.done).length} of {todos.length} todos
                    </div>
                  )}
                  <div className="chat-thread">
                    <div className="chat-row chat-row-user">
                      <div className="chat-bubble chat-bubble-user">{activeInFlightRun.prompt}</div>
                    </div>
                    <div className="stream-events">
                      {activeInFlightRun.streamRows.filter((r) => !r.hidden).map((r) =>
                        renderStreamRow(r, searchQuery, (requestId, decision) =>
                          handleApproval(activeInFlightRun.runId, requestId, decision)
                        )
                      )}
                      {activeInFlightRun.streamRows.filter((r) => !r.hidden).length === 0 && (
                        <div className="ev-thinking">
                          <span className="ev-thinking-dot" />
                          Thinking...
                        </div>
                      )}
                    </div>
                  </div>
                  {debugMode && (
                    <details className="raw-details">
                      <summary>Show live raw stream events</summary>
                      <pre className="stdout">
                        {activeInFlightRun.streamRows.map((row) => `${row.category}: ${row.text}`).join("\n") || "(no events yet)"}
                      </pre>
                    </details>
                  )}
                  <div className="run-footer">
                    {debugMode && <div>Run #{activeInFlightRun.id}</div>}
                    <div className="run-footer-running">
                      <span className="running-label">Running <span className="elapsed-timer">{elapsed.toFixed(2)}s</span></span>
                      <button type="button" className="stop-button" onClick={handleStop}>
                        Stop
                      </button>
                      <span className="stop-hint">Esc / Ctrl+C</span>
                    </div>
                  </div>
                </div>
              )}
          <div ref={streamBottomRef} />
          {showScrollDown && (
            <button
              type="button"
              className="scroll-to-bottom"
              onClick={() => streamBottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })}
              title="Jump to bottom"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>

        {/* Terminal hidden — MAN-157: re-enable when scoped per project/session */}

        {activeSession?.worktreeBranch && (
          <div className="worktree-info-bar">
            <span className="worktree-info-branch">⑂ {activeSession.worktreeBranch}</span>
            <span className="worktree-info-path" title={activeSession.worktreePath}>{activeSession.worktreePath}</span>
          </div>
        )}

        <div className="bottom-panel">
          <div className="prompt-section">
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handlePromptKeyDown}
              placeholder="Get Busy..."
            />
            <div className="composer-meta">
              <button
                type="button"
                className="meta-chip-button"
                onClick={() => openSettings("session")}
              >
                Agent: {agent === "claude" ? "Claude Code" : "Codex"}
              </button>
              <button
                type="button"
                className="meta-chip-button"
                onClick={() => openSettings("session")}
              >
                Model: {modelLabel}
              </button>
              <button
                type="button"
                className="meta-chip-button"
                onClick={() => openSettings("execution")}
              >
                Approval: {approvalLabel}
              </button>
              {agent === "codex" && (
                <button
                  type="button"
                  className="meta-chip-button"
                  onClick={() => openSettings("execution")}
                >
                  Sandbox: {sandboxMode === "danger-full-access" ? "full-access" : sandboxMode}
                </button>
              )}
              {todoMode && todos.length > 0 && (
                <span className="meta-label">Todos: {todos.filter((t) => !t.done).length} remaining</span>
              )}
            </div>
            <div className="prompt-actions">
              {activeInFlightRun ? (
                <button
                  type="button"
                  onClick={handleStop}
                  className="prompt-action prompt-action-stop"
                  title="Stop active run (Esc)"
                  aria-label="Stop"
                >
                  <StopIcon />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleRun()}
                  disabled={!canRun}
                  className="prompt-action prompt-action-run"
                  title="Run"
                  aria-label="Run"
                >
                  <RunIcon />
                </button>
              )}
            </div>
          </div>
        </div>
        </div>
        {/* end session-main */}

        {!rightCollapsed && (
          <ResizeHandle side="right" onResize={handleRightResize} onResizeEnd={handleResizeEnd} />
        )}
        <div
          className={`session-todo ${rightCollapsed ? "session-todo-collapsed" : ""}`}
          style={rightCollapsed ? undefined : { width: rightPanelWidth }}
          onClick={() => { if (rightCollapsed) { setRightCollapsed(false); setTodoMode(true); } }}
        >
            <TodoPanel
            todos={todos}
            collapsed={rightCollapsed}
            canRun={workingDirectory.length > 0}
            running={anyRunning}
            onAdd={handleAddTodo}
            onToggle={handleToggleTodo}
            onDelete={handleDeleteTodo}
            onEdit={handleEditTodo}
            onCollapse={() => {
              setRightCollapsed(true);
              setTodoMode(false);
            }}
            onRunTodos={() => {
              if (todos.filter((t) => !t.done).length === 0) return;
              const nextTodo = todos.find((t) => !t.done);
              if (!nextTodo) return;
              const idx = todos.indexOf(nextTodo);
              void handleRun(`Work on todo #${idx + 1}: ${nextTodo.text}\n\nComplete this single item and mark it done with DONE: ${idx + 1}`);
            }}
            onStopTodos={handleStop}
            autoPlay={autoPlayTodos}
            onToggleAutoPlay={() => setAutoPlayTodos((prev) => !prev)}
            onClearTodos={handleClearTodos}
            onSaveTodos={handleSaveTodos}
            onReorder={(from, to) => {
              setTodos((prev) => {
                const next = [...prev];
                const [moved] = next.splice(from, 1);
                next.splice(to, 0, moved);
                return next;
              });
            }}
            onGenerateTodos={(goal) => {
              void handleRun(`IMPORTANT: Do NOT ask questions, do NOT use skills, do NOT brainstorm. Just output a todo list immediately.

Look at this codebase and break the following goal into 5-15 concrete, ordered steps. Output ONLY ADD_TODO: lines, nothing else. No explanation, no questions, no preamble.

Goal: ${goal}

Example output format:
ADD_TODO: step one description
ADD_TODO: step two description
ADD_TODO: step three description`);
            }}
          />
        </div>
        {/* end session-workspace */}
        </div>
      </div>
      {/* end main-column */}

      <SettingsView
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        initialSection={settingsSection}
        colorMode={colorMode}
        setColorMode={setColorMode}
        uiDensity={uiDensity}
        setUiDensity={setUiDensity}
        splashEnabled={splashEnabled}
        setSplashEnabled={setSplashEnabled}
        splashDurationMs={splashDurationMs}
        setSplashDurationMs={setSplashDurationMs}
        debugMode={debugMode}
        setDebugMode={setDebugMode}
        skipGitRepoCheck={skipGitRepoCheck}
        setSkipGitRepoCheck={setSkipGitRepoCheck}
        project={activeProject}
        session={activeSession}
        agent={agent}
        setAgent={setAgent}
        model={model}
        setModel={setModel}
        approvalPolicy={approvalPolicy}
        setApprovalPolicy={setApprovalPolicy}
        sandboxMode={sandboxMode}
        setSandboxMode={setSandboxMode}
        todoMode={todoMode}
        setTodoMode={(enabled) => {
          setTodoMode(enabled);
          setRightCollapsed(!enabled);
        }}
        todoAutoPlayDefault={todoAutoPlayDefault}
        setTodoAutoPlayDefault={setTodoAutoPlayDefault}
        includeSessionHistoryInPrompt={includeSessionHistoryInPrompt}
        setIncludeSessionHistoryInPrompt={setIncludeSessionHistoryInPrompt}
        claudeAutoContinue={claudeAutoContinue}
        setClaudeAutoContinue={setClaudeAutoContinue}
        terminalFontSize={terminalFontSize}
        setTerminalFontSize={setTerminalFontSize}
        terminalLineHeight={terminalLineHeight}
        setTerminalLineHeight={setTerminalLineHeight}
        rightPanelWidth={rightPanelWidth}
        setRightPanelWidth={setRightPanelWidth}
      />
      <NotificationToasts onNavigate={navigateToSession} />
    </div>
  );
}

export default App;
