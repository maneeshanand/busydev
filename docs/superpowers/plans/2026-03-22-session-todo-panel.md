# Session & Todo Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 3-column layout with a collapsible left session history panel and a collapsible right todo panel, both resizable with drag handles that collapse to icon strips at minimum size.

**Architecture:** Refactor the single-column `.container` into a horizontal 3-column flex layout. Extract the main chat area into its own column. Add new `SessionPanel` (left) and `TodoPanel` (right) components. Session model wraps existing `PersistedRun[]` with an ID and timestamp. Todos are simple `{ id, text, done }` items stored per session. All persistence stays in tauri-plugin-store.

**Tech Stack:** React 18, TypeScript, Tauri 2, tauri-plugin-store, CSS custom properties

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/App.tsx` | Modify | Refactor layout to 3-column, add session/todo state, wire panels |
| `src/App.css` | Modify | 3-column layout, panel styles, resize handle, icon strip |
| `src/components/SessionPanel.tsx` | Create | Left panel: session list, collapsed icon strip |
| `src/components/SessionPanel.css` | Create | Session panel styles |
| `src/components/TodoPanel.tsx` | Create | Right panel: todo CRUD, collapsed icon strip |
| `src/components/TodoPanel.css` | Create | Todo panel styles |
| `src/components/ResizeHandle.tsx` | Create | Draggable vertical resize handle |
| `src/components/ResizeHandle.css` | Create | Resize handle styles |
| `src/types.ts` | Create | Shared types: Session, TodoItem, PersistedRun, StreamRow, etc. |

---

### Task 1: Extract shared types to `src/types.ts`

**Files:**
- Create: `src/types.ts`
- Modify: `src/App.tsx` (remove type definitions, import from types.ts)

- [ ] **Step 1: Create types.ts with all existing interfaces + new Session/Todo types**

```typescript
// src/types.ts
import type { CodexExecOutput } from "./invoke";

export type EventCategory = "message" | "command" | "file_change" | "status" | "error";

export interface StreamRow {
  id: number;
  category: EventCategory;
  text: string;
  command?: string;
  exitCode?: number | null;
  status?: "running" | "done" | "failed";
  filePaths?: string[];
  hidden?: boolean;
}

export interface RunEntry {
  id: number;
  prompt: string;
  output: CodexExecOutput;
  streamRows: StreamRow[];
  stopped?: boolean;
}

export interface PersistedRun {
  id: number;
  prompt: string;
  streamRows: StreamRow[];
  exitCode: number | null;
  durationMs: number;
  finalSummary: string;
  stopped?: boolean;
}

export interface InFlightRun {
  id: number;
  runId: string;
  prompt: string;
  streamRows: StreamRow[];
}

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  source: "user" | "agent";
  createdAt: number;
}

export interface Session {
  id: string;
  startedAt: number;
  runs: PersistedRun[];
  todos: TodoItem[];
}
```

- [ ] **Step 2: Update App.tsx to import types from types.ts**

Remove the `EventCategory`, `StreamRow`, `RunEntry`, `PersistedRun`, `InFlightRun` definitions from App.tsx. Add:
```typescript
import type { StreamRow, RunEntry, PersistedRun, InFlightRun, Session, TodoItem } from "./types";
```

- [ ] **Step 3: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/App.tsx
git commit -m "refactor(ui): extract shared types to src/types.ts"
```

---

### Task 2: Create ResizeHandle component

**Files:**
- Create: `src/components/ResizeHandle.tsx`
- Create: `src/components/ResizeHandle.css`

- [ ] **Step 1: Create ResizeHandle.tsx**

```typescript
// src/components/ResizeHandle.tsx
import { useCallback, useRef } from "react";
import "./ResizeHandle.css";

interface ResizeHandleProps {
  onResize: (deltaX: number) => void;
  onResizeEnd: () => void;
  side: "left" | "right";
}

export function ResizeHandle({ onResize, onResizeEnd, side }: ResizeHandleProps) {
  const startXRef = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startXRef.current = e.clientX;

      const handleMouseMove = (e: MouseEvent) => {
        const delta = e.clientX - startXRef.current;
        startXRef.current = e.clientX;
        onResize(delta);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        onResizeEnd();
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [onResize, onResizeEnd]
  );

  return (
    <div
      className={`resize-handle resize-handle-${side}`}
      onMouseDown={handleMouseDown}
    />
  );
}
```

