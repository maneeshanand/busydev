import type { BusyAgent, LlmProvider, PersistedRun, Project, SavedPromptEntry, Session, SubTask, TodoItem } from "../types";

export const SETTINGS_VERSION = 3;

export interface StoredSettings {
  settingsVersion: number;
  colorMode: "light" | "dark";
  uiDensity: "comfortable" | "compact";
  splashEnabled: boolean;
  splashDurationMs: number;
  debugMode: boolean;
  projects: Project[];
  activeProjectId: string | null;
  skipGitRepoCheck: boolean;
  todoMode: boolean;
  todoAutoPlayDefault: boolean;
  todoMaxRetries: number;
  rightPanelWidth: number;
  includeSessionHistoryInPrompt: boolean;
  claudeAutoContinue: boolean;
  terminalFontSize: number;
  terminalLineHeight: number;
  promptLibrary: SavedPromptEntry[];
  busyAgents: BusyAgent[];
  providers: LlmProvider[];
  windowWidth?: number;
  windowHeight?: number;
}

type LegacyStoredSettings = {
  settingsVersion?: number;
  agent?: string;
  approvalPolicy?: string;
  sandboxMode?: string;
  model?: string;
  colorMode?: "light" | "dark";
  uiDensity?: "comfortable" | "compact";
  splashEnabled?: boolean;
  splashDurationMs?: number;
  debugMode?: boolean;
  workingDirectory?: string;
  projects?: Project[];
  activeProjectId?: string;
  skipGitRepoCheck?: boolean;
  persistedRuns?: PersistedRun[];
  todos?: TodoItem[];
  todoMode?: boolean;
  todoAutoPlayDefault?: boolean;
  todoMaxRetries?: number;
  rightPanelWidth?: number;
  includeSessionHistoryInPrompt?: boolean;
  claudeAutoContinue?: boolean;
  terminalFontSize?: number;
  terminalLineHeight?: number;
  promptLibrary?: SavedPromptEntry[];
  busyAgents?: BusyAgent[];
  windowWidth?: number;
  windowHeight?: number;
};

