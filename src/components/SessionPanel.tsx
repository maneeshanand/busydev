import type { Session } from "../types";
import "./SessionPanel.css";

interface SessionPanelProps {
  sessions: Session[];
  activeSessionId: string;
  collapsed: boolean;
  onSelectSession: (id: string) => void;
  onCollapse: () => void;
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 7v5l3 3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function CollapseLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="9" y1="3" x2="9" y2="21" stroke="currentColor" strokeWidth="1.5" />
      <path d="M14 10l-2 2 2 2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function SessionPanel({
  sessions,
  activeSessionId,
  collapsed,
  onSelectSession,
  onCollapse,
}: SessionPanelProps) {
  if (collapsed) {
    return (
      <div className="session-panel session-panel-collapsed">
        <div className="session-panel-icon">
          <ClockIcon />
        </div>
      </div>
    );
  }

  return (
    <div className="session-panel">
      <div className="session-panel-header">
        <h3>Sessions</h3>
        <button type="button" className="panel-collapse-btn" onClick={onCollapse} title="Collapse panel">
          <CollapseLeftIcon />
        </button>
      </div>
      <div className="session-panel-list">
        {sessions.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`session-item ${s.id === activeSessionId ? "session-item-active" : ""}`}
            onClick={() => onSelectSession(s.id)}
          >
            <div className="session-item-time">{formatDate(s.startedAt)}</div>
            <div className="session-item-meta">
              {s.runs.length} run{s.runs.length !== 1 ? "s" : ""}
              {s.todos.length > 0 && ` · ${s.todos.filter((t) => t.done).length}/${s.todos.length} todos`}
            </div>
          </button>
        ))}
        {sessions.length === 0 && (
          <div className="session-empty">No previous sessions</div>
        )}
      </div>
    </div>
  );
}