- [ ] **Step 2: Create ResizeHandle.css**

```css
/* src/components/ResizeHandle.css */
.resize-handle {
  width: 6px;
  cursor: col-resize;
  flex-shrink: 0;
  position: relative;
  z-index: 10;
}

.resize-handle::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 2px;
  height: 32px;
  border-radius: 1px;
  background: var(--vp-c-divider);
  transition: background 0.15s, height 0.15s;
}

.resize-handle:hover::after,
.resize-handle:active::after {
  background: var(--vp-c-brand-3);
  height: 48px;
}
```

- [ ] **Step 3: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/ResizeHandle.tsx src/components/ResizeHandle.css
git commit -m "feat(ui): add ResizeHandle component"
```

---

### Task 3: Create SessionPanel component

**Files:**
- Create: `src/components/SessionPanel.tsx`
- Create: `src/components/SessionPanel.css`

- [ ] **Step 1: Create SessionPanel.tsx**

```typescript
// src/components/SessionPanel.tsx
import type { Session } from "../types";
import "./SessionPanel.css";

interface SessionPanelProps {
  sessions: Session[];
  activeSessionId: string;
  collapsed: boolean;
  onSelectSession: (id: string) => void;
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 7v5l3 3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
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
```

- [ ] **Step 2: Create SessionPanel.css**

```css
/* src/components/SessionPanel.css */
.session-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  overflow: hidden;
}

.session-panel-collapsed {
  align-items: center;
  padding-top: 12px;
}

.session-panel-icon {
  color: var(--vp-c-text-3);
  padding: 6px;
}

.session-panel-icon svg {
  width: 18px;
  height: 18px;
}

.session-panel-header {
  padding: 10px 12px 6px;
  border-bottom: 1px solid var(--vp-c-divider);
}

.session-panel-header h3 {
  font-size: 0.76rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--vp-c-text-3);
  margin: 0;
}

.session-panel-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
}

.session-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  border-radius: 8px;
  background: transparent;
  border: 1px solid transparent;
  cursor: pointer;
  font-family: inherit;
}

.session-item:hover {
  background: var(--vp-c-bg-soft);
  border-color: var(--vp-c-divider);
  color: var(--vp-c-text-1);
}

.session-item-active {
  background: var(--vp-c-bg-soft);
  border-color: var(--vp-c-brand-3);
}

.session-item-time {
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--vp-c-text-1);
}

.session-item-meta {
  font-size: 0.7rem;
  color: var(--vp-c-text-3);
}

.session-empty {
  padding: 12px;
  font-size: 0.78rem;
  color: var(--vp-c-text-3);
  text-align: center;
}
```

- [ ] **Step 3: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/SessionPanel.tsx src/components/SessionPanel.css
git commit -m "feat(ui): add SessionPanel component with collapsed icon strip"
```

---

### Task 4: Create TodoPanel component

**Files:**
- Create: `src/components/TodoPanel.tsx`
- Create: `src/components/TodoPanel.css`

- [ ] **Step 1: Create TodoPanel.tsx**

```typescript
// src/components/TodoPanel.tsx
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
        {todos.length > 0 && (
          <span className="todo-progress">{doneCount}/{todos.length}</span>
        )}
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
```

- [ ] **Step 2: Create TodoPanel.css**

