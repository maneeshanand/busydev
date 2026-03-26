import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { openPath } from "@tauri-apps/plugin-opener";
import { load as loadStore } from "@tauri-apps/plugin-store";
import { getVersion } from "@tauri-apps/api/app";
import {
  CODEX_STREAM_EVENT,
  runCodexExec,
  stopCodexExec,
  writeToAgent,
  createWorktree,
  deleteWorktree,
  isGitRepo,
  updateTrayBadge,
  type CodexStreamEvent,
} from "./invoke";
import type { BusyAgent, StreamRow, RunEntry, PersistedRun, InFlightRun, TodoItem, Project, Session, SavedPromptEntry } from "./types";
import { mergeWithPresets } from "./lib/busyAgents";
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
import { GlobalSessionViewer } from "./components/GlobalSessionViewer";
import {
  buildTodoPrompt,
  getTodoAutoPlayDecision,
  parseTodoAdditions,
  parseTodoCompletions,
  shouldRenderFinalSummary,
  stripTodoMarkers,
} from "./lib/frontendUtils";
import {
  buildAliasMap,
  expandPromptAliases,
  getMentionedAliases,
  getMentionSuggestions,
  normalizeAlias,
} from "./lib/promptAliases";

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

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6 4h11a2 2 0 0 1 2 2v13H8a2 2 0 0 0-2 2V4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8 19V7a2 2 0 0 1 2-2h9" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M10.5 10h5.5M10.5 13h5.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
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

function formatAgentLabel(agent?: "codex" | "claude" | "deepseek" | string): string {
  if (agent === "claude") return "Claude";
  if (agent === "deepseek") return "DeepSeek";
  return "Codex";
}

type ClassifiedRow = Omit<StreamRow, "id">;

function extractAssistantTextChunk(event: CodexStreamEvent): string | null {
  const value = event.parsedJson;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  if (obj.type !== "assistant") return null;
  const message = obj.message as Record<string, unknown> | undefined;
  const content = message?.content;
  if (!Array.isArray(content) || content.length === 0) return null;
  const block = content[content.length - 1];
  if (!block || typeof block !== "object" || Array.isArray(block)) return null;
  const textBlock = block as Record<string, unknown>;
  if (textBlock.type !== "text") return null;
  const text = typeof textBlock.text === "string" ? textBlock.text : "";
  return text.length > 0 ? text : null;
}

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

interface MessageSegment {
  type: "text" | "code";
  content: string;
  lang?: string;
}

