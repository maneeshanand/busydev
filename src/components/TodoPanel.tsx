import { useState } from "react";
import type { TodoItem } from "../types";
import "./TodoPanel.css";

interface TodoPanelProps {
  todos: TodoItem[];
  collapsed: boolean;
  readonly?: boolean;
  onAdd: (text: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, text: string) => void;
  onCollapse: () => void;
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
}: TodoPanelProps) {
  const [newText, setNewText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const doneCount = todos.filter((t) => t.done).length;

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
          <button type="button" className="panel-collapse-btn" onClick={onCollapse} title="Collapse panel">
            <CollapseRightIcon />
          </button>
        </div>
      </div>
      <div className="todo-list">
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
      )}
    </div>
  );
}
