import { useState, useMemo, useRef, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import type { Project } from "../types";
import { useAnalytics } from "../hooks/useAnalytics";
import type { AnalyticsScope } from "../lib/analyticsUtils";
import { formatDuration } from "../lib/analyticsUtils";

import "./AnalyticsView.css";

// ── Agent colors ────────────────────────────────────────────────────

const AGENT_COLORS: Record<string, string> = {
  claude: "#818cf8",
  codex: "#22c55e",
  deepseek: "#22d3ee",
  unknown: "#555",
};

function agentColor(agent: string): string {
  return AGENT_COLORS[agent] ?? AGENT_COLORS.unknown;
}

// ── ScopeBar sub-component ──────────────────────────────────────────

interface ScopeBarProps {
  projects: Project[];
  scope: AnalyticsScope;
  onScopeChange: (scope: AnalyticsScope) => void;
  projectCount?: number;
  sessionCount?: number;
  totalRuns: number;
}

function ScopeBar({
  projects,
  scope,
  onScopeChange,
  projectCount,
  sessionCount,
  totalRuns,
}: ScopeBarProps) {
  const selectedProjectId =
    scope.level === "project" || scope.level === "session"
      ? scope.projectId
      : "";
  const selectedSessionId =
    scope.level === "session" ? scope.sessionId : "";

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="analytics-scope-bar">
      <button
        className={`analytics-scope-btn ${scope.level === "overall" ? "active" : ""}`}
        onClick={() => onScopeChange({ level: "overall" })}
      >
        Overall
      </button>

      <select
        className="analytics-scope-select"
        value={selectedProjectId}
        onChange={(e) => {
          const pid = e.target.value;
          if (pid) {
            onScopeChange({ level: "project", projectId: pid });
          } else {
            onScopeChange({ level: "overall" });
          }
        }}
      >
        <option value="">Select project...</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      {selectedProject && (
        <select
          className="analytics-scope-select"
          value={selectedSessionId}
          onChange={(e) => {
            const sid = e.target.value;
            if (sid) {
              onScopeChange({
                level: "session",
                projectId: selectedProjectId,
                sessionId: sid,
              });
            } else {
              onScopeChange({
                level: "project",
                projectId: selectedProjectId,
              });
            }
          }}
        >
          <option value="">All sessions</option>
          {selectedProject.sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}

      <span className="analytics-scope-context">
        {totalRuns} run{totalRuns !== 1 ? "s" : ""}
        {projectCount != null && ` · ${projectCount} project${projectCount !== 1 ? "s" : ""}`}
        {sessionCount != null && ` · ${sessionCount} session${sessionCount !== 1 ? "s" : ""}`}
      </span>
    </div>
  );
}

// ── AnalyticsView ───────────────────────────────────────────────────

interface AnalyticsViewProps {
  projects: Project[];
  activeProjectId: string | null;
  activeSessionId: string | null;
}

export function AnalyticsView({
  projects,
  activeProjectId,
  activeSessionId,
}: AnalyticsViewProps) {
  // Default scope from active context
  const defaultScope = useMemo<AnalyticsScope>(() => {
    if (activeSessionId && activeProjectId) {
      return {
        level: "session",
        projectId: activeProjectId,
        sessionId: activeSessionId,
      };
    }
    if (activeProjectId) {
      return { level: "project", projectId: activeProjectId };
    }
    return { level: "overall" };
  }, [activeProjectId, activeSessionId]);

  const [scope, setScope] = useState<AnalyticsScope>(defaultScope);
  const data = useAnalytics(projects, scope);

  // Read CSS custom properties for recharts inline styles
  const viewRef = useRef<HTMLDivElement>(null);
  const [chartTheme, setChartTheme] = useState({
    axis: "#333", tick: "#666", tooltipBg: "#1a1a1a", tooltipBorder: "#333", tooltipText: "#ccc",
  });
  useEffect(() => {
    if (!viewRef.current) return;
    const s = getComputedStyle(viewRef.current);
    setChartTheme({
      axis: s.getPropertyValue("--an-axis").trim() || "#333",
      tick: s.getPropertyValue("--an-tick").trim() || "#666",
      tooltipBg: s.getPropertyValue("--an-tooltip-bg").trim() || "#1a1a1a",
      tooltipBorder: s.getPropertyValue("--an-tooltip-border").trim() || "#333",
      tooltipText: s.getPropertyValue("--an-tooltip-text").trim() || "#ccc",
    });
  }, []);

  // Compute "this week" runs
  const runsThisWeek = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekAgoStr = weekAgo.toISOString().slice(0, 10);
    return data.dailyRuns
      .filter((d) => d.date >= weekAgoStr)
      .reduce((sum, d) => sum + d.count, 0);
  }, [data.dailyRuns]);

  // Last 14 days for charts
  const last14Runs = useMemo(() => {
    const sliced = data.dailyRuns.slice(-14);
    return sliced.map((d) => ({
      ...d,
      label: d.date.slice(5), // "MM-DD"
    }));
  }, [data.dailyRuns]);

  const last14Duration = useMemo(() => {
    const sliced = data.dailyDuration.slice(-14);
    return sliced.map((d) => ({
      ...d,
      label: d.date.slice(5),
      avgSec: Math.round(d.avgMs / 1000),
    }));
  }, [data.dailyDuration]);

  if (data.totalRuns === 0) {
    return (
      <div className="analytics-view" ref={viewRef}>
        <ScopeBar
          projects={projects}
          scope={scope}
          onScopeChange={setScope}
          projectCount={data.projectCount}
          sessionCount={data.sessionCount}
          totalRuns={0}
        />
        <div className="analytics-empty">No runs recorded yet</div>
      </div>
    );
  }

  return (
    <div className="analytics-view" ref={viewRef}>
      <ScopeBar
        projects={projects}
        scope={scope}
        onScopeChange={setScope}
        projectCount={data.projectCount}
        sessionCount={data.sessionCount}
        totalRuns={data.totalRuns}
      />

      {/* Summary cards */}
      <div className="analytics-cards">
        <div className="analytics-card">
          <div className="analytics-card-label">Total Runs</div>
          <div className="analytics-card-value">{data.totalRuns}</div>
          {runsThisWeek > 0 && (
            <div className="analytics-card-sub">+{runsThisWeek} this week</div>
          )}
        </div>

        <div className="analytics-card">
          <div className="analytics-card-label">Success Rate</div>
          <div className="analytics-card-value success">
            {data.successRate}%
          </div>
          <div className="analytics-card-sub">
            {data.successfulRuns} ok · {data.failedRuns} fail · {data.stoppedRuns} stopped
          </div>
        </div>

        <div className="analytics-card">
          <div className="analytics-card-label">Avg Duration</div>
          <div className="analytics-card-value">
            {formatDuration(data.avgDurationMs)}
          </div>
          <div className="analytics-card-sub">
            {formatDuration(data.minDurationMs)} – {formatDuration(data.maxDurationMs)}
          </div>
        </div>

        <div className="analytics-card">
          <div className="analytics-card-label">Total Time</div>
          <div className="analytics-card-value">
            {formatDuration(data.totalDurationMs)}
          </div>
        </div>
      </div>

      {/* Runs over time */}
      <div className="analytics-chart-panel">
        <div className="analytics-chart-title">Runs over time</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={last14Runs}>
            <XAxis
              dataKey="label"
              tick={{ fill: chartTheme.tick, fontSize: 11 }}
              axisLine={{ stroke: chartTheme.axis }}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: chartTheme.tick, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={30}
            />
            <Tooltip
              contentStyle={{
                background: chartTheme.tooltipBg,
                border: `1px solid ${chartTheme.tooltipBorder}`,
                borderRadius: 4,
                fontSize: 12,
                color: chartTheme.tooltipText,
              }}
            />
            <Bar
              dataKey="successCount"
              stackId="runs"
              fill="#22c55e"
              name="Success"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="failedCount"
              stackId="runs"
              fill="#ef4444"
              name="Failed"
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom row */}
      <div className="analytics-bottom-row">
        {/* Avg duration trend */}
        <div className="analytics-chart-panel">
          <div className="analytics-chart-title">Avg duration trend</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={last14Duration}>
              <defs>
                <linearGradient id="durationGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fill: chartTheme.tick, fontSize: 11 }}
                axisLine={{ stroke: chartTheme.axis }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: chartTheme.tick, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={40}
                unit="s"
              />
              <Tooltip
                contentStyle={{
                  background: "#1a1a1a",
                  border: "1px solid #333",
                  borderRadius: 4,
                  fontSize: 12,
                  color: "#ccc",
                }}
                formatter={(value) => [`${value}s`, "Avg"]}
              />
              <Area
                type="monotone"
                dataKey="avgSec"
                stroke="#818cf8"
                strokeWidth={2}
                fill="url(#durationGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Agent breakdown */}
        <div className="analytics-chart-panel">
          <div className="analytics-chart-title">Agent breakdown</div>
          <div className="analytics-agent-list">
            {data.agentBreakdown.map((entry) => (
              <div key={entry.agent} className="analytics-agent-row">
                <span className="analytics-agent-name">{entry.agent}</span>
                <div className="analytics-agent-bar">
                  <div
                    className="analytics-agent-bar-fill"
                    style={{
                      width: `${entry.percentage}%`,
                      backgroundColor: agentColor(entry.agent),
                    }}
                  />
                </div>
                <span className="analytics-agent-count">
                  {entry.count} ({entry.percentage}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
