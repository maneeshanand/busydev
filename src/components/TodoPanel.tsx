import { useState } from "react";
import type { TodoItem } from "../types";
import "./TodoPanel.css";

interface TodoPanelProps {
  todos: TodoItem[];
  collapsed: boolean;
  readonly?: boolean;
  canRun?: boolean;
  running?: boolean;
  onAdd: (text: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, text: string) => void;
  onCollapse: () => void;
  onRunTodos?: () => void;
  onStopTodos?: () => void;
  onGenerateTodos?: (goal: string) => void;
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
      <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
    </svg>
  );
}

function CollapseRightIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="15" y1="3" x2="15" y2="21" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 10l2 2-2 2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChecklistIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M9 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"
        fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"
      />
      <path d="M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2Z"
        fill="none" stroke="currentColor" strokeWidth="1.7"
      />
      <path d="m9 14 2 2 4-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TodoPanel({
  todos,
  collapsed,
  readonly,
  onAdd,
  onToggle,
  onDelete,
  onEdit,
  onCollapse,
  onRunTodos,
  onStopTodos,
  onGenerateTodos,
  canRun,
  running,
}: TodoPanelProps) {
  const [newText, setNewText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [goalInput, setGoalInput] = useState("");
  const [showGoalInput, setShowGoalInput] = useState(false);

  const doneCount = todos.filter((t) => t.done).length;
  const pending = todos.filter((t) => !t.done);

  function handleGenerate() {
    if (!goalInput.trim() || !onGenerateTodos) return;
    onGenerateTodos(goalInput.trim());
    setGoalInput("");
    setShowGoalInput(false);
  }

  function handleGoalKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleGenerate();
    }
    if (e.key === "Escape") {
      setShowGoalInput(false);
      setGoalInput("");
    }
  }

  function handleAdd() {
    const trimmed = newText.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setNewText("");
  }

  function handleAddKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  }

  function startEdit(item: TodoItem) {
    setEditingId(item.id);
    setEditText(item.text);
  }

  function commitEdit() {
    if (editingId && editText.trim()) {
      onEdit(editingId, editText.trim());
    }
    setEditingId(null);
    setEditText("");
  }

  function handleEditKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
    }
    if (e.key === "Escape") {
      setEditingId(null);
    }
  }

  if (collapsed) {
    return (
      <div className="todo-panel todo-panel-collapsed">
        <div className="todo-panel-icon">
          <ChecklistIcon />
        </div>
        {todos.length > 0 && (
          <div className="todo-panel-badge">{doneCount}/{todos.length}</div>
        )}
      </div>
    );
  }

  return (
    <div className="todo-panel">
      <div className="todo-panel-header">
        <h3>Todos</h3>
        <div className="todo-header-actions">
          {todos.length > 0 && (
            <span className="todo-progress">{doneCount}/{todos.length}</span>
          )}
          {onGenerateTodos && !running && (
            <button
              type="button"
              className="panel-collapse-btn"
              onClick={() => setShowGoalInput((prev) => !prev)}
              disabled={!canRun}
              title="Break down a goal into todos"
            >
              +AI
            </button>
          )}
          <button type="button" className="panel-collapse-btn" onClick={onCollapse} title="Collapse panel">
            <CollapseRightIcon />
          </button>
        </div>
      </div>
      {showGoalInput && todos.length > 0 && (
        <div className="todo-goal-bar">
          <input
            type="text"
            value={goalInput}
            onChange={(e) => setGoalInput(e.target.value)}
            onKeyDown={handleGoalKeyDown}
            placeholder="Break down a goal..."
            className="todo-goal-field"
            autoFocus
          />
          <button type="button" className="todo-goal-go" onClick={handleGenerate} disabled={!goalInput.trim() || !canRun}>
            Go
          </button>
        </div>
      )}
      <div className="todo-list">
        {todos.length === 0 && onGenerateTodos && (
          <div className="todo-empty">
            <div className="todo-empty-text">What do you want to build?</div>
            <div className="todo-goal-input">
              <input
                type="text"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                onKeyDown={handleGoalKeyDown}
                placeholder="e.g., add auth with JWT..."
                className="todo-goal-field"
              />
              <button type="button" className="todo-goal-go" onClick={handleGenerate} disabled={!goalInput.trim() || !canRun}>
                Generate
              </button>
            </div>
          </div>
        )}
        {todos.map((item) => (
          <div key={item.id} className={`todo-item ${item.done ? "todo-item-done" : ""}`}>
            {!readonly && (
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => onToggle(item.id)}
                className="todo-checkbox"
              />
            )}
            {readonly && (
              <span className={`todo-bullet ${item.done ? "todo-bullet-done" : ""}`} />
            )}
            {editingId === item.id ? (
              <input
                type="text"
                className="todo-edit-input"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={handleEditKeyDown}
                autoFocus
              />
            ) : (
              <span
                className="todo-text"
                onDoubleClick={() => !readonly && startEdit(item)}
              >
                {item.text}
              </span>
            )}
            {item.source === "agent" && item.done && (
              <span className="todo-agent-badge">agent</span>
            )}
            {!readonly && editingId !== item.id && (
              <button
                type="button"
                className="todo-delete"
                onClick={() => onDelete(item.id)}
                title="Delete"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      {!readonly && (
        <div className="todo-footer">
          <div className="todo-add">
            <input
              type="text"
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              onKeyDown={handleAddKeyDown}
              placeholder="Add a todo..."
              className="todo-add-input"
            />
            <button type="button" onClick={handleAdd} disabled={!newText.trim()} className="todo-add-button">
              +
            </button>
          </div>
          {pending.length > 0 && (
            running ? (
              <button
                type="button"
                className="todo-run-button todo-run-stop"
                onClick={onStopTodos}
              >
                <PauseIcon />
                Stop
              </button>
            ) : (
              <button
                type="button"
                className="todo-run-button"
                onClick={onRunTodos}
                disabled={!canRun}
              >
                <PlayIcon />
                Run {pending.length} todo{pending.length !== 1 ? "s" : ""}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
