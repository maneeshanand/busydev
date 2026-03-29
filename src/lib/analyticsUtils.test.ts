import { describe, expect, it } from "vitest";
import type { PersistedRun, Project, Session } from "../types";
import {
  isSuccess,
  isFailed,
  isStopped,
  filterRunsByScope,
  bucketByDay,
  bucketDurationByDay,
  computeAgentBreakdown,
  formatDuration,
  computeAnalytics,
} from "./analyticsUtils";
import type { AnalyticsScope } from "./analyticsUtils";

// ── Factories ──────────────────────────────────────────────────────────

function makeRun(overrides: Partial<PersistedRun> = {}): PersistedRun {
  return {
    id: 1,
    prompt: "do something",
    streamRows: [],
    exitCode: 0,
    completedAt: Date.now(),
    durationMs: 5000,
    finalSummary: "done",
    stopped: false,
    agent: "claude",
    ...overrides,
  };
}

function makeSession(overrides: Partial<Session> & { runs?: PersistedRun[] } = {}): Session {
  return {
    id: "s1",
    projectId: "p1",
    name: "Session 1",
    createdAt: Date.now(),
    runs: [],
    todos: [],
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project> & { sessions?: Session[] } = {}): Project {
  return {
    id: "p1",
    name: "Project 1",
    path: "/tmp/project",
    createdAt: Date.now(),
    sessions: [],
    activeSessionId: null,
    ...overrides,
  };
}

// ── isSuccess ──────────────────────────────────────────────────────────

describe("isSuccess", () => {
  it("returns true when exitCode is 0 and not stopped", () => {
    expect(isSuccess(makeRun({ exitCode: 0, stopped: false }))).toBe(true);
  });

  it("returns false when exitCode is non-zero", () => {
    expect(isSuccess(makeRun({ exitCode: 1 }))).toBe(false);
  });

  it("returns false when stopped is true even if exitCode is 0", () => {
    expect(isSuccess(makeRun({ exitCode: 0, stopped: true }))).toBe(false);
  });

  it("returns false when exitCode is null", () => {
    expect(isSuccess(makeRun({ exitCode: null }))).toBe(false);
  });
});

// ── isFailed ───────────────────────────────────────────────────────────

describe("isFailed", () => {
  it("returns true when exitCode is non-zero and not stopped", () => {
    expect(isFailed(makeRun({ exitCode: 1, stopped: false }))).toBe(true);
  });

  it("returns false when exitCode is 0", () => {
    expect(isFailed(makeRun({ exitCode: 0 }))).toBe(false);
  });

  it("returns false when exitCode is null", () => {
    expect(isFailed(makeRun({ exitCode: null }))).toBe(false);
  });

  it("returns false when stopped is true even with non-zero exitCode", () => {
    expect(isFailed(makeRun({ exitCode: 1, stopped: true }))).toBe(false);
  });
});

// ── isStopped ──────────────────────────────────────────────────────────

describe("isStopped", () => {
  it("returns true when stopped is true", () => {
    expect(isStopped(makeRun({ stopped: true }))).toBe(true);
  });

  it("returns false when stopped is false", () => {
    expect(isStopped(makeRun({ stopped: false }))).toBe(false);
  });

  it("returns false when stopped is undefined", () => {
    expect(isStopped(makeRun({ stopped: undefined }))).toBe(false);
  });
});

// ── filterRunsByScope ──────────────────────────────────────────────────

describe("filterRunsByScope", () => {
  const run1 = makeRun({ id: 1 });
  const run2 = makeRun({ id: 2 });
  const run3 = makeRun({ id: 3 });

  const projects: Project[] = [
    makeProject({
      id: "p1",
      sessions: [
        makeSession({ id: "s1", projectId: "p1", runs: [run1] }),
        makeSession({ id: "s2", projectId: "p1", runs: [run2] }),
      ],
    }),
    makeProject({
      id: "p2",
      sessions: [makeSession({ id: "s3", projectId: "p2", runs: [run3] })],
    }),
  ];

  it("returns all runs for overall scope", () => {
    const scope: AnalyticsScope = { level: "overall" };
    const runs = filterRunsByScope(projects, scope);
    expect(runs).toHaveLength(3);
  });

  it("returns runs for a specific project", () => {
    const scope: AnalyticsScope = { level: "project", projectId: "p1" };
    const runs = filterRunsByScope(projects, scope);
    expect(runs).toHaveLength(2);
  });

  it("returns runs for a specific session", () => {
    const scope: AnalyticsScope = { level: "session", projectId: "p1", sessionId: "s1" };
    const runs = filterRunsByScope(projects, scope);
    expect(runs).toHaveLength(1);
    expect(runs[0].id).toBe(1);
  });

  it("returns empty array when project not found", () => {
    const scope: AnalyticsScope = { level: "project", projectId: "nonexistent" };
    expect(filterRunsByScope(projects, scope)).toEqual([]);
  });

  it("returns empty array when session not found", () => {
    const scope: AnalyticsScope = { level: "session", projectId: "p1", sessionId: "nonexistent" };
    expect(filterRunsByScope(projects, scope)).toEqual([]);
  });
});

// ── bucketByDay ────────────────────────────────────────────────────────

describe("bucketByDay", () => {
  it("groups runs into daily buckets sorted ascending", () => {
    const runs = [
      makeRun({ id: 1, completedAt: new Date("2026-03-25T10:00:00Z").getTime(), exitCode: 0, stopped: false }),
      makeRun({ id: 2, completedAt: new Date("2026-03-25T14:00:00Z").getTime(), exitCode: 1, stopped: false }),
      makeRun({ id: 3, completedAt: new Date("2026-03-26T10:00:00Z").getTime(), exitCode: 0, stopped: false }),
    ];

    const buckets = bucketByDay(runs);
    expect(buckets).toHaveLength(2);
    expect(buckets[0].date).toBe("2026-03-25");
    expect(buckets[0].count).toBe(2);
    expect(buckets[0].successCount).toBe(1);
    expect(buckets[0].failedCount).toBe(1);
    expect(buckets[1].date).toBe("2026-03-26");
    expect(buckets[1].count).toBe(1);
    expect(buckets[1].successCount).toBe(1);
    expect(buckets[1].failedCount).toBe(0);
  });

  it("skips runs without completedAt", () => {
    const runs = [
      makeRun({ id: 1, completedAt: undefined }),
      makeRun({ id: 2, completedAt: new Date("2026-03-25T10:00:00Z").getTime() }),
    ];
    const buckets = bucketByDay(runs);
    expect(buckets).toHaveLength(1);
  });

  it("returns empty array for no runs", () => {
    expect(bucketByDay([])).toEqual([]);
  });
});

// ── bucketDurationByDay ────────────────────────────────────────────────

describe("bucketDurationByDay", () => {
  it("computes total and average duration per day", () => {
    const runs = [
      makeRun({ completedAt: new Date("2026-03-25T10:00:00Z").getTime(), durationMs: 2000 }),
      makeRun({ completedAt: new Date("2026-03-25T14:00:00Z").getTime(), durationMs: 4000 }),
      makeRun({ completedAt: new Date("2026-03-26T10:00:00Z").getTime(), durationMs: 6000 }),
    ];

    const buckets = bucketDurationByDay(runs);
    expect(buckets).toHaveLength(2);
    expect(buckets[0].date).toBe("2026-03-25");
    expect(buckets[0].totalMs).toBe(6000);
    expect(buckets[0].avgMs).toBe(3000);
    expect(buckets[1].totalMs).toBe(6000);
    expect(buckets[1].avgMs).toBe(6000);
  });
});

// ── computeAgentBreakdown ──────────────────────────────────────────────

describe("computeAgentBreakdown", () => {
  it("groups runs by agent with counts and percentages sorted desc", () => {
    const runs = [
      makeRun({ agent: "claude" }),
      makeRun({ agent: "claude" }),
      makeRun({ agent: "codex" }),
      makeRun({ agent: "deepseek" }),
    ];

    const breakdown = computeAgentBreakdown(runs);
    expect(breakdown).toHaveLength(3);
    expect(breakdown[0]).toEqual({ agent: "claude", count: 2, percentage: 50 });
    expect(breakdown[1].count).toBe(1);
    expect(breakdown[2].count).toBe(1);
  });

  it("labels runs without agent as 'unknown'", () => {
    const runs = [makeRun({ agent: undefined })];
    const breakdown = computeAgentBreakdown(runs);
    expect(breakdown[0].agent).toBe("unknown");
    expect(breakdown[0].percentage).toBe(100);
  });

  it("returns empty array for no runs", () => {
    expect(computeAgentBreakdown([])).toEqual([]);
  });
});

// ── formatDuration ─────────────────────────────────────────────────────

describe("formatDuration", () => {
  it("formats 0 as '0s'", () => {
    expect(formatDuration(0)).toBe("0s");
  });

  it("formats sub-second as '<1s'", () => {
    expect(formatDuration(500)).toBe("<1s");
  });

  it("formats seconds", () => {
    expect(formatDuration(42000)).toBe("42s");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(252000)).toBe("4m 12s");
  });

  it("formats hours", () => {
    expect(formatDuration(4320000)).toBe("1.2h");
  });

  it("drops zero seconds in minute range", () => {
    expect(formatDuration(120000)).toBe("2m 0s");
  });
});

