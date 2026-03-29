import type { PersistedRun, Project } from "../types";

// ── Types ──────────────────────────────────────────────────────────────

export type AnalyticsScope =
  | { level: "overall" }
  | { level: "project"; projectId: string }
  | { level: "session"; projectId: string; sessionId: string };

export interface DailyBucket {
  date: string;
  count: number;
  successCount: number;
  failedCount: number;
}

export interface DailyDuration {
  date: string;
  totalMs: number;
  avgMs: number;
}

export interface AgentBreakdownEntry {
  agent: string;
  count: number;
  percentage: number;
}

export interface AnalyticsData {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  stoppedRuns: number;
  successRate: number;
  totalDurationMs: number;
  avgDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  runsByAgent: Record<string, number>;
  durationByAgent: Record<string, number>;
  dailyRuns: DailyBucket[];
  dailyDuration: DailyDuration[];
  agentBreakdown: AgentBreakdownEntry[];
  projectCount?: number;
  sessionCount?: number;
}

// ── Classification helpers ─────────────────────────────────────────────

export function isSuccess(run: PersistedRun): boolean {
  return run.exitCode === 0 && !run.stopped;
}

export function isFailed(run: PersistedRun): boolean {
  return run.exitCode !== null && run.exitCode !== 0 && !run.stopped;
}

export function isStopped(run: PersistedRun): boolean {
  return run.stopped === true;
}

// ── Scope filtering ────────────────────────────────────────────────────

export function filterRunsByScope(projects: Project[], scope: AnalyticsScope): PersistedRun[] {
  switch (scope.level) {
    case "overall":
      return projects.flatMap((p) => p.sessions.flatMap((s) => s.runs));
    case "project": {
      const project = projects.find((p) => p.id === scope.projectId);
      return project ? project.sessions.flatMap((s) => s.runs) : [];
    }
    case "session": {
      const proj = projects.find((p) => p.id === scope.projectId);
      if (!proj) return [];
      const session = proj.sessions.find((s) => s.id === scope.sessionId);
      return session ? session.runs : [];
    }
  }
}

// ── Daily bucketing ────────────────────────────────────────────────────

function toDateKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function bucketByDay(runs: PersistedRun[]): DailyBucket[] {
  const map = new Map<string, { count: number; successCount: number; failedCount: number }>();

  for (const run of runs) {
    if (run.completedAt == null) continue;
    const key = toDateKey(run.completedAt);
    const entry = map.get(key) ?? { count: 0, successCount: 0, failedCount: 0 };
    entry.count++;
    if (isSuccess(run)) entry.successCount++;
    if (isFailed(run)) entry.failedCount++;
    map.set(key, entry);
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({ date, ...data }));
}

export function bucketDurationByDay(runs: PersistedRun[]): DailyDuration[] {
  const map = new Map<string, { totalMs: number; count: number }>();

  for (const run of runs) {
    if (run.completedAt == null) continue;
    const key = toDateKey(run.completedAt);
    const entry = map.get(key) ?? { totalMs: 0, count: 0 };
    entry.totalMs += run.durationMs;
    entry.count++;
    map.set(key, entry);
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { totalMs, count }]) => ({ date, totalMs, avgMs: Math.round(totalMs / count) }));
}

// ── Agent breakdown ────────────────────────────────────────────────────

export function computeAgentBreakdown(runs: PersistedRun[]): AgentBreakdownEntry[] {
  if (runs.length === 0) return [];

  const counts = new Map<string, number>();
  for (const run of runs) {
    const agent = run.agent ?? "unknown";
    counts.set(agent, (counts.get(agent) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([agent, count]) => ({
      agent,
      count,
      percentage: Math.round((count / runs.length) * 10000) / 100,
    }));
}

// ── Duration formatting ────────────────────────────────────────────────

export function formatDuration(ms: number): string {
  if (ms === 0) return "0s";
  if (ms < 1000) return "<1s";

  const totalSeconds = Math.floor(ms / 1000);

  if (totalSeconds < 60) return `${totalSeconds}s`;

  const totalMinutes = Math.floor(totalSeconds / 60);

  if (totalMinutes < 60) {
    const secs = totalSeconds % 60;
    return `${totalMinutes}m ${secs}s`;
  }

  const hours = ms / 3_600_000;
  return `${Math.round(hours * 10) / 10}h`;
}

// ── Main aggregation ───────────────────────────────────────────────────

export function computeAnalytics(projects: Project[], scope: AnalyticsScope): AnalyticsData {
  const runs = filterRunsByScope(projects, scope);

  const totalRuns = runs.length;
  const successfulRuns = runs.filter(isSuccess).length;
  const failedRuns = runs.filter(isFailed).length;
  const stoppedRuns = runs.filter(isStopped).length;
  const successRate = totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 10000) / 100 : 0;

  const durations = runs.map((r) => r.durationMs);
  const totalDurationMs = durations.reduce((a, b) => a + b, 0);
  const avgDurationMs = totalRuns > 0 ? Math.round(totalDurationMs / totalRuns) : 0;
  const minDurationMs = totalRuns > 0 ? Math.min(...durations) : 0;
  const maxDurationMs = totalRuns > 0 ? Math.max(...durations) : 0;

  const runsByAgent: Record<string, number> = {};
  const durationByAgent: Record<string, number> = {};
  for (const run of runs) {
    const agent = run.agent ?? "unknown";
    runsByAgent[agent] = (runsByAgent[agent] ?? 0) + 1;
    durationByAgent[agent] = (durationByAgent[agent] ?? 0) + run.durationMs;
  }

  const dailyRuns = bucketByDay(runs);
  const dailyDuration = bucketDurationByDay(runs);
  const agentBreakdown = computeAgentBreakdown(runs);

  const result: AnalyticsData = {
    totalRuns,
    successfulRuns,
    failedRuns,
    stoppedRuns,
    successRate,
    totalDurationMs,
    avgDurationMs,
    minDurationMs,
    maxDurationMs,
    runsByAgent,
    durationByAgent,
    dailyRuns,
    dailyDuration,
    agentBreakdown,
  };

  if (scope.level === "overall") {
    result.projectCount = projects.length;
    result.sessionCount = projects.reduce((sum, p) => sum + p.sessions.length, 0);
  }

  return result;
}
