import { useState } from "react";
import type { Project } from "../types";
import "./GlobalSessionViewer.css";

interface GlobalSessionViewerProps {
  projects: Project[];
  activeProjectId: string | null;
  activeSessionId: string | null;
  runningSessionKeys: Set<string>;
  onNavigate: (projectId: string, sessionId: string) => void;
  onClose: () => void;
}

export function GlobalSessionViewer({
  projects,
  activeProjectId,
  activeSessionId,
  runningSessionKeys,
  onNavigate,
  onClose,
}: GlobalSessionViewerProps) {
  const [filter, setFilter] = useState("");
  const lowerFilter = filter.toLowerCase();

  const rows: {
    projectId: string;
    projectName: string;
    sessionId: string;
    sessionName: string;
    lastPrompt: string;
    isActive: boolean;
    isRunning: boolean;
    runCount: number;
  }[] = [];

  for (const p of projects) {
    for (const s of p.sessions) {
      const lastRun = s.runs.length > 0 ? s.runs[s.runs.length - 1] : null;
      const lastPrompt = lastRun?.prompt ?? "";
      const isActive = p.id === activeProjectId && s.id === activeSessionId;
      const isRunning = runningSessionKeys.has(`${p.id}:${s.id}`);

      if (lowerFilter) {
        const haystack = `${p.name} ${s.name} ${lastPrompt}`.toLowerCase();
        if (!haystack.includes(lowerFilter)) continue;
      }

      rows.push({
        projectId: p.id,
        projectName: p.name,
        sessionId: s.id,
        sessionName: s.name,
        lastPrompt: lastPrompt.length > 100 ? lastPrompt.slice(0, 100) + "..." : lastPrompt,
        isActive,
        isRunning,
        runCount: s.runs.length,
      });
    }
  }

  return (
    <div className="gsv-overlay">
      <div className="gsv-header">
        <h2>All Sessions</h2>
        <div className="gsv-header-controls">
          <input
            className="gsv-search"
            type="text"
            placeholder="Filter sessions..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            autoFocus
          />
          <button type="button" className="gsv-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18" /><path d="M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="gsv-empty">
          {projects.length === 0 ? "No projects yet" : "No sessions match your filter"}
        </div>
      ) : (
        <div className="gsv-list">
          {rows.map((row) => (
            <button
              key={`${row.projectId}:${row.sessionId}`}
              type="button"
              className={`gsv-row ${row.isActive ? "gsv-row-active" : ""}`}
              onClick={() => { onNavigate(row.projectId, row.sessionId); onClose(); }}
            >
              <div className="gsv-row-meta">
                <span className="gsv-row-project">{row.projectName}</span>
                <span className="gsv-row-separator">/</span>
                <span className="gsv-row-session">{row.sessionName}</span>
                {row.isRunning && <span className="gsv-row-running" title="Agent running" />}
                {row.runCount > 0 && <span className="gsv-row-count">{row.runCount} run{row.runCount !== 1 ? "s" : ""}</span>}
              </div>
              {row.lastPrompt && (
                <div className="gsv-row-prompt">{row.lastPrompt}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
