import { useEffect, useRef, useState, useCallback } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { load as loadStore } from "@tauri-apps/plugin-store";
import {
  CODEX_STREAM_EVENT,
  runCodexExec,
  stopCodexExec,
  type CodexExecOutput,
  type CodexStreamEvent,
} from "./invoke";
import type { StreamRow, RunEntry, PersistedRun, InFlightRun, Session, TodoItem } from "./types";
import { SessionPanel } from "./components/SessionPanel";
import { TodoPanel } from "./components/TodoPanel";
import { ResizeHandle } from "./components/ResizeHandle";

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

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-9Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m12 2 1.2 2.2a7.7 7.7 0 0 1 1.8.7l2.3-.8 1.8 3-1.8 1.7a8 8 0 0 1 0 2.4l1.8 1.7-1.8 3-2.3-.8a7.7 7.7 0 0 1-1.8.7L12 22l-1.2-2.2a7.7 7.7 0 0 1-1.8-.7l-2.3.8-1.8-3 1.8-1.7a8 8 0 0 1 0-2.4L4.9 10l1.8-3 2.3.8a7.7 7.7 0 0 1 1.8-.7L12 2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
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

interface TurnUsage {
  inputTokens: number;
  outputTokens: number;
}

function extractTurnUsage(value: unknown): TurnUsage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  if (obj.type !== "turn.completed") return null;

  const usage = obj.usage;
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) return null;
  const usageObj = usage as Record<string, unknown>;

  const inputTokens = typeof usageObj.input_tokens === "number" ? usageObj.input_tokens : null;
  const outputTokens = typeof usageObj.output_tokens === "number" ? usageObj.output_tokens : null;
  if (inputTokens == null || outputTokens == null) return null;

  return { inputTokens, outputTokens };
}

function formatTokenCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function inferModelType(modelName: string): string {
  const lower = modelName.toLowerCase();
  if (lower.includes("codex")) return "coding";
  if (lower.includes("mini")) return "compact";
  if (lower.includes("gpt")) return "general";
  return "unknown";
}

function inferContextWindow(modelName: string): number | null {
  const hint = modelName.match(/(\d+)\s*k/i);
  if (!hint) return null;
  const value = Number.parseInt(hint[1], 10);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value * 1000;
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
    const item = obj.item;
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const eventItem = item as Record<string, unknown>;
    if (eventItem.type !== "agent_message") continue;
    const text = typeof eventItem.text === "string" ? eventItem.text.trim() : "";
    if (text) lastMessage = text;
  }

  return lastMessage;
}

