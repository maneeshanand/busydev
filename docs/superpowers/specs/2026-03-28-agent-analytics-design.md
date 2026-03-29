# Agent Analytics Design

## Overview

Agent analytics provides productivity insight and usage tracking across sessions, projects, and overall. Analytics are computed on-the-fly from existing persisted run data — no new persistence layer, no schema changes.

## Goals

- Show how agents are being used: run counts, success rates, durations, agent distribution
- Time-series visibility: daily trends for runs and duration
- Scoped views: overall, per-project, per-session — defaulting to the user's current context
- Zero new backend work: pure frontend derivation from existing `Project → Session → PersistedRun` hierarchy

## Non-Goals (Future Iterations)

- Token counting and cost tracking (requires agent CLI output parsing)
- Real-time in-flight run metrics
- Export/sharing of analytics data

## Data Model

### Source Data

Analytics derive from existing types with no modifications:

```typescript
// Already exists — no changes needed
interface PersistedRun {
  id: number;
  prompt: string;
  streamRows: StreamRow[];
  exitCode: number | null;
  completedAt?: number;       // unix timestamp
  durationMs: number;         // wall-clock duration
  finalSummary: string;
  stopped?: boolean;
  agent?: "codex" | "claude" | "deepseek";
}
```

### Analytics Output

```typescript
type AnalyticsScope =
  | { level: "overall" }
  | { level: "project"; projectId: string }
  | { level: "session"; projectId: string; sessionId: string };

interface AnalyticsData {
  // Summary cards
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  stoppedRuns: number;
  successRate: number;              // 0–100
  totalDurationMs: number;
  avgDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;

  // Breakdowns
  runsByAgent: Record<string, number>;
  durationByAgent: Record<string, number>;

  // Time-series (daily buckets keyed by YYYY-MM-DD)
  dailyRuns: { date: string; count: number; successCount: number; failedCount: number }[];
  dailyDuration: { date: string; totalMs: number; avgMs: number }[];

  // Scope context
  projectCount?: number;            // only for "overall" scope
  sessionCount?: number;            // for "overall" and "project" scopes
}
```

### Computation Rules

- **Success:** `exitCode === 0 && !stopped`
- **Failed:** `exitCode !== 0 && exitCode !== null && !stopped`
- **Stopped:** `stopped === true`
- **Daily bucketing:** `new Date(completedAt).toISOString().slice(0, 10)` — runs without `completedAt` are excluded from time-series but included in totals
- **Agent key:** `run.agent ?? "unknown"`
- **Time range:** All available data (no fixed window). The chart displays the last 14 days by default, but all data feeds the summary cards.

## UI Layout

### Navigation

A new analytics icon button in the left rail, positioned between the project list and the settings gear. This is a toggle:

- **Click to open:** Replaces stream panel + todo panel with the analytics view. Session tabs, prompt composer, and todo panel all hide.
- **Click to close:** Returns to the stream view for the active project/session.
- **Clicking a project in the left rail while analytics is open:** Closes analytics and switches to that project's stream view.

### Analytics View Structure

```
┌─────────────────────────────────────────────────────────┐
│  Scope bar: [Overall] [Project v] [Session v]           │
├─────────────────────────────────────────────────────────┤
│  Summary Cards (4-column grid)                          │
│  Total Runs | Success Rate | Avg Duration | Total Time  │
├─────────────────────────────────────────────────────────┤
│  Runs Over Time — stacked bar chart (daily)             │
│  Green = success, Red = failed                          │
├──────────────────────┬──────────────────────────────────┤
│  Avg Duration Trend  │  Runs by Agent                   │
│  Line chart (daily)  │  Horizontal bar breakdown        │
└──────────────────────┴──────────────────────────────────┘
```

### Scope Bar Behavior

- **Default scope** matches the user's current context:
  - If a project and session are active → session scope
  - If only a project is active → project scope
  - If nothing is selected → overall scope
- **Overall** button is always available
- **Project** dropdown lists all projects; pre-selects the active project if one exists
- **Session** dropdown appears only when a project is selected; lists that project's sessions

### Visual Style