```css
/* src/components/TodoPanel.css */
.todo-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  overflow: hidden;
}

.todo-panel-collapsed {
  align-items: center;
  padding-top: 12px;
  gap: 8px;
}

.todo-panel-icon {
  color: var(--vp-c-text-3);
  padding: 6px;
}

.todo-panel-icon svg {
  width: 18px;
  height: 18px;
}

.todo-panel-badge {
  font-size: 0.66rem;
  color: var(--vp-c-text-3);
  font-family: var(--vp-font-family-mono);
}

.todo-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px 6px;
  border-bottom: 1px solid var(--vp-c-divider);
}

.todo-panel-header h3 {
  font-size: 0.76rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--vp-c-text-3);
  margin: 0;
}

.todo-progress {
  font-size: 0.7rem;
  color: var(--vp-c-text-3);
  font-family: var(--vp-font-family-mono);
}

.todo-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
}

.todo-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  min-height: 32px;
}

.todo-item:hover {
  background: var(--vp-c-bg-soft);
}

.todo-item:hover .todo-delete {
  opacity: 1;
}

.todo-checkbox {
  flex-shrink: 0;
  width: 15px;
  height: 15px;
  cursor: pointer;
  accent-color: var(--vp-c-brand-1);
}

.todo-bullet {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1.5px solid var(--vp-c-text-3);
}

.todo-bullet-done {
  background: var(--ev-success);
  border-color: var(--ev-success);
}

.todo-text {
  flex: 1;
  font-size: 0.8rem;
  color: var(--vp-c-text-1);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.todo-item-done .todo-text {
  text-decoration: line-through;
  color: var(--vp-c-text-3);
}

.todo-edit-input {
  flex: 1;
  font-size: 0.8rem;
  padding: 2px 6px;
  border: 1px solid var(--vp-c-brand-3);
  border-radius: 4px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-family: inherit;
  outline: none;
}

.todo-delete {
  opacity: 0;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  padding: 0;
  font-size: 0.9rem;
  border: none;
  background: transparent;
  color: var(--vp-c-text-3);
  cursor: pointer;
  border-radius: 4px;
  transition: opacity 0.1s;
}

.todo-delete:hover {
  color: var(--ev-error-accent);
  background: var(--ev-error-bg);
}

.todo-add {
  display: flex;
  gap: 6px;
  padding: 8px;
  border-top: 1px solid var(--vp-c-divider);
}

.todo-add-input {
  flex: 1;
  font-size: 0.78rem;
  padding: 6px 8px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  font-family: inherit;
}

.todo-add-input::placeholder {
  color: var(--vp-c-text-3);
}

.todo-add-button {
  width: 28px;
  height: 28px;
  padding: 0;
  font-size: 1.1rem;
  border-radius: 6px;
  background: var(--vp-c-brand-1);
  border: 1px solid var(--vp-c-brand-2);
  color: #fff;
  cursor: pointer;
}

.todo-add-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.todo-add-button:hover:not(:disabled) {
  background: var(--vp-c-brand-2);
}
```

- [ ] **Step 3: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/TodoPanel.tsx src/components/TodoPanel.css
git commit -m "feat(ui): add TodoPanel component with CRUD and collapsed icon strip"
```

---

### Task 5: Refactor App.tsx to 3-column layout with session model

**Files:**
- Modify: `src/App.tsx` (layout refactor, session state, panel wiring)
- Modify: `src/App.css` (3-column layout, remove max-width constraint)

This is the largest task. It connects everything.

- [ ] **Step 1: Update App.css — replace single-column with 3-column layout**

Replace `.container` styles:
```css
.container {
  height: 100%;
  display: flex;
  flex-direction: row;
  gap: 0;
}

.main-column {
  flex: 1;
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 1120px;
  padding: 12px 0;
}

.side-panel-left {
  width: var(--left-panel-width, 220px);
  min-width: 42px;
  flex-shrink: 0;
  padding: 12px 0 12px 12px;
}

.side-panel-right {
  width: var(--right-panel-width, 280px);
  min-width: 42px;
  flex-shrink: 0;
  padding: 12px 12px 12px 0;
}

.side-panel-left.is-collapsed {
  width: 42px;
}

