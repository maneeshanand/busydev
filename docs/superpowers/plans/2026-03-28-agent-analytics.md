# Agent Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an analytics view showing agent run metrics (counts, success rates, durations, agent breakdown) with time-series charts, scoped by session/project/overall.

**Architecture:** Pure derived computation from existing `Project -> Session -> PersistedRun` data. A `useAnalytics` hook aggregates runs into metrics via `useMemo`. A new `AnalyticsView` component takes over the main content area (stream panel + todo panel) when toggled from the left rail. Charts use recharts.

**Tech Stack:** React, TypeScript, recharts, @carbon/icons-react, vitest

---

### Task 1: Install recharts dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install recharts**

Run: `npm install recharts`

- [ ] **Step 2: Verify install**

Run: `npm ls recharts`
Expected: `recharts@2.x.x`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add recharts dependency for analytics charts"
```

---

### Task 2: Analytics utility functions

**Files:**
- Create: `src/lib/analyticsUtils.ts`
- Create: `src/lib/analyticsUtils.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/analyticsUtils.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import type { PersistedRun, Project } from "../types";
import {
  isSuccess,
  isFailed,
  isStopped,
  filterRunsByScope,
  bucketByDay,
  computeAgentBreakdown,
  formatDuration,
} from "./analyticsUtils";