function splitMessageSegments(text: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  const fenceRegex = /```([a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = fenceRegex.exec(text)) !== null) {
    if (match.index > last) {
      segments.push({ type: "text", content: text.slice(last, match.index) });
    }
    segments.push({
      type: "code",
      lang: match[1]?.toLowerCase() || "",
      content: match[2].replace(/\n$/, ""),
    });
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    segments.push({ type: "text", content: text.slice(last) });
  }
  return segments.length > 0 ? segments : [{ type: "text", content: text }];
}

function formatTextSegment(text: string, segmentKey: string): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i > 0) elements.push(<br key={`${segmentKey}-br-${i}`} />);

    const bulletMatch = line.match(/^(\s*)[*-]\s+(.*)/);
    if (bulletMatch) {
      elements.push(
        <span key={`${segmentKey}-line-${i}`} className="fmt-bullet">
          <span className="fmt-bullet-dot" />
          {formatInline(bulletMatch[2])}
        </span>
      );
      continue;
    }

    elements.push(<span key={`${segmentKey}-line-${i}`}>{formatInline(line)}</span>);
  }

  return elements;
}

function renderMarkdownCode(code: string): React.ReactNode {
  const lines = code.split("\n");
  return lines.map((line, i) => {
    const key = `md-${i}`;

    if (/^\s*[-*_]{3,}\s*$/.test(line)) {
      return (
        <span key={key} className="fmt-code-line">
          <span className="fmt-token-hr">{line}</span>
          {i < lines.length - 1 ? "\n" : ""}
        </span>
      );
    }

    const heading = line.match(/^(\s{0,3}#{1,6})(\s+)(.*)$/);
    if (heading) {
      return (
        <span key={key} className="fmt-code-line">
          <span className="fmt-token-heading-marker">{heading[1]}</span>
          {heading[2]}
          <span className="fmt-token-heading-text">{heading[3]}</span>
          {i < lines.length - 1 ? "\n" : ""}
        </span>
      );
    }

    const list = line.match(/^(\s*[-*+]\s+)(.*)$/);
    if (list) {
      return (
        <span key={key} className="fmt-code-line">
          <span className="fmt-token-list-marker">{list[1]}</span>
          {list[2]}
          {i < lines.length - 1 ? "\n" : ""}
        </span>
      );
    }

    const blockquote = line.match(/^(\s*>+\s?)(.*)$/);
    if (blockquote) {
      return (
        <span key={key} className="fmt-code-line">
          <span className="fmt-token-quote-marker">{blockquote[1]}</span>
          {blockquote[2]}
          {i < lines.length - 1 ? "\n" : ""}
        </span>
      );
    }

    return (
      <span key={key} className="fmt-code-line">
        {line}
        {i < lines.length - 1 ? "\n" : ""}
      </span>
    );
  });
}

function renderJsonCode(code: string): React.ReactNode {
  const lines = code.split("\n");
  return lines.map((line, i) => {
    const key = `json-${i}`;
    const lineParts: React.ReactNode[] = [];
    const regex = /("(?:\\.|[^"\\])*")\s*:|("(?:\\.|[^"\\])*")|(\btrue\b|\bfalse\b|\bnull\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
    let last = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(line)) !== null) {
      if (match.index > last) lineParts.push(line.slice(last, match.index));
      if (match[1]) {
        lineParts.push(<span key={`${key}-k-${match.index}`} className="fmt-token-json-key">{match[1]}</span>);
        lineParts.push(":");
      } else if (match[2]) {
        lineParts.push(<span key={`${key}-s-${match.index}`} className="fmt-token-json-string">{match[2]}</span>);
      } else if (match[3]) {
        lineParts.push(<span key={`${key}-b-${match.index}`} className="fmt-token-json-bool">{match[3]}</span>);
      } else if (match[4]) {
        lineParts.push(<span key={`${key}-n-${match.index}`} className="fmt-token-json-number">{match[4]}</span>);
      }
      last = regex.lastIndex;
    }
    if (last < line.length) lineParts.push(line.slice(last));

    return (
      <span key={key} className="fmt-code-line">
        {lineParts}
        {i < lines.length - 1 ? "\n" : ""}
      </span>
    );
  });
}

function renderShellCode(code: string): React.ReactNode {
  const lines = code.split("\n");
  return lines.map((line, i) => {
    const key = `sh-${i}`;
    const trimmed = line.trimStart();
    const indent = line.slice(0, line.length - trimmed.length);

    if (trimmed.startsWith("#")) {
      return (
        <span key={key} className="fmt-code-line">
          {indent}
          <span className="fmt-token-shell-comment">{trimmed}</span>
          {i < lines.length - 1 ? "\n" : ""}
        </span>
      );
    }

    const envMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*=)(.*)$/);
    if (envMatch) {
      return (
        <span key={key} className="fmt-code-line">
          {indent}
          <span className="fmt-token-shell-env">{envMatch[1]}</span>
          {envMatch[2]}
          {i < lines.length - 1 ? "\n" : ""}
        </span>
      );
    }

    const cmdMatch = trimmed.match(/^([A-Za-z0-9_./-]+)(.*)$/);
    if (cmdMatch) {
      return (
        <span key={key} className="fmt-code-line">
          {indent}
          <span className="fmt-token-shell-command">{cmdMatch[1]}</span>
          {cmdMatch[2]}
          {i < lines.length - 1 ? "\n" : ""}
        </span>
      );
    }

    return (
      <span key={key} className="fmt-code-line">
        {line}
        {i < lines.length - 1 ? "\n" : ""}
      </span>
    );
  });
}

function formatCodeSegment(code: string, lang: string, segmentKey: string): React.ReactNode {
  const language = lang || "text";
  const isShell = language === "bash" || language === "sh" || language === "zsh" || language === "shell";
  const renderedCode = language === "markdown"
    ? renderMarkdownCode(code)
    : language === "json"
      ? renderJsonCode(code)
      : isShell
        ? renderShellCode(code)
        : code;
  return (
    <div key={segmentKey} className="fmt-code-block">
      <div className="fmt-code-block-header">
        <span className="fmt-code-block-lang">{language}</span>
      </div>
      <pre>
        <code className={`language-${language}`}>
          {renderedCode}
        </code>
      </pre>
    </div>
  );
}

function formatMessage(text: string): React.ReactNode {
  const segments = splitMessageSegments(text);
  return segments.map((segment, idx) => {
    const key = `seg-${idx}`;
    if (segment.type === "code") {
      return formatCodeSegment(segment.content, segment.lang || "", key);
    }
    return <span key={key}>{formatTextSegment(segment.content, key)}</span>;
  });
}

function handleOpenPath(path: string) {
  void openPath(path);
}

function formatInline(text: string): React.ReactNode {
  // Process inline: **bold**, `code`, *italic*, /absolute/file/paths, URLs
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|`([^`]+)`|\*(.+?)\*|(https?:\/\/[^\s<>)"']+)|(\/[\w./-]+\.\w+))/g;
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
      // URL — strip trailing punctuation that's likely not part of the URL
      let url = match[5];
      const trailingPunct = /[.,;:!?)]+$/.exec(url);
      if (trailingPunct) url = url.slice(0, -trailingPunct[0].length);
      parts.push(
        <a key={key++} className="fmt-link" href={url} target="_blank" rel="noopener noreferrer" title={url}>
          {url}
        </a>
      );
      // Push back any stripped trailing punctuation as plain text
      if (trailingPunct) parts.push(trailingPunct[0]);
    } else if (match[6]) {
      // Bare file path
      parts.push(
        <span key={key++} className="fmt-path" onClick={() => handleOpenPath(match![6])} title="Open file">
          {match[6]}
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
  deepseekStyle = false,
) {
  if (row.hidden) return null;

  const hl = (text: string) => highlightText(text, searchQuery);

  switch (row.category) {
    case "message":
      return (
        <div key={row.id} className="chat-row chat-row-agent">
          <div className={`ev-message ${row.isTodoSummary ? "ev-message-todo" : ""} ${deepseekStyle ? "ev-message-deepseek" : ""}`}>{searchQuery ? hl(row.text) : formatMessage(row.text)}</div>
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

function renderPersistedRun(
  run: PersistedRun,
  debugMode: boolean,
  searchQuery = "",
  deepseekStyle = false,
  defaultAgent = "codex",
) {
  const hl = (text: string) => highlightText(text, searchQuery);
  const runAgentLabel = formatAgentLabel(run.agent ?? defaultAgent);
  return (
    <div key={`persisted-${run.id}`} className="output-section">
      <div className="chat-thread">
        <div className="chat-row chat-row-user">
          <div className="chat-bubble chat-bubble-user">{hl(run.prompt)}</div>
        </div>

        {run.streamRows.length > 0 && (
          <div className="stream-events">
            {run.streamRows.filter((r) => !r.hidden).map((r) => renderStreamRow(r, searchQuery, undefined, deepseekStyle))}
          </div>
        )}

        {shouldRenderFinalSummary(run.streamRows, run.finalSummary) && (
          <div className="chat-row chat-row-agent chat-row-final">
            <div className="ev-message ev-message-final">{searchQuery ? hl(run.finalSummary) : formatMessage(run.finalSummary)}</div>
          </div>
        )}
      </div>

      <div className="run-footer">
        {debugMode && <div>Run #{run.id}</div>}
        <div>{run.stopped ? `Stopped after ${(run.durationMs / 1000).toFixed(1)}s` : `Finished in ${(run.durationMs / 1000).toFixed(1)}s`}</div>
        {debugMode && <div>Exit code: {run.exitCode ?? "N/A"}</div>}
        {run.completedAt && <div className="run-timestamp">{runAgentLabel} · {formatTimestamp(run.completedAt)}</div>}
      </div>
    </div>
  );
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
  const [promptLibrary, setPromptLibrary] = useState<SavedPromptEntry[]>([]);
  const [busyAgents, setBusyAgents] = useState<BusyAgent[]>([]);
  const allAgents = useMemo(() => mergeWithPresets(busyAgents), [busyAgents]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [promptHistory, setPromptHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [addingProject, setAddingProject] = useState(false);
  // Transition state for smooth session/project switching
  const [transitioning, setTransitioning] = useState(false);

  // In-flight runs (global, keyed by runId — survive session/project switches)
  const [inFlightRuns, setInFlightRuns] = useState<Record<string, InFlightRun>>({});
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [todoAutoPlayDefault, setTodoAutoPlayDefault] = useState(false);
  const [todoMaxRetries, setTodoMaxRetries] = useState(3);
  const [includeSessionHistoryInPrompt, setIncludeSessionHistoryInPrompt] = useState(true);
  const [claudeAutoContinue, setClaudeAutoContinue] = useState(true);
  const [terminalFontSize, setTerminalFontSize] = useState(13);
  const [terminalLineHeight, setTerminalLineHeight] = useState(1.3);

  const [rightPanelWidth, setRightPanelWidth] = useState(280);

  // Track which session owns which runId (for background run completion)
  const runSessionMapRef = useRef<Record<string, { projectId: string; sessionId: string }>>({});
  // Track which todo ID was requested for each run (stable identity across reorders)
  const runTodoIdRef = useRef<Record<string, string | null>>({});
  // Track retry count per todo ID (resets when a different todo is attempted)
  const todoRetryCountRef = useRef<Record<string, number>>({});
  const todoMaxRetriesRef = useRef(3);
  const projectsRef = useRef<Project[]>([]);
  const activeProjectIdRef = useRef<string | null>(null);
  const activeSessionIdRef = useRef<string | null>(null);
  const autoPlayTodosRef = useRef(false);

  const [showScrollDown, setShowScrollDown] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const promptInputRef = useRef<HTMLTextAreaElement | null>(null);
  const streamPanelRef = useRef<HTMLDivElement | null>(null);
  const streamBottomRef = useRef<HTMLDivElement | null>(null);
  const streamRowsMapRef = useRef<Record<string, StreamRow[]>>({});
  const nextRowIdRef = useRef<Record<string, number>>({});
  const stoppedMapRef = useRef<Record<string, boolean>>({});
  const startTimeMapRef = useRef<Record<string, number>>({});
  const badgeCountRef = useRef(0);
  const [missedAlerts, setMissedAlerts] = useState(0);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [globalViewOpen, setGlobalViewOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const storeReadyRef = useRef(false);
  const [windowSize, setWindowSize] = useState<{ windowWidth?: number; windowHeight?: number }>({});
  const [appVersion, setAppVersion] = useState("unknown");
  const appBuild = __APP_BUILD__;

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
  const aliasMap = useMemo(() => buildAliasMap(promptLibrary), [promptLibrary]);
  const mentionedAliases = useMemo(() => getMentionedAliases(prompt, aliasMap), [aliasMap, prompt]);
  const mentionSuggestions = useMemo(() => getMentionSuggestions(aliasMap, mentionQuery), [aliasMap, mentionQuery]);
  const todoMode = activeSession?.todoMode ?? false;
  const autoPlayTodos = activeSession?.autoPlay ?? false;
  const [todoPanelOpen, setTodoPanelOpen] = useState(false);
  const [confirmTodoMode, setConfirmTodoMode] = useState(false);
  const rightCollapsed = !todoPanelOpen;

  // Keep refs current so async run completions don't rely on stale render state.
  projectsRef.current = projects;
  activeProjectIdRef.current = activeProjectId;
  activeSessionIdRef.current = activeProject?.activeSessionId ?? null;
  autoPlayTodosRef.current = autoPlayTodos;
  todoMaxRetriesRef.current = todoMaxRetries;

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
    todoMaxRetries,
    rightPanelWidth,
    includeSessionHistoryInPrompt,
    claudeAutoContinue,
    terminalFontSize,
    terminalLineHeight,
    promptLibrary,
    busyAgents,
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
    todoMaxRetries,
    rightPanelWidth,
    includeSessionHistoryInPrompt,
    claudeAutoContinue,
    terminalFontSize,
    terminalLineHeight,
    promptLibrary,
    busyAgents,
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
  const runningSessionKeys = new Set(Object.keys(sessionRunCounts));

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

  // Load app metadata for display in Settings.
  useEffect(() => {
    void getVersion()
      .then((v) => setAppVersion(v))
      .catch(() => setAppVersion("unknown"));
  }, []);

  // Request notification permission on mount.
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
          setTodoAutoPlayDefault(migrated.todoAutoPlayDefault);
          setTodoMaxRetries(migrated.todoMaxRetries);
          setRightPanelWidth(migrated.rightPanelWidth);
          setIncludeSessionHistoryInPrompt(migrated.includeSessionHistoryInPrompt);
          setClaudeAutoContinue(migrated.claudeAutoContinue);
          setTerminalFontSize(migrated.terminalFontSize);
          setTerminalLineHeight(migrated.terminalLineHeight);
          setPromptLibrary(migrated.promptLibrary);
          setBusyAgents(migrated.busyAgents);
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

      const assistantChunk = extractAssistantTextChunk(payload);
      if (assistantChunk !== null) {
        const appendChunk = (rows: StreamRow[]): StreamRow[] => {
          if (!nextRowIdRef.current[rid]) nextRowIdRef.current[rid] = 1;
          const last = rows[rows.length - 1];
          if (last && last.category === "message") {
            return rows.map((r, i) => (i === rows.length - 1 ? { ...r, text: `${r.text}${assistantChunk}` } : r));
          }
          const row: StreamRow = { id: nextRowIdRef.current[rid]++, category: "message", text: assistantChunk };
          return [...rows, row];
        };

        const nextRows = appendChunk(streamRowsMapRef.current[rid] || []);
        streamRowsMapRef.current[rid] = nextRows;
        setInFlightRuns((prev) => {
          const run = prev[rid];
          if (!run) return prev;
          return { ...prev, [rid]: { ...run, streamRows: nextRows } };
        });
        return;
      }

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
  function handleUpdateTodo(id: string, updates: Partial<TodoItem>) {
    setTodos((prev) => prev.map((t) => t.id === id ? { ...t, ...updates } : t));
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
  function createPromptLibraryEntry(entry: { name: string; alias: string; kind: "prompt" | "function"; content: string }) {
    const now = Date.now();
    const id = crypto.randomUUID();
    const aliasBase = normalizeAlias(entry.alias || entry.name);
    const usedAliases = new Set(promptLibrary.map((item) => normalizeAlias(item.alias || item.name)));
    let alias = aliasBase;
    let suffix = 2;
    while (usedAliases.has(alias)) {
      alias = `${aliasBase}-${suffix}`;
      suffix += 1;
    }
    if (!alias) return;
    setPromptLibrary((prev) => [
      {
        id,
        name: entry.name,
        alias,
        kind: entry.kind,
        content: entry.content,
        createdAt: now,
        updatedAt: now,
      },
      ...prev,
    ]);
  }
  function updatePromptLibraryEntry(entry: SavedPromptEntry) {
    const aliasBase = normalizeAlias(entry.alias || entry.name);
    const usedAliases = new Set(
      promptLibrary
        .filter((item) => item.id !== entry.id)
        .map((item) => normalizeAlias(item.alias || item.name)),
    );
    let alias = aliasBase;
    let suffix = 2;
    while (usedAliases.has(alias)) {
      alias = `${aliasBase}-${suffix}`;
      suffix += 1;
    }
    if (!alias) return;
    setPromptLibrary((prev) =>
      prev.map((item) => (item.id === entry.id ? { ...entry, alias } : item)),
    );
  }
  function deletePromptLibraryEntry(id: string) {
    setPromptLibrary((prev) => prev.filter((item) => item.id !== id));
  }

  function createBusyAgent(entry: Omit<BusyAgent, "id" | "createdAt" | "updatedAt">) {
    const now = Date.now();
    setBusyAgents((prev) => [...prev, { ...entry, id: crypto.randomUUID(), createdAt: now, updatedAt: now }]);
  }

  function updateBusyAgent(agent: BusyAgent) {
    setBusyAgents((prev) => prev.map((a) => a.id === agent.id ? { ...agent, updatedAt: Date.now() } : a));
  }

  function deleteBusyAgent(id: string) {
    setBusyAgents((prev) => prev.filter((a) => a.id !== id));
  }

  function resetBusyAgentToPreset(id: string) {
    // Remove user customization — mergeWithPresets will fall back to the default preset
    setBusyAgents((prev) => prev.filter((a) => a.id !== id));
  }

  function detectMentionAtCursor(nextPrompt: string, cursor: number) {
    const beforeCursor = nextPrompt.slice(0, cursor);
    const match = beforeCursor.match(/(^|\s)@([a-zA-Z0-9_-]*)$/);
    if (!match) {
      setMentionOpen(false);
      setMentionQuery("");
      setMentionStart(null);
      setMentionIndex(0);
      return;
    }
    const query = match[2] ?? "";
    setMentionOpen(true);
    setMentionQuery(query);
    setMentionStart(cursor - query.length - 1);
    setMentionIndex(0);
  }

  function insertMentionAlias(alias: string) {
    if (mentionStart === null) return;
    const textarea = promptInputRef.current;
    const cursor = textarea?.selectionStart ?? prompt.length;
    const before = prompt.slice(0, mentionStart);
    const after = prompt.slice(cursor);
    const next = `${before}@${alias} ${after}`;
    setPrompt(next);
    setMentionOpen(false);
    setMentionQuery("");
    setMentionStart(null);
    requestAnimationFrame(() => {
      if (!textarea) return;
      const nextCursor = before.length + alias.length + 2;
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  }
  function setTodoMode(enabled: boolean) { updateActiveSession((s) => ({ ...s, todoMode: enabled })); }
  function setAutoPlayTodos(enabled: boolean) { updateActiveSession((s) => ({ ...s, autoPlay: enabled })); }

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
    // Immediately kill auto-play ref to prevent race with delayed callbacks
    autoPlayTodosRef.current = false;
    // Clear retry counters for the previous session
    todoRetryCountRef.current = {};

    setTransitioning(true);
    setTimeout(() => {
      setActiveTabId(null);
      setError(null);
      setPrompt("");
      setPromptHistory([]);
      setHistoryIndex(-1);
      setSearchQuery("");
      setSearchOpen(false);
      setNotifPanelOpen(false);
      setTodoPanelOpen(false);
      setElapsed(0);
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
    if (addingProject) return;
    setAddingProject(true);
    try {
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
    } catch (err) {
      setError(`Failed to load project directory: ${String(err)}`);
    } finally {
      setAddingProject(false);
    }
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
    const notification = addNotification({ title, message, level, projectId, sessionId });
    if (!document.hasFocus()) {
      badgeCountRef.current += 1;
      setMissedAlerts(badgeCountRef.current);
      void updateTrayBadge(badgeCountRef.current);
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification(notification.title, {
          body: notification.message,
          tag: notification.id,
        });
      }
    }
  }

  async function handleRun(overridePrompt?: string, overrides?: { agentOverride?: string; modelOverride?: string }) {
    const submittedPrompt = overridePrompt ?? prompt;
    const expandedPrompt = expandPromptAliases(submittedPrompt, aliasMap);
    const requestedTodoMatch = submittedPrompt.match(/work on todo #(\d+)/i);
    const requestedTodoIndex = requestedTodoMatch ? Number.parseInt(requestedTodoMatch[1], 10) : null;
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

    // Capture the requested todo ID at run start for stable loop-guard identity
    if (requestedTodoIndex !== null && activeSession) {
      const todos = activeSession.todos ?? [];
      const idx = requestedTodoIndex - 1;
      runTodoIdRef.current[runId] = idx >= 0 && idx < todos.length ? todos[idx].id : null;
    } else {
      runTodoIdRef.current[runId] = null;
    }
    setElapsed(0);

    // Strip system instructions from display — keep only the user-visible portion
    let displayPrompt = submittedPrompt;
    // Todo generation prompt → show just the goal
    const goalMatch = submittedPrompt.match(/\nGoal: (.+)\n/);
    if (goalMatch && submittedPrompt.includes("ADD_TODO:")) {
      displayPrompt = `Generate todos: ${goalMatch[1]}`;
    }
    // Auto-play prompt → show just the task
    const todoWorkMatch = submittedPrompt.match(/^Work on todo #(\d+): (.+?)(?:\n|$)/);
    if (todoWorkMatch) {
      displayPrompt = `Todo #${todoWorkMatch[1]}: ${todoWorkMatch[2]}`;
    }

    // Add to in-flight runs and switch to this tab
    setInFlightRuns((prev) => ({
      ...prev,
      [runId]: { id: runNumber, runId, prompt: displayPrompt, streamRows: [] },
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
      ? buildTodoPrompt(expandedPrompt, todos)
      : expandedPrompt;

    const effectivePrompt = sessionContext + basePrompt;

    const effectiveAgent = (overrides?.agentOverride || agent) as "codex" | "claude" | "deepseek";
    const effectiveModel = overrides?.modelOverride || model;

    try {
      const out = await runCodexExec({
        runId,
        agent: effectiveAgent,
        prompt: effectivePrompt,
        approvalPolicy,
        sandboxMode,
        workingDirectory,
        model: effectiveModel || undefined,
        skipGitRepoCheck,
        previousPrompts: effectiveAgent === "claude" && claudeAutoContinue
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
        prompt: displayPrompt,
        streamRows: finalStreamRows,
        exitCode: out.exitCode,
        durationMs: out.durationMs,
        finalSummary: buildFinalSummary({ id: runNumber, prompt: displayPrompt, output: out, streamRows: finalStreamRows, stopped: wasStopped }),
        stopped: wasStopped,
        completedAt: Date.now(),
        agent: effectiveAgent,
      };

      // Write completed run to the owning session (may be different from active if user switched)
      const owner = runSessionMapRef.current[runId];

      // Fire notification for completed run
      if (!wasStopped) {
        if (out.exitCode === 0) {
          fireNotification("Agent completed", displayPrompt.slice(0, 60), "success", owner?.projectId, owner?.sessionId);
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

      // Auto-update todos in the owning session (check the OWNER's todoMode, not the active session's)
      const ownerSession = owner
        ? projectsRef.current.find((p) => p.id === owner.projectId)
            ?.sessions.find((s) => s.id === owner.sessionId)
        : null;
      if (ownerSession?.todoMode && !wasStopped && owner) {
        const ownerTodos = ownerSession?.todos ?? [];
        const requestedTodoId = runTodoIdRef.current[runId] ?? null;
        const completedIds = parseTodoCompletions(out, ownerTodos);
        const newTodoTexts = parseTodoAdditions(out);
        const todoProgressMade = completedIds.length > 0 || newTodoTexts.length > 0;
        const updatedOwnerTodos: TodoItem[] = [
          ...ownerTodos.map((t) =>
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
        ];

        if (todoProgressMade) {
          updateSession(owner.projectId, owner.sessionId, (s) => ({
            ...s,
            todos: updatedOwnerTodos,
          }));
        }

        // Track retries per todo for auto-play loop guard
        if (requestedTodoId) {
          if (todoProgressMade) {
            // Progress was made — reset retry counter
            todoRetryCountRef.current[requestedTodoId] = 0;
          } else {
            // No progress — increment retry counter
            todoRetryCountRef.current[requestedTodoId] = (todoRetryCountRef.current[requestedTodoId] ?? 0) + 1;
          }
        }

        // Auto-play: check the OWNER session's autoPlay, not the active session
        if (ownerSession?.autoPlay && !wasStopped) {
          setTimeout(() => {
            // Re-read owner session to verify auto-play and todoMode are still enabled
            const latestOwner = projectsRef.current.find((p) => p.id === owner.projectId)
              ?.sessions.find((s) => s.id === owner.sessionId);
            if (!latestOwner?.autoPlay || !latestOwner?.todoMode) return;
            // handleRun targets the active session — only continue if owner is still active
            if (owner.projectId !== activeProjectIdRef.current || owner.sessionId !== activeSessionIdRef.current) {
              fireNotification("Auto-play paused", "Session is no longer active. Switch back to continue.", "warning", owner.projectId, owner.sessionId);
              return;
            }
            const latestTodos = latestOwner.todos ?? [];
            const sourceTodos = latestTodos.length > 0 ? latestTodos : updatedOwnerTodos;
            const decision = getTodoAutoPlayDecision(sourceTodos, requestedTodoId, todoProgressMade);
            if (!decision.nextTodo || decision.nextIndex === null) return;

            // Check retry cap
            const retries = todoRetryCountRef.current[decision.nextTodo.id] ?? 0;
            if (decision.shouldPauseForLoop || retries >= todoMaxRetriesRef.current) {
              fireNotification(
                "Todo auto-play paused",
                retries >= todoMaxRetriesRef.current
                  ? `Todo #${decision.nextIndex + 1} failed ${retries} times. Run manually to continue.`
                  : "No DONE/ADD_TODO markers were detected. Run manually to continue.",
                "warning",
                owner.projectId,
                owner.sessionId,
              );
              return;
            }
            let autoPlayPrompt = `Work on todo #${decision.nextIndex + 1}: ${expandPromptAliases(decision.nextTodo.text, aliasMap)}`;
            if (decision.nextTodo.notes) {
              autoPlayPrompt += `\n\nContext: ${expandPromptAliases(decision.nextTodo.notes, aliasMap)}`;
            }
            autoPlayPrompt += `\n\nComplete this single item and mark it done with DONE: ${decision.nextIndex + 1}`;
            void handleRun(autoPlayPrompt, { agentOverride: decision.nextTodo.agent, modelOverride: decision.nextTodo.model });
          }, 1000);
        }
      }
    } catch (e) {
      const errorText = String(e);
      setError(errorText);
      fireNotification("Agent error", errorText, "error");

      // Persist failed runs so API/debug errors remain visible in session history.
      const owner = runSessionMapRef.current[runId];
      const currentRows = streamRowsMapRef.current[runId] || [];
      const nextId = nextRowIdRef.current[runId] || (currentRows.length + 1);
      const finalStreamRows: StreamRow[] = [
        ...currentRows,
        { id: nextId, category: "error", text: errorText },
      ];

      if (owner) {
        const startedAt = startTimeMapRef.current[runId] || Date.now();
        const durationMs = Math.max(0, Date.now() - startedAt);
        const failedRun: PersistedRun = {
          id: runNumber,
          prompt: displayPrompt,
          streamRows: finalStreamRows,
          exitCode: null,
          durationMs,
          finalSummary: `Run failed: ${errorText}`,
          completedAt: Date.now(),
          agent: effectiveAgent,
        };
        updateSession(owner.projectId, owner.sessionId, (s) => ({
          ...s,
          runs: [...s.runs, failedRun],
        }));
      }
    } finally {
      // Clean up per-run state
      delete streamRowsMapRef.current[runId];
      delete nextRowIdRef.current[runId];
      delete stoppedMapRef.current[runId];
      delete startTimeMapRef.current[runId];
      delete runTodoIdRef.current[runId];
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
    if (mentionOpen && mentionSuggestions.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setMentionIndex((prev) => (prev + 1) % mentionSuggestions.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setMentionIndex((prev) => (prev <= 0 ? mentionSuggestions.length - 1 : prev - 1));
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        const picked = mentionSuggestions[Math.max(0, Math.min(mentionIndex, mentionSuggestions.length - 1))];
        if (picked) insertMentionAlias(picked.alias);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setMentionOpen(false);
        return;
      }
    }
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
      const isMod = e.metaKey || e.ctrlKey;
      const isPrevTabShortcut = isMod && e.shiftKey && (e.code === "BracketLeft" || e.key === "[");
      const isNextTabShortcut = isMod && e.shiftKey && (e.code === "BracketRight" || e.key === "]");

      if (isPrevTabShortcut || isNextTabShortcut) {
        e.preventDefault();
        const direction = isPrevTabShortcut ? -1 : 1;

        // Prefer navigating in-flight run tabs for the active session when present.
        const currentSessionId = activeProject?.activeSessionId;
        const runTabIds = Object.values(inFlightRuns)
          .filter((r) => {
            const owner = runSessionMapRef.current[r.runId];
            return owner && owner.projectId === activeProjectId && owner.sessionId === currentSessionId;
          })
          .map((r) => r.runId);

        if (runTabIds.length > 1) {
          const currentIndex = activeTabId && runTabIds.includes(activeTabId)
            ? runTabIds.indexOf(activeTabId)
            : 0;
          const nextIndex = (currentIndex + direction + runTabIds.length) % runTabIds.length;
          setActiveTabId(runTabIds[nextIndex]);
          return;
        }

        // Otherwise navigate session tabs.
        if (activeProject && activeProject.sessions.length > 1 && activeProject.activeSessionId) {
          const sessionIds = activeProject.sessions.map((s) => s.id);
          const currentIndex = Math.max(0, sessionIds.indexOf(activeProject.activeSessionId));
          const nextIndex = (currentIndex + direction + sessionIds.length) % sessionIds.length;
          switchSession(activeProject.id, sessionIds[nextIndex]);
        }
        return;
      }

      // Cmd/Ctrl+K to toggle Global Session Viewer
      if (isMod && e.key === "k") {
        e.preventDefault();
        setGlobalViewOpen((prev) => !prev);
        return;
      }
      if (globalViewOpen && e.key === "Escape") {
        e.preventDefault();
        setGlobalViewOpen(false);
        return;
      }
      if (settingsOpen && e.key === "Escape") {
        e.preventDefault();
        setSettingsOpen(false);
        return;
      }
      // Cmd/Ctrl+L opens Prompt Library
      if (isMod && e.key.toLowerCase() === "l") {
        e.preventDefault();
        openSettings("library");
        return;
      }
      // Cmd/Ctrl+F to toggle search
      if (isMod && e.key === "f") {
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
              className="todo-toggle"
              onClick={() => setGlobalViewOpen(true)}
              title="All sessions (⌘K)"
              aria-label="All sessions"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
              </svg>
            </button>
            <button
              type="button"
              className="todo-toggle"
              onClick={() => openSettings("library")}
              title="Prompt library (⌘L)"
              aria-label="Prompt library"
            >
              <BookIcon />
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
          </div>
        </div>

        <div className="project-bar">
          {projects.map((p) => (
            <div
              key={p.id}
              className={`project-tab ${p.id === activeProjectId ? "project-tab-active" : ""}`}
              onClick={() => switchToProject(p.id)}
            >
              {runningProjectIds.has(p.id) && <span className="project-tab-spinner" />}
              <span>{p.name}</span>
              <button
                type="button"
                className="project-tab-remove"
                onClick={(e) => { e.stopPropagation(); handleRemoveProject(p.id); }}
                title="Remove project"
              >×</button>
            </div>
          ))}
          <button type="button" className="project-tab-add" onClick={handleAddProject}>+</button>
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

          {sessionRuns.map((run) => renderPersistedRun(run, debugMode, searchQuery, agent === "deepseek", agent))}


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
                        , agent === "deepseek")
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
              ref={promptInputRef}
              rows={3}
              value={prompt}
              onChange={(e) => {
                const next = e.target.value;
                setPrompt(next);
                detectMentionAtCursor(next, e.target.selectionStart ?? next.length);
              }}
              onClick={(e) => {
                const el = e.currentTarget;
                detectMentionAtCursor(el.value, el.selectionStart ?? el.value.length);
              }}
              onKeyUp={(e) => {
                const el = e.currentTarget;
                detectMentionAtCursor(el.value, el.selectionStart ?? el.value.length);
              }}
              onKeyDown={handlePromptKeyDown}
              placeholder="Get Busy..."
            />
            {mentionOpen && mentionSuggestions.length > 0 && (
              <div className="composer-mention-menu">
                {mentionSuggestions.map((entry, idx) => (
                  <button
                    key={entry.id}
                    type="button"
                    className={`composer-mention-item ${idx === mentionIndex ? "is-active" : ""}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertMentionAlias(entry.alias);
                    }}
                  >
                    <span className="composer-mention-alias">@{entry.alias}</span>
                    <span className="composer-mention-name">{entry.name}</span>
                    <span className="composer-mention-kind">{entry.kind}</span>
                  </button>
                ))}
              </div>
            )}
            {mentionedAliases.length > 0 && (
              <div className="composer-mentions">
                {mentionedAliases.map((entry) => (
                  <span key={entry.id} className="composer-mention-chip">
                    @{entry.alias}
                  </span>
                ))}
              </div>
            )}
            <div className="composer-meta">
              <select
                className="meta-chip-select"
                value={agent}
                onChange={(e) => setAgent(e.target.value)}
                title="Agent"
              >
                <option value="codex">Codex</option>
                <option value="claude">Claude</option>
                <option value="deepseek">DeepSeek</option>
              </select>
              <select
                className="meta-chip-select"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                title="Model"
              >
                {agent === "claude" ? (
                  <>
                    <option value="">claude-sonnet-4-6</option>
                    <option value="claude-opus-4-6">claude-opus-4-6</option>
                    <option value="claude-haiku-4-5">claude-haiku-4-5</option>
                  </>
                ) : agent === "deepseek" ? (
                  <>
                    <option value="">deepseek-chat</option>
                    <option value="deepseek-chat">deepseek-chat</option>
                    <option value="deepseek-reasoner">deepseek-reasoner</option>
                  </>
                ) : (
                  <>
                    <option value="">codex-mini</option>
                    <option value="o3">o3</option>
                    <option value="o4-mini">o4-mini</option>
                  </>
                )}
              </select>
              <select
                className="meta-chip-select"
                value={
                  approvalPolicy === "full-auto" && sandboxMode === "danger-full-access" ? "full-auto"
                  : approvalPolicy === "never" && sandboxMode === "read-only" ? "safe"
                  : approvalPolicy === "unless-allow-listed" && sandboxMode === "workspace-write" ? "balanced"
                  : "custom"
                }
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "safe") { setApprovalPolicy("never"); setSandboxMode("read-only"); }
                  else if (v === "balanced") { setApprovalPolicy("unless-allow-listed"); setSandboxMode("workspace-write"); }
                  else if (v === "full-auto") { setApprovalPolicy("full-auto"); setSandboxMode("danger-full-access"); }
                }}
                title="Execution mode"
              >
                <option value="safe">Safe</option>
                <option value="balanced">Balanced</option>
                <option value="full-auto">Full Auto</option>
                {approvalPolicy !== "full-auto" && approvalPolicy !== "never" && approvalPolicy !== "unless-allow-listed" && (
                  <option value="custom">Custom</option>
                )}
              </select>
              {todoMode && todos.length > 0 && (
                <span className="meta-label" title="Remaining todos">
                  {todos.filter((t) => !t.done).length} left
                </span>
              )}
            </div>
            <div className="prompt-actions">
              <button
                type="button"
                className={`prompt-action prompt-action-todo ${todoMode ? "is-active" : ""}`}
                onClick={() => {
                  if (todoMode) {
                    setTodoMode(false);
                    setTodoPanelOpen(false);
                  } else {
                    setConfirmTodoMode(true);
                  }
                }}
                title={todoMode ? "Disable todo mode" : "Enable todo mode"}
                aria-label="Toggle todo mode"
              >
                <ChecklistIcon />
              </button>
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

        {confirmTodoMode && (
          <div className="confirm-overlay" onClick={() => setConfirmTodoMode(false)}>
            <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
              <div className="confirm-title">Enable Todo Mode?</div>
              <p className="confirm-body">
                In todo mode, the agent will work through your todo list items sequentially. Auto-play will run each item one by one until all are complete or paused.
              </p>
              <div className="confirm-actions">
                <button type="button" className="confirm-cancel" onClick={() => setConfirmTodoMode(false)}>Cancel</button>
                <button
                  type="button"
                  className="confirm-cancel"
                  style={{ background: "var(--vp-c-brand-1)", color: "white" }}
                  onClick={() => {
                    setTodoMode(true);
                    setTodoPanelOpen(true);
                    if (rightPanelWidth < 220) setRightPanelWidth(280);
                    setConfirmTodoMode(false);
                  }}
                >
                  Enable
                </button>
              </div>
            </div>
          </div>
        )}

        {!rightCollapsed && (
          <ResizeHandle side="right" onResize={handleRightResize} onResizeEnd={handleResizeEnd} />
        )}
        <div
          className={`session-todo ${rightCollapsed ? "session-todo-collapsed" : ""}`}
          style={rightCollapsed ? undefined : { width: rightPanelWidth }}
          onClick={() => { if (rightCollapsed) { setTodoPanelOpen(true); } }}
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
            onUpdateTodo={handleUpdateTodo}
            onCollapse={() => {
              setTodoPanelOpen(false);
            }}
            onRunTodos={() => {
              const nextTodo = todos.find((t) => !t.done);
              if (!nextTodo) return;
              const idx = todos.indexOf(nextTodo);
              let todoPrompt = `Work on todo #${idx + 1}: ${expandPromptAliases(nextTodo.text, aliasMap)}`;
              if (nextTodo.notes) {
                todoPrompt += `\n\nContext: ${expandPromptAliases(nextTodo.notes, aliasMap)}`;
              }
              todoPrompt += `\n\nComplete this single item and mark it done with DONE: ${idx + 1}`;
              void handleRun(todoPrompt, { agentOverride: nextTodo.agent, modelOverride: nextTodo.model });
            }}
            onStopTodos={handleStop}
            todoMode={todoMode}
            autoPlay={autoPlayTodos}
            onToggleAutoPlay={() => setAutoPlayTodos(!autoPlayTodos)}
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
        agent={agent}
        approvalPolicy={approvalPolicy}
        setApprovalPolicy={setApprovalPolicy}
        sandboxMode={sandboxMode}
        setSandboxMode={setSandboxMode}
        todoAutoPlayDefault={todoAutoPlayDefault}
        setTodoAutoPlayDefault={setTodoAutoPlayDefault}
        todoMaxRetries={todoMaxRetries}
        setTodoMaxRetries={setTodoMaxRetries}
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
        appVersion={appVersion}
        appBuild={appBuild}
        promptLibrary={promptLibrary}
        onCreatePromptLibraryEntry={createPromptLibraryEntry}
        onUpdatePromptLibraryEntry={updatePromptLibraryEntry}
        onDeletePromptLibraryEntry={deletePromptLibraryEntry}
        busyAgents={allAgents}
        onCreateBusyAgent={createBusyAgent}
        onUpdateBusyAgent={updateBusyAgent}
        onDeleteBusyAgent={deleteBusyAgent}
        onResetBusyAgent={resetBusyAgentToPreset}
        onResetEnvironment={() => {
          setProjects([]);
          setActiveProjectId(null);
          setInFlightRuns({});
          setPromptLibrary([]);
          setBusyAgents([]);
          useNotificationStore.getState().clearNotifications();
          setMissedAlerts(0);
          badgeCountRef.current = 0;
          void updateTrayBadge(0);
          resetEphemeralState();
        }}
      />
      {globalViewOpen && (
        <GlobalSessionViewer
          projects={projects}
          activeProjectId={activeProjectId}
          activeSessionId={activeProject?.activeSessionId ?? null}
          runningSessionKeys={runningSessionKeys}
          onNavigate={navigateToSession}
          onClose={() => setGlobalViewOpen(false)}
        />
      )}
      <NotificationToasts onNavigate={navigateToSession} />
    </div>
  );
}

export default App;