function buildFinalSummary(run: RunEntry): string {
  if (run.stopped) {
    return "Stopped. What should I do instead?";
  }

  const lastAgentMessage = extractLastAgentMessage(run.output.parsedJson);
  if (lastAgentMessage) return lastAgentMessage;

  if ((run.output.exitCode ?? 1) === 0) {
    return `You asked me to ${summarizePrompt(run.prompt)}, and I finished it.`;
  }
  return `You asked me to ${summarizePrompt(run.prompt)}, but the run ended with exit code ${run.output.exitCode ?? "N/A"}.`;
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

  // Parse structured JSON events from codex stdout
  const value = event.parsedJson;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const type = typeof obj.type === "string" ? obj.type : "";
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
        const text = typeof item.text === "string" ? item.text.trim() : "";
        return { category: "message", text: text || "Thinking..." };
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

function renderStreamRow(row: StreamRow) {
  if (row.hidden) return null;

  switch (row.category) {
    case "message":
      return (
        <div key={row.id} className="chat-row chat-row-agent">
          <div className="ev-message">{row.text}</div>
        </div>
      );
    case "command":
      return (
        <div key={row.id} className="ev-command">
          <span className="ev-command-prefix">$</span>
          <span className="ev-command-text">{row.command}</span>
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
          <span className="ev-file-paths">{row.text}</span>
        </div>
      );
    case "status":
      return (
        <div key={row.id} className="ev-status">{row.text}</div>
      );
    case "error":
      return (
        <div key={row.id} className="ev-error">{row.text}</div>
      );
    default:
      return null;
  }
}

function renderPersistedRun(run: PersistedRun, debugMode: boolean) {
  return (
    <div key={`persisted-${run.id}`} className="output-section">
      <div className="chat-thread">
        <div className="chat-row chat-row-user">
          <div className="chat-bubble chat-bubble-user">{run.prompt}</div>
        </div>

        {run.streamRows.length > 0 && (
          <div className="stream-events">
            {run.streamRows.filter((r) => !r.hidden).map(renderStreamRow)}
          </div>
        )}

        <div className="chat-row chat-row-agent chat-row-final">
          <div className="ev-message ev-message-final">{run.finalSummary}</div>
        </div>
      </div>

      <div className="run-footer">
        {debugMode && <div>Run #{run.id}</div>}
        <div>{run.stopped ? `Stopped after ${(run.durationMs / 1000).toFixed(1)}s` : `Finished in ${(run.durationMs / 1000).toFixed(1)}s`}</div>
        {debugMode && <div>Exit code: {run.exitCode ?? "N/A"}</div>}
      </div>
    </div>
  );
}

function buildTodoPrompt(userPrompt: string, todos: TodoItem[]): string {
  if (todos.length === 0) return userPrompt;

  const todoLines = todos.map((t, i) =>
    `${i + 1}. [${t.done ? "x" : " "}] ${t.text}`
  ).join("\n");

  return `## Active Todo List

${todoLines}

## Instructions

You have a todo list above. As you work, if you complete or make progress on any item, include a line at the END of your final message in this exact format:

DONE: <number>
(where <number> is the item number you completed, e.g., "DONE: 3")

You can mark multiple items:
DONE: 1
DONE: 3

Only mark items you actually completed in this run. Do not mark items you didn't work on.

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

function App() {
  const [loading, setLoading] = useState(true);
  const [splashFading, setSplashFading] = useState(false);
  const [approvalPolicy, setApprovalPolicy] = useState("never");
  const [sandboxMode, setSandboxMode] = useState("read-only");
  const [model, setModel] = useState("");
  const [colorMode, setColorMode] = useState<"light" | "dark">("light");
  const [debugMode, setDebugMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [workingDirectory, setWorkingDirectory] = useState("");
  const [skipGitRepoCheck, setSkipGitRepoCheck] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [runs, setRuns] = useState<RunEntry[]>([]);
  const [inFlightRun, setInFlightRun] = useState<InFlightRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUsage, setLastUsage] = useState<TurnUsage | null>(null);

  // Session and panel state
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [todoMode, setTodoMode] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(220);
  const [rightPanelWidth, setRightPanelWidth] = useState(280);
  const [leftCollapsed, setLeftCollapsed] = useState(true);
  const [rightCollapsed, setRightCollapsed] = useState(true);
  const [viewingSessionId, setViewingSessionId] = useState<string | null>(null);

  const streamPanelRef = useRef<HTMLDivElement | null>(null);
  const streamBottomRef = useRef<HTMLDivElement | null>(null);
  const activeRunIdRef = useRef<string | null>(null);
  const streamRowsRef = useRef<StreamRow[]>([]);
  const nextStreamRowIdRef = useRef(1);
  const stoppedRef = useRef(false);
  const runStartTimeRef = useRef<number>(0);
  const sessionStartedAtRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const storeReadyRef = useRef(false);

  const canRun = !running && workingDirectory.length > 0 && prompt.length > 0;
  const displayModel = model.trim() || "default";
  const modelType = inferModelType(displayModel);
  const contextWindow = inferContextWindow(displayModel);
  const remainingContext = contextWindow != null && lastUsage
    ? Math.max(0, contextWindow - lastUsage.inputTokens)
    : null;
  const remainingUsage = contextWindow != null && lastUsage
    ? Math.max(0, contextWindow - (lastUsage.inputTokens + lastUsage.outputTokens))
    : null;

  // Determine if we are viewing a past session
  const isViewingPast = viewingSessionId != null && viewingSessionId !== activeSessionId;
  const viewingSession = isViewingPast
    ? sessions.find((s) => s.id === viewingSessionId) ?? null
    : null;

  // Load persisted session on mount
  useEffect(() => {
    (async () => {
      try {
        const store = await loadStore("session.json");
        const saved = await store.get<{
          approvalPolicy?: string;
          sandboxMode?: string;
          model?: string;
          colorMode?: "light" | "dark";
          debugMode?: boolean;
          workingDirectory?: string;
          skipGitRepoCheck?: boolean;
          sessions?: Session[];
          todoMode?: boolean;
          leftPanelWidth?: number;
          rightPanelWidth?: number;
        }>("session");
        if (saved) {
          if (saved.approvalPolicy) setApprovalPolicy(saved.approvalPolicy);
          if (saved.sandboxMode) setSandboxMode(saved.sandboxMode);
          if (saved.model != null) setModel(saved.model);
          if (saved.colorMode) setColorMode(saved.colorMode);
          if (saved.debugMode != null) setDebugMode(saved.debugMode);
          if (saved.workingDirectory) setWorkingDirectory(saved.workingDirectory);
          if (saved.skipGitRepoCheck != null) setSkipGitRepoCheck(saved.skipGitRepoCheck);
          if (saved.sessions) setSessions(saved.sessions);
          if (saved.todoMode != null) setTodoMode(saved.todoMode);
          if (saved.leftPanelWidth) setLeftPanelWidth(saved.leftPanelWidth);
          if (saved.rightPanelWidth) setRightPanelWidth(saved.rightPanelWidth);
        }
      } catch {
        // First launch or corrupted store — start fresh
      }

      const newSessionId = crypto.randomUUID();
      setActiveSessionId(newSessionId);
      sessionStartedAtRef.current = Date.now();
      storeReadyRef.current = true;
    })();
  }, []);

  // Save session whenever persisted state changes
  const saveSession = useCallback(async () => {
    if (!storeReadyRef.current) return;
    try {
      const store = await loadStore("session.json");
      const currentRunsPersisted: PersistedRun[] = runs.map((r) => ({
        id: r.id,
        prompt: r.prompt,
        streamRows: r.streamRows,
        exitCode: r.output.exitCode,
        durationMs: r.output.durationMs,
        finalSummary: buildFinalSummary(r),
        stopped: r.stopped,
      }));
      const currentSession: Session = {
        id: activeSessionId,
        startedAt: sessionStartedAtRef.current,
        runs: currentRunsPersisted,
        todos,
      };
      const allSessions = [
        ...sessions.filter((s) => s.id !== activeSessionId),
        currentSession,
      ];
      await store.set("session", {
        approvalPolicy,
        sandboxMode,
        model,
        colorMode,
        debugMode,
        workingDirectory,
        skipGitRepoCheck,
        sessions: allSessions,
        todoMode,
        leftPanelWidth,
        rightPanelWidth,
      });
      await store.save();
    } catch {
      // Silently ignore save errors
    }
  }, [approvalPolicy, sandboxMode, model, colorMode, debugMode, workingDirectory, skipGitRepoCheck, sessions, runs, activeSessionId, todos, todoMode, leftPanelWidth, rightPanelWidth]);

  useEffect(() => {
    void saveSession();
  }, [saveSession]);

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    let cancelled = false;

    void listen<CodexStreamEvent>(CODEX_STREAM_EVENT, (event) => {
      const payload = event.payload;
      if (!payload || payload.runId !== activeRunIdRef.current) return;

      const usage = extractTurnUsage(payload.parsedJson);
      if (usage) setLastUsage(usage);

      const classified = classifyEvent(payload);
      if (classified.hidden) return;

      // Merge command completion into existing running row
      const isCommandDone = classified.category === "command" &&
        (classified.status === "done" || classified.status === "failed");

      if (isCommandDone) {
        const updateRow = (r: StreamRow): StreamRow =>
          r.category === "command" && r.command === classified.command && r.status === "running"
            ? { ...r, status: classified.status, exitCode: classified.exitCode }
            : r;

        streamRowsRef.current = streamRowsRef.current.map(updateRow);
        setInFlightRun((prev) => {
          if (!prev || prev.runId !== payload.runId) return prev;
          return { ...prev, streamRows: prev.streamRows.map(updateRow) };
        });
      } else {
        const row: StreamRow = { ...classified, id: nextStreamRowIdRef.current++ };
        streamRowsRef.current = [...streamRowsRef.current, row];
        setInFlightRun((prev) => {
          if (!prev || prev.runId !== payload.runId) return prev;
          return { ...prev, streamRows: [...prev.streamRows, row] };
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
  }, [loading, runs, inFlightRun, running, error]);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setSplashFading(true), 3000);
    const removeTimer = setTimeout(() => setLoading(false), 3600);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - runStartTimeRef.current) / 10) / 100);
    }, 10);
    return () => clearInterval(interval);
  }, [running]);

  useEffect(() => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setColorMode(prefersDark ? "dark" : "light");
  }, []);

  useEffect(() => {
    document.body.classList.toggle("body-dark", colorMode === "dark");
    return () => document.body.classList.remove("body-dark");
  }, [colorMode]);

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

  // Resize handlers
  function handleLeftResize(delta: number) {
    setLeftPanelWidth((prev) => Math.max(180, Math.min(400, prev + delta)));
  }
  function handleRightResize(delta: number) {
    setRightPanelWidth((prev) => Math.max(220, Math.min(500, prev - delta)));
  }
  function handleResizeEnd() {
    // Save triggers via the effect dependency on leftPanelWidth/rightPanelWidth
  }

  // Session selection
  function handleSelectSession(id: string) {
    if (id === activeSessionId) {
      setViewingSessionId(null); // Back to live
    } else {
      setViewingSessionId(id);
    }
  }

  async function handleBrowse() {
    const dir = await open({ directory: true, multiple: false });
    if (dir) setWorkingDirectory(dir as string);
  }

  async function handleRun() {
    const submittedPrompt = prompt;
    const runNumber = runs.length + 1;
    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    setPrompt("");
    setRunning(true);
    setError(null);
    setLastUsage(null);
    activeRunIdRef.current = runId;
    streamRowsRef.current = [];
    nextStreamRowIdRef.current = 1;
    stoppedRef.current = false;
    runStartTimeRef.current = Date.now();
    setElapsed(0);
    setInFlightRun({
      id: runNumber,
      runId,
      prompt: submittedPrompt,
      streamRows: [],
    });

    // Clear viewing past session when starting a new run
    setViewingSessionId(null);

    const effectivePrompt = todoMode && todos.length > 0
      ? buildTodoPrompt(submittedPrompt, todos)
      : submittedPrompt;

    try {
      const out = await runCodexExec({
        runId,
        prompt: effectivePrompt,
        approvalPolicy,
        sandboxMode,
        workingDirectory,
        model: model || undefined,
        skipGitRepoCheck,
      });

      const finalStreamRows = [...streamRowsRef.current];
      const wasStopped = stoppedRef.current;
      setRuns((prev) => [
        ...prev,
        {
          id: runNumber,
          prompt: submittedPrompt,
          output: out,
          streamRows: finalStreamRows,
          stopped: wasStopped,
        },
      ]);

      // Auto-update todos from agent output
      if (todoMode && !wasStopped) {
        const completedIds = parseTodoCompletions(out, todos);
        if (completedIds.length > 0) {
          setTodos((prev) => prev.map((t) =>
            completedIds.includes(t.id)
              ? { ...t, done: true, source: "agent", completedAt: Date.now() }
              : t
          ));
        }
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
      setInFlightRun(null);
      activeRunIdRef.current = null;
      streamRowsRef.current = [];
    }
  }

  async function handleStop() {
    if (!running) return;
    stoppedRef.current = true;
    try {
      await stopCodexExec();
    } catch {
      // Process may have already exited
    }
  }

  function handlePromptKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    if (canRun) {
      void handleRun();
    }
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!running) return;
      if (e.key === "Escape" || (e.ctrlKey && e.key === "c")) {
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
    <div className={`container theme-${colorMode}`}>
      <div
        className={`side-panel-left ${leftCollapsed ? "is-collapsed" : ""}`}
        style={leftCollapsed ? undefined : { width: leftPanelWidth }}
        onClick={() => leftCollapsed && setLeftCollapsed(false)}
      >
        <div className="side-panel-spacer" />
        <div className="side-panel-content">
          <SessionPanel
            sessions={sessions}
            activeSessionId={viewingSessionId ?? activeSessionId}
            collapsed={leftCollapsed}
            onSelectSession={handleSelectSession}
            onCollapse={() => setLeftCollapsed(true)}
          />
        </div>
      </div>
      {!leftCollapsed && (
        <ResizeHandle side="left" onResize={handleLeftResize} onResizeEnd={handleResizeEnd} />
      )}

      <div className="main-column">
        <div className="app-header">
          <h1>busydev</h1>
          <div className="header-controls">
            <button
              type="button"
              className={`todo-toggle ${todoMode ? "is-active" : ""}`}
              onClick={() => {
                setTodoMode((prev) => !prev);
                setRightCollapsed((prev) => !prev);
              }}
              title={todoMode ? "Hide todos" : "Show todos"}
            >
              <ChecklistIcon />
            </button>
            <button
              type="button"
              className="todo-toggle"
              onClick={() => setSettingsOpen(true)}
              title="Open settings"
              aria-label="Open settings"
            >
              <GearIcon />
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

        <div className="directory-bar">
          <button
            type="button"
            className="icon-button"
            onClick={handleBrowse}
            title="Browse working directory"
            aria-label="Browse working directory"
          >
            <FolderIcon />
          </button>
          <div className="directory-path">{workingDirectory || "No working directory selected"}</div>
        </div>

        <div className="stream-panel" ref={streamPanelRef}>
          {error && (
            <div className="output-section">
              <h2>Error</h2>
              <pre className="stderr">{error}</pre>
            </div>
          )}

          {viewingSession ? (
            <>
              {viewingSession.runs.length === 0 && (
                <div className="empty-stream">This session has no runs.</div>
              )}
              {viewingSession.runs.map((run) => renderPersistedRun(run, debugMode))}
            </>
          ) : (
            <>
              {runs.length === 0 && !inFlightRun && (
                <div className="empty-stream">Run results will appear here as a single scrollable thread.</div>
              )}

              {runs.map((run) => {
                const finalSummary = buildFinalSummary(run);
                return (
                  <div key={run.id} className="output-section">
                    <div className="chat-thread">
                      <div className="chat-row chat-row-user">
                        <div className="chat-bubble chat-bubble-user">{run.prompt}</div>
                      </div>

                      {run.streamRows.length > 0 && (
                        <div className="stream-events">
                          {run.streamRows.filter((r) => !r.hidden).map(renderStreamRow)}
                        </div>
                      )}

                      <div className="chat-row chat-row-agent chat-row-final">
                        <div className="ev-message ev-message-final">{finalSummary}</div>
                      </div>
                    </div>

                    <div className="run-footer">
                      {debugMode && <div>Run #{run.id}</div>}
                      <div>{run.stopped ? `Stopped after ${(run.output.durationMs / 1000).toFixed(1)}s` : `Finished in ${(run.output.durationMs / 1000).toFixed(1)}s`}</div>
                      {debugMode && <div>Exit code: {run.output.exitCode ?? "N/A"}</div>}
                    </div>

                    {debugMode && (
                      <details className="raw-details">
                        <summary>Show raw output</summary>
                        {run.output.stdoutRaw && (
                          <pre className="stdout">{run.output.stdoutRaw}</pre>
                        )}
                        {run.output.stderrRaw && (
                          <pre className="stderr">{run.output.stderrRaw}</pre>
                        )}
                        {run.output.parsedJson != null && (
                          <pre className="json">{JSON.stringify(run.output.parsedJson, null, 2)}</pre>
                        )}
                      </details>
                    )}
                  </div>
                );
              })}

              {inFlightRun && (
                <div className="output-section output-section-live">
                  <div className="chat-thread">
                    <div className="chat-row chat-row-user">
                      <div className="chat-bubble chat-bubble-user">{inFlightRun.prompt}</div>
                    </div>
                    <div className="stream-events">
                      {inFlightRun.streamRows.filter((r) => !r.hidden).map(renderStreamRow)}
                      {inFlightRun.streamRows.filter((r) => !r.hidden).length === 0 && (
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
                        {inFlightRun.streamRows.map((row) => `${row.category}: ${row.text}`).join("\n") || "(no events yet)"}
                      </pre>
                    </details>
                  )}
                  <div className="run-footer">
                    {debugMode && <div>Run #{inFlightRun.id}</div>}
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
            </>
          )}
          <div ref={streamBottomRef} />
        </div>

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
              <span className="meta-label">Approval Policy: {approvalPolicy}</span>
              <span className="meta-label">Agent: Codex</span>
              <span className="meta-label">Model: {displayModel}</span>
              <span className="meta-label">Type: {modelType}</span>
              <span className="meta-label">
                Remaining Context: {remainingContext != null ? formatTokenCount(remainingContext) : "N/A"}
              </span>
              <span className="meta-label">
                Remaining Usage: {remainingUsage != null ? formatTokenCount(remainingUsage) : "N/A"}
              </span>
              {todoMode && todos.length > 0 && (
                <span className="meta-label">Todos: {todos.filter((t) => !t.done).length} remaining</span>
              )}
            </div>
            <div className="prompt-actions">
              {running ? (
                <button
                  type="button"
                  onClick={handleStop}
                  className="prompt-action prompt-action-stop"
                  title="Stop (Esc)"
                  aria-label="Stop"
                >
                  <StopIcon />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleRun}
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

      {!rightCollapsed && (
        <ResizeHandle side="right" onResize={handleRightResize} onResizeEnd={handleResizeEnd} />
      )}
      <div
        className={`side-panel-right ${rightCollapsed ? "is-collapsed" : ""}`}
        style={rightCollapsed ? undefined : { width: rightPanelWidth }}
        onClick={() => rightCollapsed && setRightCollapsed(false)}
      >
        <div className="side-panel-spacer" />
        <div className="side-panel-content">
          <TodoPanel
            todos={viewingSession ? viewingSession.todos : todos}
            collapsed={rightCollapsed}
            readonly={isViewingPast}
            onAdd={handleAddTodo}
            onToggle={handleToggleTodo}
            onDelete={handleDeleteTodo}
            onEdit={handleEditTodo}
            onCollapse={() => {
              setRightCollapsed(true);
              setTodoMode(false);
            }}
          />
        </div>
      </div>

      {settingsOpen && (
        <div className="settings-overlay" onClick={() => setSettingsOpen(false)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-header">
              <h2>Settings</h2>
              <button type="button" className="settings-close" onClick={() => setSettingsOpen(false)}>✕</button>
            </div>
            <div className="settings-grid">
              <label>
                Approval Policy
                <select value={approvalPolicy} onChange={(e) => setApprovalPolicy(e.target.value)}>
                  <option value="never">never</option>
                  <option value="unless-allow-listed">unless-allow-listed</option>
                  <option value="full-auto">full-auto</option>
                </select>
              </label>
              <label>
                Sandbox Mode
                <select value={sandboxMode} onChange={(e) => setSandboxMode(e.target.value)}>
                  <option value="read-only">read-only</option>
                  <option value="workspace-write">workspace-write</option>
                  <option value="danger-full-access">danger-full-access</option>
                </select>
              </label>
              <label>
                Model
                <input type="text" value={model} onChange={(e) => setModel(e.target.value)} placeholder="(default)" />
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={skipGitRepoCheck}
                  onChange={(e) => setSkipGitRepoCheck(e.target.checked)}
                />
                Skip git repo check
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={debugMode}
                  onChange={(e) => setDebugMode(e.target.checked)}
                />
                Debug mode
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