- Background: `#161616` (matches existing stream panel)
- Cards: `#1a1a1a` with `#222` borders
- Text: light-on-dark (hardcoded colors, not theme variables — same pattern as stream panel)
- Chart colors: green (`#22c55e`) for success, red (`#ef4444`) for failed, indigo (`#818cf8`) for duration trend, cyan (`#22d3ee`) for deepseek agent
- Typography: IBM Plex Mono, consistent with existing stream panel

### Summary Cards Detail

| Card | Value | Subtext |
|------|-------|---------|
| Total Runs | count | "+N this week" (runs with completedAt in last 7 days) |
| Success Rate | percentage | "X passed, Y failed, Z stopped" |
| Avg Duration | formatted time | "range: min — max" |
| Total Time | formatted time | "agent compute time" |

### Charts (recharts)

**Runs Over Time:** `BarChart` with stacked bars. X-axis = date (last 14 days). Y-axis = run count. Two series: `successCount` (green) and `failedCount` (red). Tooltip shows date + counts.

**Avg Duration Trend:** `LineChart` (or `AreaChart` with gradient fill). X-axis = date (last 14 days). Y-axis = avg duration in seconds. Single indigo line. Tooltip shows date + formatted duration.

**Runs by Agent:** Not a recharts chart — simple horizontal bars rendered as styled divs. Shows agent name, bar proportional to percentage, count and percentage label.

## Component Architecture

### New Files

```
src/
  components/
    AnalyticsView.tsx       — Main view: scope bar, cards, charts, agent breakdown
    AnalyticsView.css       — Styles (dark background, cards, layout grid)
  hooks/
    useAnalytics.ts         — Pure computation: (projects, scope) → AnalyticsData
  lib/
    analyticsUtils.ts       — Pure helper functions
```

### AnalyticsView.tsx

Props:
```typescript
interface AnalyticsViewProps {
  projects: Project[];
  activeProjectId: string | null;
  activeSessionId: string | null;
}
```

Internal state:
- `scope: AnalyticsScope` — initialized from active context, updated via scope bar

Renders:
1. Scope bar with toggle buttons and dropdowns
2. Summary cards grid (4 columns)
3. Runs over time bar chart (recharts `BarChart`)
4. Bottom row: duration trend line chart + agent breakdown (2-column grid)

### useAnalytics.ts

```typescript
function useAnalytics(projects: Project[], scope: AnalyticsScope): AnalyticsData
```

Single `useMemo` with `[projects, scope]` deps:
1. `filterRunsByScope(projects, scope)` → flat array of `PersistedRun`
2. Single-pass aggregation for totals
3. `bucketByDay(runs)` → daily time-series arrays
4. Return `AnalyticsData`

### analyticsUtils.ts

Pure functions:
- `filterRunsByScope(projects, scope)` → `PersistedRun[]`
- `bucketByDay(runs)` → daily buckets
- `formatDuration(ms)` → human-readable string ("42s", "1.2h", "4m 12s")
- `computeAgentBreakdown(runs)` → `{ agent, count, percentage }[]`
- `isSuccess(run)`, `isFailed(run)`, `isStopped(run)` — classification helpers

### App.tsx Integration

Minimal changes:
- New state: `const [analyticsOpen, setAnalyticsOpen] = useState(false)`
- Left rail: analytics icon button that toggles `analyticsOpen`
- Conditional render: when `analyticsOpen` is true, render `<AnalyticsView>` instead of session tabs + stream panel + todo panel + prompt composer
- Project click handler: if `analyticsOpen`, set it to `false` before switching project

## Dependencies

- `recharts` — add to `package.json` (React charting library, ~40KB gzipped)
- No new Rust/Tauri dependencies
- No new database tables or migrations

## Edge Cases

- **No runs yet:** Show empty state with "No runs recorded yet" message and guidance
- **Runs without completedAt:** Included in totals but excluded from time-series charts
- **Runs without agent field:** Bucketed as "unknown" in agent breakdown
- **Single day of data:** Charts still render with one bar/point
- **Large datasets (10K+ runs):** useMemo prevents recomputation on unrelated renders. If needed, add debounce or virtualization later.