// ── computeAnalytics ───────────────────────────────────────────────────

describe("computeAnalytics", () => {
  it("computes aggregate analytics from projects", () => {
    const runs = [
      makeRun({ id: 1, exitCode: 0, stopped: false, durationMs: 3000, agent: "claude", completedAt: new Date("2026-03-25").getTime() }),
      makeRun({ id: 2, exitCode: 1, stopped: false, durationMs: 5000, agent: "codex", completedAt: new Date("2026-03-25").getTime() }),
      makeRun({ id: 3, exitCode: 0, stopped: true, durationMs: 1000, agent: "claude", completedAt: new Date("2026-03-26").getTime() }),
    ];

    const projects = [
      makeProject({
        id: "p1",
        sessions: [
          makeSession({ id: "s1", projectId: "p1", runs: [runs[0], runs[1]] }),
          makeSession({ id: "s2", projectId: "p1", runs: [runs[2]] }),
        ],
      }),
    ];

    const data = computeAnalytics(projects, { level: "overall" });

    expect(data.totalRuns).toBe(3);
    expect(data.successfulRuns).toBe(1);
    expect(data.failedRuns).toBe(1);
    expect(data.stoppedRuns).toBe(1);
    expect(data.successRate).toBeCloseTo(33.33, 1);
    expect(data.totalDurationMs).toBe(9000);
    expect(data.avgDurationMs).toBe(3000);
    expect(data.minDurationMs).toBe(1000);
    expect(data.maxDurationMs).toBe(5000);
    expect(data.dailyRuns).toHaveLength(2);
    expect(data.agentBreakdown).toHaveLength(2);
    expect(data.projectCount).toBe(1);
    expect(data.sessionCount).toBe(2);
  });

  it("handles empty projects", () => {
    const data = computeAnalytics([], { level: "overall" });
    expect(data.totalRuns).toBe(0);
    expect(data.successRate).toBe(0);
    expect(data.avgDurationMs).toBe(0);
    expect(data.minDurationMs).toBe(0);
    expect(data.maxDurationMs).toBe(0);
  });
});
