import { useState } from "react";
import { Rocket } from "@carbon/icons-react";
import type { TodoItem, BusyAgent, TodoArchive } from "../types";
import { TodoDetailView } from "./TodoDetailView";

import "./TodoPanel.css";

interface TodoPanelProps {
  todos: TodoItem[];
  collapsed: boolean;
  readonly?: boolean;
  canRun?: boolean;
  running?: boolean;
  todoMode?: boolean;
  autoPlay?: boolean;
  onAdd: (text: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, text: string) => void;
  onRunTodos?: () => void;
  onStopTodos?: () => void;
  onGenerateTodos?: (goal: string) => void;
  onClearTodos?: () => void;
  onSaveTodos?: () => void;
  onToggleAutoPlay?: () => void;
  onToggleTodoMode?: () => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onUpdateTodo?: (id: string, updates: Partial<TodoItem>) => void;
  busyAgents?: BusyAgent[];
  onArchiveTodos?: () => void;
  onDeleteArchive?: (archiveId: string) => void;
  onLoadPlan?: () => void;
  todoArchives?: TodoArchive[];
}

type TabId = "execution" | "todo" | "archives";

function SkipIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 5v14l11-7z" fill="currentColor" />
      <rect x="17" y="5" width="3" height="14" fill="currentColor" />
    </svg>
  );
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

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="12" height="12">
      <path d="M20 6L9 17L4 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="12" height="12">
      <path d="M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChecklistIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="12" height="12">
      <path d="M9 7h10M9 12h10M9 17h10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4.5 7.5l1 1 2-2M4.5 12.5l1 1 2-2M4.5 17.5l1 1 2-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="12" height="12">
      <rect x="2" y="3" width="20" height="5" rx="1" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M4 8v10a2 2 0 002 2h12a2 2 0 002-2V8" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M10 12h4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function TodoPanel({
  todos,
  collapsed: _collapsed,
  readonly,
  onAdd,
  onToggle,
  onDelete,
  onEdit,
  onRunTodos,
  onStopTodos,
  onGenerateTodos,
  onClearTodos,
  onSaveTodos: _onSaveTodos,
  onToggleAutoPlay,
  onToggleTodoMode,
  canRun,
  running,
  todoMode,
  autoPlay,
  onReorder,
  onUpdateTodo,
  busyAgents,
  onArchiveTodos,
  onDeleteArchive,
  onLoadPlan,
  todoArchives,
}: TodoPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("execution");
  const [newText, setNewText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [goalInput, setGoalInput] = useState("");
  const [, setShowGoalInput] = useState(false);
  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);

  const doneCount = todos.filter((t) => t.done).length;
  const pending = todos.filter((t) => !t.done);
  const currentTask = pending[0];
  const progressPercent = todos.length > 0 ? (doneCount / todos.length) * 100 : 0;

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

  if (selectedTodoId && onUpdateTodo) {
    const todoIndex = todos.findIndex((t) => t.id === selectedTodoId);
    const selectedTodo = todos[todoIndex];
    if (selectedTodo) {
      return (
        <TodoDetailView
          todo={selectedTodo}
          index={todoIndex}
          total={todos.length}
          onBack={() => setSelectedTodoId(null)}
          onUpdate={onUpdateTodo}
          busyAgents={busyAgents ?? []}
        />
      );
    }
    setSelectedTodoId(null);
  }

  const renderExecutionView = () => (
    <div className="execution-view">
      {!readonly && pending.length > 0 && (
        <div className={`todo-player execution-player ${!todoMode ? "todo-player-disabled" : ""}`}>
          <button
            type="button"
            className={`todo-player-btn todo-player-mode ${todoMode ? "todo-player-mode-on" : ""}`}
            onClick={onToggleTodoMode}
            title={todoMode ? "Disable todo mode" : "Enable todo mode"}
          >
            <ChecklistIcon />
          </button>
          {running ? (
            <button type="button" className="todo-player-btn todo-player-stop" onClick={onStopTodos} disabled={!todoMode} title={todoMode ? "Stop" : "Enable todo mode to use player"}>
              <PauseIcon />
            </button>
          ) : (
            <button type="button" className="todo-player-btn todo-player-play" onClick={onRunTodos} disabled={!todoMode || !canRun} title={todoMode ? "Run next todo" : "Enable todo mode to use player"}>
              <PlayIcon />
            </button>
          )}
          <button
            type="button"
            className={`todo-player-btn ${autoPlay ? "todo-player-active" : ""}`}
            onClick={onToggleAutoPlay}
            disabled={!todoMode}
            title={!todoMode ? "Enable todo mode to use auto-play" : autoPlay ? "Auto-play ON" : "Auto-play OFF"}
          >
            <SkipIcon />
          </button>
          <span className="todo-player-status">
            {!todoMode ? "Mode off" : running ? "Running..." : `${pending.length} left`}
          </span>
        </div>
      )}

      <div className="status-banner">
        <div className="status-banner-indicator" />
        <div className="status-banner-content">
          <div className="status-banner-title">
            {running ? "Agent running" : doneCount === todos.length && todos.length > 0 ? "Completed" : "Idle"}
          </div>
          <div className="status-banner-subtitle">
            {running && todoMode && currentTask ? currentTask.text : doneCount === todos.length && todos.length > 0 ? "All tasks finished" : "Waiting to start"}
          </div>
        </div>
      </div>

      <div className="section-label">PROGRESS</div>
      <div className="progress-container">
        <div className="progress-header">
          <span className="progress-title">Task completion</span>
          <span className="progress-stats">{doneCount} / {todos.length}</span>
        </div>
        <div className="progress-bar-bg">
          <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <div className="section-label">QUEUE</div>
      <div className="queue-list">
        {todos.map((todo) => {
          const isCurrent = running && todoMode && todo.id === currentTask?.id;
          return (
            <div key={todo.id} className="queue-item">
              <div className={`queue-icon-wrapper ${todo.done ? "is-done" : isCurrent ? "is-running" : "is-pending"}`}>
                {todo.done ? <CheckIcon /> : isCurrent ? <span className="queue-progress-spinner" /> : <MinusIcon />}
              </div>
              <div className="queue-item-content">
                <div className="queue-item-title">{todo.text}</div>
                <div className="queue-item-subtitle">
                  {todo.done ? "Completed" : isCurrent ? "Edit — in progress" : "Pending"}
                </div>
              </div>
            </div>
          );
        })}
        {todos.length === 0 && (
          <div className="queue-empty">No tasks in queue</div>
        )}
      </div>
    </div>
  );

  const renderTodoView = () => (
    <div className="todo-list-view">
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
              <button type="button" className="todo-goal-go" onClick={handleGenerate} disabled={!goalInput.trim() || !canRun} title="Generate">
                <Rocket size={16} />
              </button>
            </div>
            {onLoadPlan && (
              <button type="button" className="todo-load-plan" onClick={onLoadPlan} disabled={!canRun}>
                Load Plan (.md)
              </button>
            )}
          </div>
        )}
        {todos.length > 0 && !readonly && (
          <div className="todo-actions-bar">
            {onLoadPlan && (
              <button type="button" className="todo-action-btn" onClick={onLoadPlan} disabled={!canRun} title="Load plan from markdown">
                Load Plan
              </button>
            )}
            {onArchiveTodos && (
              <button type="button" className="todo-action-btn" onClick={onArchiveTodos} title="Archive current todos">
                <ArchiveIcon /> Archive
              </button>
            )}
            {onClearTodos && (
              <button type="button" className="todo-action-btn todo-action-danger" onClick={onClearTodos} title="Clear all todos">
                Clear
              </button>
            )}
          </div>
        )}
        {todos.map((item, index) => (
          <div
            key={item.id}
            className={`todo-item todo-item-clickable ${item.done ? "todo-item-done" : ""} ${dragOverIndex === index ? "todo-item-dragover" : ""} ${dragFromIndex === index ? "todo-item-dragging" : ""}`}
            onClick={() => setSelectedTodoId(item.id)}
            onMouseEnter={() => {
              if (dragFromIndex !== null && dragFromIndex !== index && !item.done) {
                setDragOverIndex(index);
              }
            }}
            onMouseUp={() => {
              if (dragFromIndex !== null && dragFromIndex !== index && onReorder && !item.done) {
                onReorder(dragFromIndex, index);
              }
              setDragFromIndex(null);
              setDragOverIndex(null);
            }}
          >
            {!readonly && !item.done && (
              <span
                className="todo-drag-handle"
                title="Drag to reorder"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setDragFromIndex(index);
                  const handleUp = () => {
                    setDragFromIndex(null);
                    setDragOverIndex(null);
                    window.removeEventListener("mouseup", handleUp);
                  };
                  window.addEventListener("mouseup", handleUp);
                }}
              >
                ⠿
              </span>
            )}
            {!readonly && (
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => onToggle(item.id)}
                className="todo-checkbox"
              />
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
                onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                title="Delete"
              >
                ×
              </button>
            )}
            <span className="todo-item-arrow">&rarr;</span>
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
        </div>
      )}
    </div>
  );

  const renderArchivesView = () => {
    const archives = todoArchives ?? [];
    return (
      <div className="archives-view">
        {archives.length === 0 ? (
          <div className="queue-empty">No archives yet</div>
        ) : (
          <div className="archives-list">
            {[...archives].reverse().map((archive) => (
              <details key={archive.id} className="archive-entry">
                <summary className="archive-summary">
                  <span className="archive-name">{archive.name}</span>
                  <span className="archive-meta">
                    {archive.todos.filter((t) => t.done).length}/{archive.todos.length} done
                  </span>
                  {onDeleteArchive && (
                    <button
                      type="button"
                      className="archive-delete"
                      onClick={(e) => { e.preventDefault(); onDeleteArchive(archive.id); }}
                      title="Delete archive"
                    >
                      ×
                    </button>
                  )}
                </summary>
                <div className="archive-todos">
                  {archive.todos.map((todo) => (
                    <div key={todo.id} className={`queue-item ${todo.done ? "archive-done" : ""}`}>
                      <div className={`queue-icon-wrapper ${todo.done ? "is-done" : "is-pending"}`}>
                        {todo.done ? <CheckIcon /> : <MinusIcon />}
                      </div>
                      <div className="queue-item-content">
                        <div className="queue-item-title">{todo.text}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="todo-panel">
      <div className="todo-tabs">
        <button
          className={`todo-tab ${activeTab === "execution" ? "active" : ""}`}
          onClick={() => setActiveTab("execution")}
        >
          Execution
        </button>
        <button
          className={`todo-tab ${activeTab === "todo" ? "active" : ""}`}
          onClick={() => setActiveTab("todo")}
        >
          To-do
        </button>
        <button
          className={`todo-tab ${activeTab === "archives" ? "active" : ""}`}
          onClick={() => setActiveTab("archives")}
        >
          Archives
        </button>
      </div>

      <div className="todo-tab-content">
        {activeTab === "execution" ? renderExecutionView() : activeTab === "todo" ? renderTodoView() : renderArchivesView()}
      </div>
    </div>
  );
}