.side-panel-right.is-collapsed {
  width: 42px;
}
```

- [ ] **Step 2: Update App.tsx — add session model, panel state, and 3-column JSX**

Key state additions:
```typescript
const [sessions, setSessions] = useState<Session[]>([]);
const [activeSessionId, setActiveSessionId] = useState<string>("");
const [todos, setTodos] = useState<TodoItem[]>([]);
const [todoMode, setTodoMode] = useState(false);
const [leftPanelWidth, setLeftPanelWidth] = useState(220);
const [rightPanelWidth, setRightPanelWidth] = useState(280);
const [leftCollapsed, setLeftCollapsed] = useState(true);
const [rightCollapsed, setRightCollapsed] = useState(true);
```

On mount: create a new session with `id: crypto.randomUUID()` and `startedAt: Date.now()`. Load previous sessions from store.

JSX layout becomes:
```tsx
<div className="container">
  <div className={`side-panel-left ${leftCollapsed ? "is-collapsed" : ""}`}
       style={leftCollapsed ? undefined : { width: leftPanelWidth }}>
    <SessionPanel ... />
  </div>
  {!leftCollapsed && <ResizeHandle side="left" onResize={...} onResizeEnd={...} />}

  <div className="main-column">
    {/* existing: header, directory bar, stream panel, bottom panel */}
  </div>

  {!rightCollapsed && <ResizeHandle side="right" onResize={...} onResizeEnd={...} />}
  <div className={`side-panel-right ${rightCollapsed ? "is-collapsed" : ""}`}
       style={rightCollapsed ? undefined : { width: rightPanelWidth }}>
    <TodoPanel ... />
  </div>
</div>
```

Add todo mode toggle button in `.app-header` (checklist icon, upper-right before theme toggle).

Clicking the collapsed icon strip expands the panel. Resize handles control width. Panel widths + todoMode persisted in store.

- [ ] **Step 3: Update persistence — save/load sessions**

Update the store save to persist:
```typescript
{
  // existing settings...
  sessions: allSessions,       // previous + current
  todoMode,
  leftPanelWidth,
  rightPanelWidth,
}
```

On load, restore sessions array. The current session's runs come from `restoredRuns` (now mapped into the active session). Previous sessions populate the left panel.

- [ ] **Step 4: Wire todo CRUD handlers**

```typescript
function handleAddTodo(text: string) {
  const item: TodoItem = {
    id: crypto.randomUUID(),
    text,
    done: false,
    source: "user",
    createdAt: Date.now(),
  };
  setTodos((prev) => [...prev, item]);
}

function handleToggleTodo(id: string) {
  setTodos((prev) => prev.map((t) => t.id === id ? { ...t, done: !t.done } : t));
}

function handleDeleteTodo(id: string) {
  setTodos((prev) => prev.filter((t) => t.id !== id));
}

function handleEditTodo(id: string, text: string) {
  setTodos((prev) => prev.map((t) => t.id === id ? { ...t, text } : t));
}
```

- [ ] **Step 5: Wire session selection**

When a past session is selected: load its runs into the stream panel (read-only) and its todos into the todo panel (read-only). When the active session is selected: switch back to live mode.

- [ ] **Step 6: Verify full build passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/App.css
git commit -m "feat(ui): 3-column layout with session history and todo panel"
```

---

### Task 6: Polish and integration test

**Files:**
- Modify: `src/App.css` (dark mode tuning, mobile breakpoint)
- Modify: `src/App.tsx` (edge cases)

- [ ] **Step 1: Add mobile breakpoint**

At `@media (max-width: 900px)`: hide side panels entirely, only show main column with full padding.

- [ ] **Step 2: Tune dark mode for new panel styles**

Verify all new components use CSS custom properties that already have dark mode overrides. Add any missing overrides.

- [ ] **Step 3: Test end-to-end**

Run: `cargo tauri dev`

Verify:
- App launches with 3-column layout
- Left panel starts collapsed (icon strip)
- Clicking clock icon expands session list
- Right panel starts collapsed (icon strip)
- Toggling todo mode (checklist icon in header) expands right panel
- Resize handles work, panel widths persist on restart
- Adding/editing/deleting/toggling todos works
- Running a prompt populates the stream panel
- Restarting the app restores sessions, todos, panel widths
- Previous sessions are selectable and show read-only history
- Light and dark mode both look correct

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/App.css
git commit -m "feat(ui): polish 3-column layout, dark mode, mobile breakpoint"
```

---

## Verification

1. `npx tsc --noEmit` — no type errors at each step
2. `cargo tauri dev` — full app test after Task 5
3. Manual checks: resize panels, toggle todo mode, restart app, switch sessions, light/dark mode