function makeRun(overrides: Partial<PersistedRun> = {}): PersistedRun {
  return {
    id: 1,
    prompt: "test",
    streamRows: [],
    exitCode: 0,
    durationMs: 5000,
    finalSummary: "done",
    completedAt: Date.now(),
    agent: "claude",
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project> & { sessions?: Project["sessions"] } = {}): Project {
  return {
    id: "p1",
    name: "Project 1",
    path: "/tmp/p1",
    createdAt: Date.now(),
    sessions: [],
    activeSessionId: null,
    ...overrides,
  };
}

describe("isSuccess", () => {
  it("returns true for exitCode 0 and not stopped", () => {
    expect(isSuccess(makeRun({ exitCode: 0, stopped: false }))).toBe(true);
  });
  it("returns false for non-zero exit code", () => {
    expect(isSuccess(makeRun({ exitCode: 1 }))).toBe(false);
  });
  it("returns false when stopped", () => {
    expect(isSuccess(makeRun({ exitCode: 0, stopped: true }))).toBe(false);
  });
});

describe("isFailed", () => {
  it("returns true for non-zero exit code and not stopped", () => {
    expect(isFailed(makeRun({ exitCode: 1, stopped: false }))).toBe(true);
  });
  it("returns false for null exit code", () => {
    expect(isFailed(makeRun({ exitCode: null }))).toBe(false);
  });
  it("returns false when stopped", () => {
    expect(isFailed(makeRun({ exitCode: 1, stopped: true }))).toBe(false);
  });
});

describe("isStopped", () => {
  it("returns true when stopped", () => {
    expect(isStopped(makeRun({ stopped: true }))).toBe(true);
  });
  it("returns false when not stopped", () => {
    expect(isStopped(makeRun({ stopped: false }))).toBe(false);
  });
});

describe("filterRunsByScope", () => {
  const projects: Project[] = [
    makeProject({
      id: "p1",
      sessions: [
        { id: "s1", projectId: "p1", name: "S1", createdAt: 0, runs: [makeRun({ id: 1 }), makeRun({ id: 2 })], todos: [] },
        { id: "s2", projectId: "p1", name: "S2", createdAt: 0, runs: [makeRun({ id: 3 })], todos: [] },
      ],
    }),
    makeProject({
      id: "p2",
      sessions: [
        { id: "s3", projectId: "p2", name: "S3", createdAt: 0, runs: [makeRun({ id: 4 }), makeRun({ id: 5 })], todos: [] },
      ],
    }),
  ];

  it("returns all runs for overall scope", () => {
    const runs = filterRunsByScope(projects, { level: "overall" });
    expect(runs).toHaveLength(5);
  });

  it("returns project runs for project scope", () => {
    const runs = filterRunsByScope(projects, { level: "project", projectId: "p1" });
    expect(runs).toHaveLength(3);
  });

  it("returns session runs for session scope", () => {
    const runs = filterRunsByScope(projects, { level: "session", projectId: "p1", sessionId: "s1" });
    expect(runs).toHaveLength(2);
  });

  it("returns empty array for unknown project", () => {
    const runs = filterRunsByScope(projects, { level: "project", projectId: "nope" });
    expect(runs).toHaveLength(0);
  });
});

describe("bucketByDay", () => {
  it("groups runs by calendar day", () => {
    const day1 = new Date("2026-03-25T10:00:00Z").getTime();
    const day2 = new Date("2026-03-26T14:00:00Z").getTime();
    const runs = [
      makeRun({ completedAt: day1, exitCode: 0 }),
      makeRun({ completedAt: day1, exitCode: 1, stopped: false }),
      makeRun({ completedAt: day2, exitCode: 0 }),
    ];
    const buckets = bucketByDay(runs);
    expect(buckets).toHaveLength(2);
    expect(buckets[0].date).toBe("2026-03-25");
    expect(buckets[0].count).toBe(2);
    expect(buckets[0].successCount).toBe(1);
    expect(buckets[0].failedCount).toBe(1);
    expect(buckets[1].date).toBe("2026-03-26");
    expect(buckets[1].count).toBe(1);
  });

  it("excludes runs without completedAt", () => {
    const runs = [makeRun({ completedAt: undefined })];
    const buckets = bucketByDay(runs);
    expect(buckets).toHaveLength(0);
  });

  it("returns sorted by date ascending", () => {
    const day1 = new Date("2026-03-27").getTime();
    const day2 = new Date("2026-03-25").getTime();
    const runs = [makeRun({ completedAt: day1 }), makeRun({ completedAt: day2 })];
    const buckets = bucketByDay(runs);
    expect(buckets[0].date).toBe("2026-03-25");
    expect(buckets[1].date).toBe("2026-03-27");
  });
});

describe("computeAgentBreakdown", () => {
  it("groups runs by agent with counts and percentages", () => {
    const runs = [
      makeRun({ agent: "claude" }),
      makeRun({ agent: "claude" }),
      makeRun({ agent: "codex" }),
    ];
    const breakdown = computeAgentBreakdown(runs);
    expect(breakdown).toHaveLength(2);
    const claude = breakdown.find((b) => b.agent === "claude")!;
    expect(claude.count).toBe(2);
    expect(claude.percentage).toBeCloseTo(66.67, 0);
    const codex = breakdown.find((b) => b.agent === "codex")!;
    expect(codex.count).toBe(1);
    expect(codex.percentage).toBeCloseTo(33.33, 0);
  });

  it("labels runs without agent as unknown", () => {
    const runs = [makeRun({ agent: undefined })];
    const breakdown = computeAgentBreakdown(runs);
    expect(breakdown[0].agent).toBe("unknown");
  });

  it("sorts by count descending", () => {
    const runs = [
      makeRun({ agent: "codex" }),
      makeRun({ agent: "claude" }),
      makeRun({ agent: "claude" }),
    ];
    const breakdown = computeAgentBreakdown(runs);
    expect(breakdown[0].agent).toBe("claude");
    expect(breakdown[1].agent).toBe("codex");
  });
});

describe("formatDuration", () => {
  it("formats seconds", () => {
    expect(formatDuration(42000)).toBe("42s");
  });
  it("formats minutes and seconds", () => {
    expect(formatDuration(252000)).toBe("4m 12s");
  });
  it("formats hours", () => {
    expect(formatDuration(4320000)).toBe("1.2h");
  });
  it("formats zero", () => {
    expect(formatDuration(0)).toBe("0s");
  });
  it("formats sub-second as <1s", () => {
    expect(formatDuration(500)).toBe("<1s");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/analyticsUtils.test.ts`
Expected: FAIL — module `./analyticsUtils` not found

- [ ] **Step 3: Implement analyticsUtils.ts**

Create `src/lib/analyticsUtils.ts`:

```typescript
import type { PersistedRun, Project } from "../types";

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

export function isSuccess(run: PersistedRun): boolean {
  return run.exitCode === 0 && !run.stopped;
}

export function isFailed(run: PersistedRun): boolean {
  return run.exitCode !== 0 && run.exitCode !== null && !run.stopped;
}

export function isStopped(run: PersistedRun): boolean {
  return run.stopped === true;
}

export function filterRunsByScope(projects: Project[], scope: AnalyticsScope): PersistedRun[] {
  switch (scope.level) {
    case "overall":
      return projects.flatMap((p) => p.sessions.flatMap((s) => s.runs));
    case "project": {
      const project = projects.find((p) => p.id === scope.projectId);
      return project ? project.sessions.flatMap((s) => s.runs) : [];
    }
    case "session": {
      const project = projects.find((p) => p.id === scope.projectId);
      const session = project?.sessions.find((s) => s.id === scope.sessionId);
      return session?.runs ?? [];
    }
  }
}

export function bucketByDay(runs: PersistedRun[]): DailyBucket[] {
  const map = new Map<string, DailyBucket>();
  for (const run of runs) {
    if (!run.completedAt) continue;
    const date = new Date(run.completedAt).toISOString().slice(0, 10);
    const bucket = map.get(date) ?? { date, count: 0, successCount: 0, failedCount: 0 };
    bucket.count++;
    if (isSuccess(run)) bucket.successCount++;
    if (isFailed(run)) bucket.failedCount++;
    map.set(date, bucket);
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function bucketDurationByDay(runs: PersistedRun[]): DailyDuration[] {
  const map = new Map<string, { totalMs: number; count: number }>();
  for (const run of runs) {
    if (!run.completedAt) continue;
    const date = new Date(run.completedAt).toISOString().slice(0, 10);
    const entry = map.get(date) ?? { totalMs: 0, count: 0 };
    entry.totalMs += run.durationMs;
    entry.count++;
    map.set(date, entry);
  }
  return Array.from(map.entries())
    .map(([date, { totalMs, count }]) => ({ date, totalMs, avgMs: Math.round(totalMs / count) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function computeAgentBreakdown(runs: PersistedRun[]): AgentBreakdownEntry[] {
  const counts = new Map<string, number>();
  for (const run of runs) {
    const agent = run.agent ?? "unknown";
    counts.set(agent, (counts.get(agent) ?? 0) + 1);
  }
  const total = runs.length || 1;
  return Array.from(counts.entries())
    .map(([agent, count]) => ({ agent, count, percentage: (count / total) * 100 }))
    .sort((a, b) => b.count - a.count);
}

export function formatDuration(ms: number): string {
  if (ms === 0) return "0s";
  const seconds = Math.floor(ms / 1000);
  if (seconds === 0) return "<1s";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  const hours = seconds / 3600;
  return `${hours.toFixed(1)}h`;
}

export function computeAnalytics(projects: Project[], scope: AnalyticsScope): AnalyticsData {
  const runs = filterRunsByScope(projects, scope);
  const successfulRuns = runs.filter(isSuccess).length;
  const failedRuns = runs.filter(isFailed).length;
  const stoppedRuns = runs.filter(isStopped).length;
  const totalDurationMs = runs.reduce((sum, r) => sum + r.durationMs, 0);
  const durations = runs.map((r) => r.durationMs);

  const runsByAgent: Record<string, number> = {};
  const durationByAgent: Record<string, number> = {};
  for (const run of runs) {
    const agent = run.agent ?? "unknown";
    runsByAgent[agent] = (runsByAgent[agent] ?? 0) + 1;
    durationByAgent[agent] = (durationByAgent[agent] ?? 0) + run.durationMs;
  }

  let projectCount: number | undefined;
  let sessionCount: number | undefined;
  if (scope.level === "overall") {
    projectCount = projects.length;
    sessionCount = projects.reduce((sum, p) => sum + p.sessions.length, 0);
  } else if (scope.level === "project") {
    const project = projects.find((p) => p.id === scope.projectId);
    sessionCount = project?.sessions.length ?? 0;
  }

  return {
    totalRuns: runs.length,
    successfulRuns,
    failedRuns,
    stoppedRuns,
    successRate: runs.length > 0 ? (successfulRuns / runs.length) * 100 : 0,
    totalDurationMs,
    avgDurationMs: runs.length > 0 ? Math.round(totalDurationMs / runs.length) : 0,
    minDurationMs: durations.length > 0 ? Math.min(...durations) : 0,
    maxDurationMs: durations.length > 0 ? Math.max(...durations) : 0,
    runsByAgent,
    durationByAgent,
    dailyRuns: bucketByDay(runs),
    dailyDuration: bucketDurationByDay(runs),
    agentBreakdown: computeAgentBreakdown(runs),
    projectCount,
    sessionCount,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/analyticsUtils.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/analyticsUtils.ts src/lib/analyticsUtils.test.ts
git commit -m "feat(ui): add analytics utility functions with tests"
```

---

### Task 3: useAnalytics hook

**Files:**
- Create: `src/hooks/useAnalytics.ts`

- [ ] **Step 1: Create the hooks directory and useAnalytics hook**

Create `src/hooks/useAnalytics.ts`:

```typescript
import { useMemo } from "react";
import type { Project } from "../types";
import { type AnalyticsData, type AnalyticsScope, computeAnalytics } from "../lib/analyticsUtils";

export function useAnalytics(projects: Project[], scope: AnalyticsScope): AnalyticsData {
  return useMemo(() => computeAnalytics(projects, scope), [projects, scope]);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAnalytics.ts
git commit -m "feat(ui): add useAnalytics hook"
```

---

### Task 4: AnalyticsView component and styles

**Files:**
- Create: `src/components/AnalyticsView.tsx`
- Create: `src/components/AnalyticsView.css`

- [ ] **Step 1: Create AnalyticsView.css**

Create `src/components/AnalyticsView.css`:

```css
.analytics-view {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background: #161616;
  padding: 16px 24px;
  font-family: var(--vp-font-family-mono);
}

/* Scope bar */
.analytics-scope-bar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 20px;
}

.analytics-scope-btn {
  padding: 4px 12px;
  background: #1a1a1a;
  color: #888;
  border: 1px solid #333;
  border-radius: 3px;
  font-size: 0.72rem;
  font-family: inherit;
  cursor: pointer;
}

.analytics-scope-btn:hover {
  border-color: #555;
  color: #aaa;
}

.analytics-scope-btn.active {
  background: #6366f1;
  color: #fff;
  border-color: #6366f1;
}

.analytics-scope-context {
  margin-left: auto;
  color: #555;
  font-size: 0.68rem;
}

/* Summary cards */
.analytics-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.analytics-card {
  background: #1a1a1a;
  border: 1px solid #222;
  border-radius: 4px;
  padding: 12px;
}

.analytics-card-label {
  color: #555;
  font-size: 0.66rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.analytics-card-value {
  font-size: 1.4rem;
  font-weight: 600;
  color: #e0e0e0;
  margin-top: 4px;
}

.analytics-card-value.success {
  color: #4ade80;
}

.analytics-card-sub {
  color: #555;
  font-size: 0.66rem;
  margin-top: 2px;
}

.analytics-card-sub.positive {
  color: #4ade80;
}

.analytics-card-sub.warning {
  color: #f59e0b;
}

/* Chart containers */
.analytics-chart-panel {
  background: #1a1a1a;
  border: 1px solid #222;
  border-radius: 4px;
  padding: 16px;
  margin-bottom: 16px;
}

.analytics-chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.analytics-chart-title {
  color: #888;
  font-size: 0.72rem;
  font-weight: 500;
}

.analytics-chart-subtitle {
  color: #555;
  font-size: 0.66rem;
}

/* Bottom row */
.analytics-bottom-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

/* Agent breakdown */
.analytics-agent-row {
  margin-bottom: 8px;
}

.analytics-agent-label {
  display: flex;
  justify-content: space-between;
  font-size: 0.68rem;
  margin-bottom: 3px;
}

.analytics-agent-name {
  color: #9ca3af;
}

.analytics-agent-stat {
  color: #555;
}

.analytics-agent-bar {
  height: 6px;
  background: #222;
  border-radius: 3px;
  overflow: hidden;
}

.analytics-agent-bar-fill {
  height: 100%;
  border-radius: 3px;
}

/* Empty state */
.analytics-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  color: #555;
  font-size: 0.8rem;
  gap: 8px;
}

.analytics-empty-title {
  color: #888;
  font-size: 0.9rem;
  font-weight: 500;
}

/* Scope dropdown */
.analytics-scope-select {
  padding: 4px 8px;
  background: #1a1a1a;
  color: #888;
  border: 1px solid #333;
  border-radius: 3px;
  font-size: 0.72rem;
  font-family: inherit;
  cursor: pointer;
  appearance: none;
  padding-right: 20px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23555'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 6px center;
}

.analytics-scope-select:hover {
  border-color: #555;
}
```

- [ ] **Step 2: Create AnalyticsView.tsx**

Create `src/components/AnalyticsView.tsx`:

```typescript
import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area,
} from "recharts";
import type { Project } from "../types";
import { useAnalytics } from "../hooks/useAnalytics";
import type { AnalyticsScope } from "../lib/analyticsUtils";
import { formatDuration } from "../lib/analyticsUtils";
import "./AnalyticsView.css";

const AGENT_COLORS: Record<string, string> = {
  claude: "#818cf8",
  codex: "#22c55e",
  deepseek: "#22d3ee",
  unknown: "#555",
};

interface AnalyticsViewProps {
  projects: Project[];
  activeProjectId: string | null;
  activeSessionId: string | null;
}

export function AnalyticsView({ projects, activeProjectId, activeSessionId }: AnalyticsViewProps) {
  const defaultScope = useMemo<AnalyticsScope>(() => {
    if (activeProjectId && activeSessionId) {
      return { level: "session", projectId: activeProjectId, sessionId: activeSessionId };
    }
    if (activeProjectId) {
      return { level: "project", projectId: activeProjectId };
    }
    return { level: "overall" };
  }, [activeProjectId, activeSessionId]);

  const [scope, setScope] = useState<AnalyticsScope>(defaultScope);
  const data = useAnalytics(projects, scope);

  const activeProject = projects.find((p) => p.id === (scope.level === "overall" ? activeProjectId : scope.level === "project" ? scope.projectId : scope.projectId));
  const sessions = activeProject?.sessions ?? [];

  // Last 14 days of chart data
  const last14 = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return data.dailyRuns.filter((d) => d.date >= cutoffStr);
  }, [data.dailyRuns]);

  const last14Duration = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return data.dailyDuration.filter((d) => d.date >= cutoffStr).map((d) => ({
      ...d,
      avgSeconds: Math.round(d.avgMs / 1000),
    }));
  }, [data.dailyDuration]);

  // Runs this week
  const runsThisWeek = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return data.dailyRuns.filter((d) => d.date >= cutoffStr).reduce((sum, d) => sum + d.count, 0);
  }, [data.dailyRuns]);

  // Context text
  const contextText = scope.level === "overall"
    ? `${data.totalRuns} runs across ${data.projectCount ?? 0} projects`
    : scope.level === "project"
      ? `${data.totalRuns} runs across ${data.sessionCount ?? 0} sessions`
      : `${data.totalRuns} runs in this session`;

  if (data.totalRuns === 0) {
    return (
      <div className="analytics-view">
        <ScopeBar
          scope={scope}
          setScope={setScope}
          projects={projects}
          sessions={sessions}
          contextText={contextText}
        />
        <div className="analytics-empty">
          <div className="analytics-empty-title">No runs recorded yet</div>
          <div>Run some agents to see analytics here</div>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-view">
      <ScopeBar
        scope={scope}
        setScope={setScope}
        projects={projects}
        sessions={sessions}
        contextText={contextText}
      />

      {/* Summary Cards */}
      <div className="analytics-cards">
        <div className="analytics-card">
          <div className="analytics-card-label">Total Runs</div>
          <div className="analytics-card-value">{data.totalRuns}</div>
          <div className={`analytics-card-sub ${runsThisWeek > 0 ? "positive" : ""}`}>
            {runsThisWeek > 0 ? `+${runsThisWeek} this week` : "no runs this week"}
          </div>
        </div>
        <div className="analytics-card">
          <div className="analytics-card-label">Success Rate</div>
          <div className="analytics-card-value success">{Math.round(data.successRate)}%</div>
          <div className="analytics-card-sub">
            {data.successfulRuns} passed, {data.failedRuns} failed, {data.stoppedRuns} stopped
          </div>
        </div>
        <div className="analytics-card">
          <div className="analytics-card-label">Avg Duration</div>
          <div className="analytics-card-value">{formatDuration(data.avgDurationMs)}</div>
          <div className="analytics-card-sub warning">
            range: {formatDuration(data.minDurationMs)} — {formatDuration(data.maxDurationMs)}
          </div>
        </div>
        <div className="analytics-card">
          <div className="analytics-card-label">Total Time</div>
          <div className="analytics-card-value">{formatDuration(data.totalDurationMs)}</div>
          <div className="analytics-card-sub">agent compute time</div>
        </div>
      </div>

      {/* Runs Over Time */}
      {last14.length > 0 && (
        <div className="analytics-chart-panel">
          <div className="analytics-chart-header">
            <span className="analytics-chart-title">Runs over time</span>
            <span className="analytics-chart-subtitle">Last 14 days</span>
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={last14} barCategoryGap="20%">
              <XAxis
                dataKey="date"
                tick={{ fill: "#444", fontSize: 9 }}
                tickFormatter={(d: string) => d.slice(5)}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 4, fontSize: 11, color: "#ccc" }}
                labelStyle={{ color: "#888" }}
              />
              <Bar dataKey="successCount" stackId="a" fill="#22c55e" radius={[2, 2, 0, 0]} name="Success" />
              <Bar dataKey="failedCount" stackId="a" fill="#ef4444" radius={[2, 2, 0, 0]} name="Failed" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Bottom Row */}
      <div className="analytics-bottom-row">
        {/* Duration Trend */}
        {last14Duration.length > 1 && (
          <div className="analytics-chart-panel">
            <span className="analytics-chart-title">Avg duration trend</span>
            <ResponsiveContainer width="100%" height={100} style={{ marginTop: 12 }}>
              <AreaChart data={last14Duration}>
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#444", fontSize: 9 }}
                  tickFormatter={(d: string) => d.slice(5)}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 4, fontSize: 11, color: "#ccc" }}
                  labelStyle={{ color: "#888" }}
                  formatter={(value: number) => [`${value}s`, "Avg"]}
                />
                <defs>
                  <linearGradient id="durationGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818cf8" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="avgSeconds" stroke="#818cf8" fill="url(#durationGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Agent Breakdown */}
        <div className="analytics-chart-panel">
          <span className="analytics-chart-title">Runs by agent</span>
          <div style={{ marginTop: 12 }}>
            {data.agentBreakdown.map((entry) => (
              <div key={entry.agent} className="analytics-agent-row">
                <div className="analytics-agent-label">
                  <span className="analytics-agent-name">{entry.agent}</span>
                  <span className="analytics-agent-stat">{entry.count} runs ({Math.round(entry.percentage)}%)</span>
                </div>
                <div className="analytics-agent-bar">
                  <div
                    className="analytics-agent-bar-fill"
                    style={{
                      width: `${entry.percentage}%`,
                      background: AGENT_COLORS[entry.agent] ?? "#555",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScopeBar({
  scope,
  setScope,
  projects,
  sessions,
  contextText,
}: {
  scope: AnalyticsScope;
  setScope: (s: AnalyticsScope) => void;
  projects: Project[];
  sessions: { id: string; name: string }[];
  contextText: string;
}) {
  const selectedProjectId = scope.level === "project" ? scope.projectId : scope.level === "session" ? scope.projectId : "";

  return (
    <div className="analytics-scope-bar">
      <button
        type="button"
        className={`analytics-scope-btn ${scope.level === "overall" ? "active" : ""}`}
        onClick={() => setScope({ level: "overall" })}
      >
        Overall
      </button>

      <select
        className="analytics-scope-select"
        value={selectedProjectId}
        onChange={(e) => {
          if (e.target.value) setScope({ level: "project", projectId: e.target.value });
        }}
      >
        <option value="">Project...</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>

      {(scope.level === "project" || scope.level === "session") && sessions.length > 0 && (
        <select
          className="analytics-scope-select"
          value={scope.level === "session" ? scope.sessionId : ""}
          onChange={(e) => {
            const projectId = scope.level === "project" ? scope.projectId : scope.level === "session" ? scope.projectId : "";
            if (e.target.value) setScope({ level: "session", projectId, sessionId: e.target.value });
          }}
        >
          <option value="">Session...</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      )}

      <span className="analytics-scope-context">{contextText}</span>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/AnalyticsView.tsx src/components/AnalyticsView.css
git commit -m "feat(ui): add AnalyticsView component with charts and scope bar"
```

---

### Task 5: Integrate AnalyticsView into App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add ChartBar icon import**

In `src/App.tsx`, add `ChartBar` to the Carbon icons import on line 9:

```typescript
import { CheckmarkFilled, ChartBar, Close, ErrorFilled, IbmKnowledgeCatalog, InformationFilled, Notification as NotificationIcon, NotificationFilled, WarningAltFilled } from "@carbon/icons-react";
```

- [ ] **Step 2: Add AnalyticsView import**

Add after the other component imports (around line 23):

```typescript
import { AnalyticsView } from "./components/AnalyticsView";
```

- [ ] **Step 3: Add analyticsOpen state**

Inside the `App` function, add after the `globalViewOpen` state (around line 1108):

```typescript
const [analyticsOpen, setAnalyticsOpen] = useState(false);
```

- [ ] **Step 4: Close analytics on project switch**

In the `switchToProject` function (search for `function switchToProject`), add `setAnalyticsOpen(false)` at the start of the function body, before any existing logic.

- [ ] **Step 5: Add analytics button to left rail**

In `src/App.tsx`, find the `project-rail-footer` div (around line 2518). Add the analytics button before the "All Sessions" button:

```typescript
            <button
              type="button"
              className={`project-rail-action ${analyticsOpen ? "project-rail-action-active" : ""}`}
              onClick={() => setAnalyticsOpen(!analyticsOpen)}
              title="Analytics"
            >
              <ChartBar size={16} />
              <span>Analytics</span>
            </button>
```

- [ ] **Step 6: Conditionally render AnalyticsView instead of session content**

Find the `<div className="main-column">` section (around line 2558). Wrap the existing content in an `analyticsOpen` conditional:

Replace the block starting at `<div className="main-column">` through the end of `session-workspace` and `session-todo` with:

```typescript
        <div className="main-column">
          {analyticsOpen ? (
            <AnalyticsView
              projects={projects}
              activeProjectId={activeProjectId}
              activeSessionId={activeProject?.activeSessionId ?? null}
            />
          ) : (
            <>
              {/* existing SessionTabs, session-workspace, session-todo content unchanged */}
              {activeProject && activeProject.sessions.length > 0 && (
                <SessionTabs
                  /* ... existing props ... */
                />
              )}
              {/* ... rest of existing main-column content ... */}
            </>
          )}
        </div>
```

Note: Keep all existing JSX inside the `<>...</>` fragment exactly as-is. Only add the `analyticsOpen` ternary wrapper around it.

- [ ] **Step 7: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx
git commit -m "feat(ui): integrate AnalyticsView into App with left rail toggle"
```

---

### Task 6: Add active state styling for left rail analytics button

**Files:**
- Modify: `src/App.css`

- [ ] **Step 1: Add active state for project-rail-action**

Find the `.project-rail-action` styles in `src/App.css`. Add after the existing `.project-rail-action:hover` rule:

```css
.project-rail-action-active {
  color: #e0e0e0;
  background: rgba(99, 102, 241, 0.15);
}

.project-rail-action-active:hover {
  color: #e0e0e0;
  background: rgba(99, 102, 241, 0.2);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/App.css
git commit -m "style(ui): add active state for analytics left rail button"
```

---

### Task 7: End-to-end verification

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Verify dev build**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 4: Final commit if any fixes needed**

If any fixes were required during verification, commit them:

```bash
git add -A
git commit -m "fix(ui): address analytics verification issues"
```
