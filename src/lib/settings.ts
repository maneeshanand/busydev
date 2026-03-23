import type { PersistedRun, Project, Session, TodoItem } from "../types";

export const SETTINGS_VERSION = 1;

export interface StoredSettings {
  settingsVersion: number;
  colorMode: "light" | "dark";
  debugMode: boolean;
  projects: Project[];
  activeProjectId: string | null;
  skipGitRepoCheck: boolean;
  todoMode: boolean;
  rightPanelWidth: number;
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
  debugMode?: boolean;
  workingDirectory?: string;
  projects?: Project[];
  activeProjectId?: string;
  skipGitRepoCheck?: boolean;
  persistedRuns?: PersistedRun[];
  todos?: TodoItem[];
  todoMode?: boolean;
  rightPanelWidth?: number;
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

function toNumberInRange(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function sanitizeAgent(value: unknown): "codex" | "claude" {
  return value === "claude" ? "claude" : "codex";
}

function sanitizeApprovalPolicy(value: unknown): "full-auto" | "unless-allow-listed" | "never" {
  if (value === "unless-allow-listed" || value === "never") return value;
  return "full-auto";
}

function sanitizeSandbox(value: unknown): "read-only" | "workspace-write" | "danger-full-access" {
  if (value === "workspace-write" || value === "danger-full-access") return value;
  return "read-only";
}

function sanitizeModel(agent: "codex" | "claude", value: unknown): string {
  const str = typeof value === "string" ? value : "";
  const claudeModels = new Set(["", "claude-opus-4-6", "claude-haiku-4-5"]);
  const codexModels = new Set(["", "o3", "o4-mini"]);
  return agent === "claude"
    ? (claudeModels.has(str) ? str : "")
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
    debugMode: toBoolean(legacy.debugMode, false),
    projects,
    activeProjectId,
    skipGitRepoCheck: toBoolean(legacy.skipGitRepoCheck, true),
    todoMode: toBoolean(legacy.todoMode, false),
    rightPanelWidth: toNumberInRange(legacy.rightPanelWidth, 220, 500, 280),
    windowWidth: typeof legacy.windowWidth === "number" ? legacy.windowWidth : undefined,
    windowHeight: typeof legacy.windowHeight === "number" ? legacy.windowHeight : undefined,
  };
}

