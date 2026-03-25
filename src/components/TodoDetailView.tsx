import { useState } from "react";
import type { TodoItem, SubTask } from "../types";
import "./TodoDetailView.css";

interface TodoDetailViewProps {
  todo: TodoItem;
  index: number;
  total: number;
  onBack: () => void;
  onUpdate: (id: string, updates: Partial<TodoItem>) => void;
}

export function TodoDetailView({ todo, index, total, onBack, onUpdate }: TodoDetailViewProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleText, setTitleText] = useState(todo.text);
  const [newSubtask, setNewSubtask] = useState("");

  function saveTitle() {
    const trimmed = titleText.trim();
    if (trimmed && trimmed !== todo.text) {
      onUpdate(todo.id, { text: trimmed });
    }
    setEditingTitle(false);
  }

  function formatAge(ms: number): string {
    const sec = Math.floor((Date.now() - ms) / 1000);
    if (sec < 60) return "just now";
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    return `${Math.floor(hr / 24)}d ago`;
  }

  function toggleSubtask(stId: string) {
    const updated = (todo.subtasks ?? []).map((st) =>
      st.id === stId ? { ...st, done: !st.done } : st
    );
    onUpdate(todo.id, { subtasks: updated });
  }

  function addSubtask() {
    const text = newSubtask.trim();
    if (!text) return;
    const st: SubTask = { id: crypto.randomUUID(), text, done: false };
    onUpdate(todo.id, { subtasks: [...(todo.subtasks ?? []), st] });
    setNewSubtask("");
  }

  function deleteSubtask(stId: string) {
    onUpdate(todo.id, { subtasks: (todo.subtasks ?? []).filter((st) => st.id !== stId) });
  }

  return (
    <div className="todo-detail">
      <div className="todo-detail-back">
        <button type="button" onClick={onBack}>← Back</button>
        <span className="todo-detail-pos">{index + 1} of {total}</span>
      </div>

      <div className="todo-detail-title">
        {editingTitle ? (
          <input
            className="todo-detail-title-input"
            value={titleText}
            onChange={(e) => setTitleText(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveTitle();
              if (e.key === "Escape") { setTitleText(todo.text); setEditingTitle(false); }
            }}
            autoFocus
          />
        ) : (
          <span
            className="todo-detail-title-text"
            onClick={() => { setEditingTitle(true); setTitleText(todo.text); }}
          >
            {todo.text}
          </span>
        )}
        <div className="todo-detail-meta">
          Created {formatAge(todo.createdAt)} · by {todo.source}
        </div>
      </div>

      <div className="todo-detail-section">
        <label className="todo-detail-label">Notes</label>
        <textarea
          className="todo-detail-notes"
          value={todo.notes ?? ""}
          onChange={(e) => onUpdate(todo.id, { notes: e.target.value })}
          placeholder="Add notes... (supports @alias tags)"
        />
      </div>

      <div className="todo-detail-section">
        <label className="todo-detail-label">Execution</label>
        <div className="todo-detail-exec">
          <select
            value={todo.agent ?? ""}
            onChange={(e) => onUpdate(todo.id, { agent: e.target.value || undefined })}
          >
            <option value="">Session default</option>
            <option value="codex">Codex</option>
            <option value="claude">Claude</option>
          </select>
          <select
            value={todo.model ?? ""}
            onChange={(e) => onUpdate(todo.id, { model: e.target.value || undefined })}
          >
            <option value="">Session default</option>
            {(todo.agent === "claude"
              ? ["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5"]
              : ["codex-mini", "o3", "o4-mini"]
            ).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <span className="todo-detail-hint">Overrides session defaults for this item</span>
      </div>

      <div className="todo-detail-section">
        <label className="todo-detail-label">Sub-tasks</label>
        <div className="todo-detail-subtasks">
          {(todo.subtasks ?? []).map((st) => (
            <div key={st.id} className={`todo-detail-subtask ${st.done ? "is-done" : ""}`}>
              <input type="checkbox" checked={st.done} onChange={() => toggleSubtask(st.id)} />
              <span className="todo-detail-subtask-text">{st.text}</span>
              <button type="button" className="todo-detail-subtask-delete" onClick={() => deleteSubtask(st.id)}>×</button>
            </div>
          ))}
          <div className="todo-detail-subtask-add">
            <input
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addSubtask(); }}
              placeholder="Add sub-task..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