function makeId() {
  return crypto.randomUUID();
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toColorMode(value: unknown, fallback: "light" | "dark" = "light"): "light" | "dark" {
  return value === "light" || value === "dark" ? value : fallback;
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function toUiDensity(value: unknown, fallback: "comfortable" | "compact" = "comfortable"): "comfortable" | "compact" {
  return value === "compact" || value === "comfortable" ? value : fallback;
}

function toNumberInRange(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function sanitizeAgent(value: unknown): "codex" | "claude" | "deepseek" {
  if (value === "claude" || value === "deepseek") return value;
  return "codex";
}

function sanitizeApprovalPolicy(value: unknown): "full-auto" | "unless-allow-listed" | "never" {
  if (value === "unless-allow-listed" || value === "never") return value;
  return "full-auto";
}

function sanitizeSandbox(value: unknown): "read-only" | "workspace-write" | "danger-full-access" {
  if (value === "workspace-write" || value === "danger-full-access") return value;
  return "read-only";
}

function sanitizeModel(agent: "codex" | "claude" | "deepseek", value: unknown): string {
  const str = typeof value === "string" ? value : "";
  const claudeModels = new Set(["", "claude-opus-4-6", "claude-haiku-4-5"]);
  const codexModels = new Set(["", "o3", "o4-mini"]);
  const deepseekModels = new Set(["", "deepseek-chat", "deepseek-reasoner"]);
  return agent === "claude"
    ? (claudeModels.has(str) ? str : "")
    : agent === "deepseek"
      ? (deepseekModels.has(str) ? str : "")
      : (codexModels.has(str) ? str : "");
}

function sanitizePersistedRun(value: unknown): PersistedRun | null {
  const obj = asObject(value);
  if (!obj) return null;
  const id = typeof obj.id === "number" ? obj.id : null;
  const prompt = typeof obj.prompt === "string" ? obj.prompt : null;
  const streamRows = Array.isArray(obj.streamRows) ? obj.streamRows : null;
  const exitCode = typeof obj.exitCode === "number" || obj.exitCode === null ? obj.exitCode : null;
  const durationMs = typeof obj.durationMs === "number" ? obj.durationMs : null;
  const finalSummary = typeof obj.finalSummary === "string" ? obj.finalSummary : null;
  if (id === null || prompt === null || streamRows === null || durationMs === null || finalSummary === null) return null;

  return {
    id,
    prompt,
    streamRows: streamRows as PersistedRun["streamRows"],
    exitCode,
    durationMs,
    finalSummary,
    stopped: toBoolean(obj.stopped, false) || undefined,
    completedAt: typeof obj.completedAt === "number" ? obj.completedAt : undefined,
    agent: typeof obj.agent === "string" ? sanitizeAgent(obj.agent) : undefined,
  };
}

function sanitizeTodoItem(value: unknown): TodoItem | null {
  const obj = asObject(value);
  if (!obj) return null;
  const text = typeof obj.text === "string" ? obj.text.trim() : "";
  if (!text) return null;
  return {
    id: typeof obj.id === "string" ? obj.id : makeId(),
    text,
    done: toBoolean(obj.done, false),
    source: obj.source === "agent" ? "agent" : "user",
    createdAt: typeof obj.createdAt === "number" ? obj.createdAt : Date.now(),
    completedAt: typeof obj.completedAt === "number" ? obj.completedAt : undefined,
    notes: typeof obj.notes === "string" ? obj.notes : undefined,
    agent: typeof obj.agent === "string" && obj.agent.trim() ? obj.agent.trim() : undefined,
    model: typeof obj.model === "string" && obj.model.trim() ? obj.model.trim() : undefined,
    subtasks: Array.isArray(obj.subtasks)
      ? (obj.subtasks as unknown[])
          .map((st) => {
            const s = typeof st === "object" && st !== null ? st as Record<string, unknown> : null;
            if (!s) return null;
            const text = typeof s.text === "string" ? (s.text as string).trim() : "";
            if (!text) return null;
            return {
              id: typeof s.id === "string" ? s.id : crypto.randomUUID(),
              text,
              done: typeof s.done === "boolean" ? s.done : false,
            };
          })
          .filter(Boolean) as SubTask[]
      : undefined,
    busyAgentId: typeof obj.busyAgentId === "string" && obj.busyAgentId.trim() ? obj.busyAgentId.trim() : undefined,
  };
}

function sanitizeSavedPromptEntry(value: unknown): SavedPromptEntry | null {
  const obj = asObject(value);
  if (!obj) return null;
  const name = typeof obj.name === "string" ? obj.name.trim() : "";
  const content = typeof obj.content === "string" ? obj.content.trim() : "";
  if (!name || !content) return null;
  const normalizeAlias = (raw: string) =>
    raw
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  const explicitAlias = typeof obj.alias === "string" ? obj.alias : "";
  const alias = normalizeAlias(explicitAlias || name);
  if (!alias) return null;
  const now = Date.now();
  return {
    id: typeof obj.id === "string" ? obj.id : makeId(),
    name,
    alias,
    kind: obj.kind === "function" ? "function" : "prompt",
    content,
    createdAt: typeof obj.createdAt === "number" ? obj.createdAt : now,
    updatedAt: typeof obj.updatedAt === "number" ? obj.updatedAt : now,
  };
}

function sanitizeBusyAgent(value: unknown): BusyAgent | null {
  const obj = asObject(value);
  if (!obj) return null;
  const name = typeof obj.name === "string" ? obj.name.trim() : "";
  if (!name) return null;
  const base = obj.base === "claude" ? "claude" as const : "codex" as const;
  const validExecModes = ["safe", "balanced", "full-auto"] as const;
  const execMode = validExecModes.includes(obj.executionMode as any)
    ? (obj.executionMode as "safe" | "balanced" | "full-auto")
    : "full-auto" as const;
  const policyMap: Record<string, string> = { safe: "never", balanced: "unless-allow-listed", "full-auto": "full-auto" };
  const sandboxMap: Record<string, string> = { safe: "read-only", balanced: "workspace-write", "full-auto": "danger-full-access" };
  const now = Date.now();
  return {
    id: typeof obj.id === "string" ? obj.id : crypto.randomUUID(),
    name,
    role: typeof obj.role === "string" ? obj.role.trim() : "",
    icon: typeof obj.icon === "string" && obj.icon.trim() ? obj.icon.trim() : "🤖",
    base,
    model: typeof obj.model === "string" ? obj.model.trim() : "",
    executionMode: execMode,
    approvalPolicy: typeof obj.approvalPolicy === "string" ? obj.approvalPolicy : policyMap[execMode],
    sandboxMode: typeof obj.sandboxMode === "string" ? obj.sandboxMode : sandboxMap[execMode],
    systemPrompt: typeof obj.systemPrompt === "string" ? obj.systemPrompt : "",
    isPreset: typeof obj.isPreset === "boolean" ? obj.isPreset : false,
    createdAt: typeof obj.createdAt === "number" ? obj.createdAt : now,
    updatedAt: typeof obj.updatedAt === "number" ? obj.updatedAt : now,
  };
}

function sanitizeSession(value: unknown, projectId: string, index: number): Session {
  const obj = asObject(value);
  const createdAt = typeof obj?.createdAt === "number" ? obj.createdAt : Date.now();
  const agent = sanitizeAgent(obj?.agent);
  return {
    id: typeof obj?.id === "string" ? obj.id : makeId(),
    projectId,
    name: typeof obj?.name === "string" && obj.name.trim() ? obj.name.trim() : `Session ${index + 1}`,
    createdAt,
    runs: Array.isArray(obj?.runs) ? obj.runs.map(sanitizePersistedRun).filter(Boolean) as PersistedRun[] : [],
    todos: Array.isArray(obj?.todos) ? obj.todos.map(sanitizeTodoItem).filter(Boolean) as TodoItem[] : [],
    agent,
    model: sanitizeModel(agent, obj?.model),
    approvalPolicy: sanitizeApprovalPolicy(obj?.approvalPolicy),
    sandboxMode: sanitizeSandbox(obj?.sandboxMode),
    worktreePath: typeof obj?.worktreePath === "string" ? obj.worktreePath : undefined,
    worktreeBranch: typeof obj?.worktreeBranch === "string" ? obj.worktreeBranch : undefined,
    todoMode: typeof obj?.todoMode === "boolean" ? obj.todoMode : undefined,
    autoPlay: typeof obj?.autoPlay === "boolean" ? obj.autoPlay : undefined,
    busyAgentId: typeof obj?.busyAgentId === "string" && obj.busyAgentId.trim() ? obj.busyAgentId.trim() : undefined,
  };
}

function buildSessionFromLegacy(
  projectId: string,
  legacy: LegacyStoredSettings,
  createdAt = Date.now(),
): Session {
  const agent = sanitizeAgent(legacy.agent);
  return {
    id: makeId(),
    projectId,
    name: "Session 1",
    createdAt,
    runs: (Array.isArray(legacy.persistedRuns) ? legacy.persistedRuns : [])
      .map(sanitizePersistedRun)
      .filter(Boolean) as PersistedRun[],
    todos: (Array.isArray(legacy.todos) ? legacy.todos : [])
      .map(sanitizeTodoItem)
      .filter(Boolean) as TodoItem[],
    agent,
    model: sanitizeModel(agent, legacy.model),
    approvalPolicy: sanitizeApprovalPolicy(legacy.approvalPolicy),
    sandboxMode: sanitizeSandbox(legacy.sandboxMode),
  };
}

function sanitizeProjects(legacy: LegacyStoredSettings): Project[] {
  if (Array.isArray(legacy.projects) && legacy.projects.length > 0) {
    return legacy.projects
      .map((projectValue): Project | null => {
        const p = asObject(projectValue);
        if (!p) return null;
        const id = typeof p.id === "string" ? p.id : makeId();
        const path = typeof p.path === "string" ? p.path : "";
        if (!path) return null;
        const createdAt = typeof p.createdAt === "number" ? p.createdAt : Date.now();
        const name = typeof p.name === "string" && p.name.trim() ? p.name.trim() : (path.split("/").pop() || "project");
        const sessionsRaw = Array.isArray(p.sessions) ? p.sessions : [];
        const sessions = sessionsRaw.length > 0
          ? sessionsRaw.map((s, idx) => sanitizeSession(s, id, idx))
          : [buildSessionFromLegacy(id, legacy, createdAt)];
        const activeSessionIdCandidate = typeof p.activeSessionId === "string" ? p.activeSessionId : sessions[0].id;
        const activeSessionId = sessions.some((s) => s.id === activeSessionIdCandidate)
          ? activeSessionIdCandidate
          : sessions[0].id;
        return { id, name, path, createdAt, sessions, activeSessionId };
      })
      .filter(Boolean) as Project[];
  }

  if (legacy.workingDirectory) {
    const id = makeId();
    const createdAt = Date.now();
    const firstSession = buildSessionFromLegacy(id, legacy, createdAt);
    return [{
      id,
      name: legacy.workingDirectory.split("/").pop() || "project",
      path: legacy.workingDirectory,
      createdAt,
      sessions: [firstSession],
      activeSessionId: firstSession.id,
    }];
  }

  return [];
}

export function migrateStoredSettings(saved: unknown): StoredSettings | null {
  const legacy = asObject(saved) as LegacyStoredSettings | null;
  if (!legacy) return null;

  const projects = sanitizeProjects(legacy);
  const activeProjectId = typeof legacy.activeProjectId === "string" && projects.some((p) => p.id === legacy.activeProjectId)
    ? legacy.activeProjectId
    : (projects[0]?.id ?? null);

  return {
    settingsVersion: SETTINGS_VERSION,
    colorMode: toColorMode(legacy.colorMode),
    uiDensity: toUiDensity(legacy.uiDensity),
    splashEnabled: toBoolean(legacy.splashEnabled, true),
    splashDurationMs: toNumberInRange(legacy.splashDurationMs, 0, 10000, 3000),
    debugMode: toBoolean(legacy.debugMode, false),
    projects,
    activeProjectId,
    skipGitRepoCheck: toBoolean(legacy.skipGitRepoCheck, true),
    todoMode: toBoolean(legacy.todoMode, false),
    todoAutoPlayDefault: toBoolean(legacy.todoAutoPlayDefault, false),
    todoMaxRetries: toNumberInRange(legacy.todoMaxRetries, 1, 10, 3),
    rightPanelWidth: toNumberInRange(legacy.rightPanelWidth, 220, 500, 280),
    includeSessionHistoryInPrompt: toBoolean(legacy.includeSessionHistoryInPrompt, true),
    claudeAutoContinue: toBoolean(legacy.claudeAutoContinue, true),
    terminalFontSize: toNumberInRange(legacy.terminalFontSize, 10, 24, 13),
    terminalLineHeight: toNumberInRange(legacy.terminalLineHeight, 1, 2, 1.3),
    promptLibrary: (Array.isArray(legacy.promptLibrary) ? legacy.promptLibrary : [])
      .map(sanitizeSavedPromptEntry)
      .filter(Boolean) as SavedPromptEntry[],
    busyAgents: (Array.isArray(legacy.busyAgents) ? legacy.busyAgents : [])
      .map(sanitizeBusyAgent)
      .filter(Boolean) as BusyAgent[],
    providers: Array.isArray(legacy.providers) ? legacy.providers : [],
    windowWidth: typeof legacy.windowWidth === "number" ? legacy.windowWidth : undefined,
    windowHeight: typeof legacy.windowHeight === "number" ? legacy.windowHeight : undefined,
  };
}
