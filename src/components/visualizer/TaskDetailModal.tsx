import type { TodoItem, PersistedRun, StreamRow } from "../../types";
import { formatMessage } from "../../lib/frontendUtils";

interface TaskDetailModalProps {
  todo: TodoItem;
  run?: PersistedRun;
  index: number;
  onClose: () => void;
}

function renderRow(row: StreamRow) {
  if (row.hidden) return null;
  switch (row.category) {
    case "message":
      return (
        <div key={row.id} className="viz-modal-message">
          {formatMessage(row.text)}
        </div>
      );
    case "command":
      return (
        <div key={row.id} className="viz-modal-command">
          <span className="viz-modal-prefix">$</span>
          <span>{row.command ?? row.text}</span>
          <span className={`viz-modal-status is-${row.status}`}>
            {row.status === "done" && "done"}
            {row.status === "failed" && `exit ${row.exitCode}`}
          </span>
        </div>
      );
    case "file_change":
      return (
        <div key={row.id} className="viz-modal-file">
          <span className="viz-modal-file-label">edited</span> {row.text}
        </div>
      );
    case "error":
      return <div key={row.id} className="viz-modal-error">{row.text}</div>;
    default:
      return row.text ? <div key={row.id} className="viz-modal-status-row">{row.text}</div> : null;
  }
}

export function TaskDetailModal({ todo, run, index, onClose }: TaskDetailModalProps) {
  const state = todo.done ? "completed" : run ? "running" : "pending";
  const duration = run?.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : null;

  return (
    <div className="viz-modal-overlay" onClick={onClose}>
      <div className="viz-modal" onClick={(e) => e.stopPropagation()}>
        <div className="viz-modal-header">
          <div className="viz-modal-title">
            <span className={`viz-modal-dot viz-dot-${state}`} />
            Task {index + 1}: {todo.text}
          </div>
          <div className="viz-modal-meta">
            {state.charAt(0).toUpperCase() + state.slice(1)}
            {duration && ` · ${duration}`}
            {run && ` · ${run.streamRows.filter((r) => r.category === "command").length} tool calls`}
          </div>
          <button type="button" className="viz-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="viz-modal-body">
          {run ? (
            run.streamRows.filter((r) => !r.hidden).map(renderRow)
          ) : (
            <div className="viz-modal-empty">No execution data yet</div>
          )}
          {run?.finalSummary && (
            <div className="viz-modal-summary">{formatMessage(run.finalSummary)}</div>
          )}
        </div>
      </div>
    </div>
  );
}
