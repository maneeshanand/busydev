# Todo Item Detail Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a detail view for todo items with editable title, notes, execution overrides, sub-tasks, and @alias support.

**Architecture:** TodoPanel gains internal `selectedTodoId` state. When set, it renders a new TodoDetailView component in-place. Detail view updates flow through an `onUpdateTodo` callback to App.tsx which patches the todo in the active session. Execution overrides are applied at run time in the `onRunTodos` and auto-play handlers.

**Tech Stack:** React, TypeScript, Vitest, CSS

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/types.ts` | Add `SubTask` interface, extend `TodoItem` with `notes`, `agent`, `model`, `subtasks` |
| Modify | `src/lib/settings.ts:130-142` | Extend `sanitizeTodoItem` to preserve new fields |
| Modify | `src/lib/settings.test.ts` | Add persistence tests for new TodoItem fields |
| Create | `src/components/TodoDetailView.tsx` | Detail view component |
| Create | `src/components/TodoDetailView.css` | Detail view styles |
| Modify | `src/components/TodoPanel.tsx` | Add `selectedTodoId` state, hover styles, click→detail, `onUpdateTodo` prop |
| Modify | `src/components/TodoPanel.css` | Hover highlight + arrow styles |
| Modify | `src/App.tsx` | Add `handleUpdateTodo`, wire execution overrides + @alias expansion in run handlers |

---

### Task 1: Data model + persistence

**Files:**
- Modify: `src/types.ts:49-56`
- Modify: `src/lib/settings.ts:130-142`
- Test: `src/lib/settings.test.ts`

- [ ] **Step 1: Write failing test for new TodoItem fields**

```typescript
// In src/lib/settings.test.ts, add inside the migrateStoredSettings describe block:

it("preserves TodoItem notes, agent, model, and subtasks through save/load", () => {
  const migrated = migrateStoredSettings({
    projects: [{
      id: "p1", name: "P", path: "/tmp/p", createdAt: Date.now(),
      activeSessionId: "s1",
      sessions: [{
        id: "s1", projectId: "p1", name: "S1", createdAt: Date.now(),
        runs: [],
        todos: [{
          id: "t1", text: "Do thing", done: false, source: "user", createdAt: 1,
          notes: "Use @shipit pattern",
          agent: "claude",
          model: "claude-opus-4-6",
          subtasks: [
            { id: "st1", text: "Step A", done: true },
            { id: "st2", text: "Step B", done: false },
          ],
        }],
      }],
    }],
  });

  const todo = migrated!.projects[0].sessions[0].todos[0];
  expect(todo.notes).toBe("Use @shipit pattern");
  expect(todo.agent).toBe("claude");
  expect(todo.model).toBe("claude-opus-4-6");
  expect(todo.subtasks).toHaveLength(2);
  expect(todo.subtasks![0]).toEqual({ id: "st1", text: "Step A", done: true });
  expect(todo.subtasks![1]).toEqual({ id: "st2", text: "Step B", done: false });
});

it("defaults new TodoItem fields to undefined when not set", () => {
  const migrated = migrateStoredSettings({
    projects: [{
      id: "p1", name: "P", path: "/tmp/p", createdAt: Date.now(),
      activeSessionId: "s1",
      sessions: [{
        id: "s1", projectId: "p1", name: "S1", createdAt: Date.now(),
        runs: [], todos: [{ id: "t1", text: "Plain", done: false, source: "user", createdAt: 1 }],
      }],
    }],
  });

  const todo = migrated!.projects[0].sessions[0].todos[0];
  expect(todo.notes).toBeUndefined();
  expect(todo.agent).toBeUndefined();
  expect(todo.model).toBeUndefined();
  expect(todo.subtasks).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/settings.test.ts`
Expected: FAIL — `notes`, `agent`, `model`, `subtasks` not on TodoItem type

- [ ] **Step 3: Update types.ts**

Add `SubTask` interface before `TodoItem` and extend `TodoItem`:

```typescript
// src/types.ts — add before TodoItem interface:
export interface SubTask {
  id: string;
  text: string;
  done: boolean;
}

// Extend TodoItem with:
  notes?: string;
  agent?: string;
  model?: string;
  subtasks?: SubTask[];
```

- [ ] **Step 4: Update sanitizeTodoItem in settings.ts**

In `src/lib/settings.ts`, function `sanitizeTodoItem` (line 130), add after `completedAt`:

```typescript
    notes: typeof obj.notes === "string" ? obj.notes : undefined,
    agent: typeof obj.agent === "string" && obj.agent.trim() ? obj.agent.trim() : undefined,
    model: typeof obj.model === "string" && obj.model.trim() ? obj.model.trim() : undefined,
    subtasks: Array.isArray(obj.subtasks)
      ? obj.subtasks
          .map((st: unknown) => {
            const s = asObject(st);
            if (!s) return null;
            const text = typeof s.text === "string" ? s.text.trim() : "";
            if (!text) return null;
            return { id: typeof s.id === "string" ? s.id : makeId(), text, done: toBoolean(s.done, false) };
          })
          .filter(Boolean) as SubTask[]
      : undefined,
```

Also add `SubTask` to the import from types.ts.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/settings.test.ts`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/lib/settings.ts src/lib/settings.test.ts
git commit -m "feat(todo): extend TodoItem with notes, agent, model, subtasks"
```

---

### Task 2: TodoDetailView component

**Files:**
- Create: `src/components/TodoDetailView.tsx`
- Create: `src/components/TodoDetailView.css`

- [ ] **Step 1: Create TodoDetailView.tsx**

```typescript
// src/components/TodoDetailView.tsx
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
            {(todo.agent === "claude" ? ["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5"] : ["codex-mini", "o3", "o4-mini"]).map((m) => (
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
```

- [ ] **Step 2: Create TodoDetailView.css**

```css
/* src/components/TodoDetailView.css */
.todo-detail {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
}

.todo-detail-back {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--vp-c-divider);
}

.todo-detail-back button {
  background: transparent;
  border: none;
  color: var(--vp-c-brand-1);
  cursor: pointer;
  font-size: 0.8rem;
  padding: 0;
}

.todo-detail-pos {
  color: var(--vp-c-text-3);
  font-size: 0.7rem;
}

.todo-detail-title {
  padding: 10px 12px;
  border-bottom: 1px solid var(--vp-c-divider);
}

.todo-detail-title-text {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
  cursor: text;
  display: block;
}

.todo-detail-title-input {
  width: 100%;
  font-size: 0.95rem;
  font-weight: 600;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-brand-3);
  border-radius: 2px;
  color: var(--vp-c-text-1);
  padding: 2px 6px;
  font-family: inherit;
}

.todo-detail-meta {
  font-size: 0.68rem;
  color: var(--vp-c-text-3);
  margin-top: 2px;
}

.todo-detail-section {
  padding: 8px 12px;
  border-bottom: 1px solid var(--vp-c-divider);
}

.todo-detail-label {
  font-size: 0.7rem;
  color: var(--vp-c-text-3);
  display: block;
  margin-bottom: 4px;
}

.todo-detail-notes {
  width: 100%;
  min-height: 40px;
  resize: vertical;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 2px;
  color: var(--vp-c-text-1);
  padding: 6px 8px;
  font-size: 0.8rem;
  font-family: inherit;
}

.todo-detail-exec {
  display: flex;
  gap: 6px;
}

.todo-detail-exec select {
  flex: 1;
  background: var(--vp-c-bg-mute);
  border: none;
  border-radius: 2px;
  color: var(--vp-c-text-2);
  padding: 4px 8px;
  font-size: 0.78rem;
  font-family: inherit;
}

.todo-detail-hint {
  font-size: 0.65rem;
  color: var(--vp-c-text-3);
  margin-top: 4px;
  display: block;
}

.todo-detail-subtasks {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.todo-detail-subtask {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 0;
  font-size: 0.78rem;
  color: var(--vp-c-text-1);
}

.todo-detail-subtask.is-done .todo-detail-subtask-text {
  text-decoration: line-through;
  color: var(--vp-c-text-3);
}

.todo-detail-subtask input[type="checkbox"] {
  width: 14px;
  height: 14px;
  accent-color: var(--vp-c-brand-1);
}

.todo-detail-subtask-text {
  flex: 1;
}

.todo-detail-subtask-delete {
  background: transparent;
  border: none;
  color: var(--vp-c-text-3);
  cursor: pointer;
  font-size: 12px;
  opacity: 0;
  padding: 0;
}

.todo-detail-subtask:hover .todo-detail-subtask-delete {
  opacity: 1;
}

.todo-detail-subtask-add input {
  width: 100%;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 2px;
  color: var(--vp-c-text-1);
  padding: 4px 8px;
  font-size: 0.75rem;
  font-family: inherit;
  margin-top: 4px;
}
```

- [ ] **Step 3: Verify compile**

Run: `npx tsc --noEmit`
Expected: PASS (component not imported yet, but types should be clean)

- [ ] **Step 4: Commit**

```bash
git add src/components/TodoDetailView.tsx src/components/TodoDetailView.css
git commit -m "feat(todo): add TodoDetailView component"
```

---

### Task 3: Wire TodoPanel → TodoDetailView

**Files:**
- Modify: `src/components/TodoPanel.tsx`
- Modify: `src/components/TodoPanel.css`

- [ ] **Step 1: Add props and state to TodoPanel**

In `TodoPanel.tsx`:
- Add prop: `onUpdateTodo?: (id: string, updates: Partial<TodoItem>) => void`
- Add state: `const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null)`
- Import `TodoDetailView`

- [ ] **Step 2: Render TodoDetailView when selected**

At the top of the expanded panel rendering, before the list, add:

```typescript
if (selectedTodoId) {
  const todoIndex = todos.findIndex((t) => t.id === selectedTodoId);
  const selectedTodo = todos[todoIndex];
  if (selectedTodo && onUpdateTodo) {
    return (
      <TodoDetailView
        todo={selectedTodo}
        index={todoIndex}
        total={todos.length}
        onBack={() => setSelectedTodoId(null)}
        onUpdate={onUpdateTodo}
      />
    );
  }
  setSelectedTodoId(null);
}
```

- [ ] **Step 3: Add click handler to todo items**

On each todo item `<div>`, add `onClick={() => setSelectedTodoId(item.id)}`.
Keep existing `onDoubleClick` for inline edit.

- [ ] **Step 4: Add hover styles to TodoPanel.css**

```css
.todo-item-clickable {
  cursor: pointer;
  border-left: 2px solid transparent;
  transition: border-color 0.1s, background 0.1s;
}

.todo-item-clickable:hover {
  border-left-color: var(--vp-c-brand-1);
}

.todo-item-arrow {
  margin-left: auto;
  color: var(--vp-c-text-3);
  font-size: 10px;
  opacity: 0;
}

.todo-item-clickable:hover .todo-item-arrow {
  opacity: 1;
}
```

Add `→` arrow span to each todo item and `todo-item-clickable` class.

- [ ] **Step 5: Verify compile + test**

Run: `npx tsc --noEmit && npx vitest run`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/TodoPanel.tsx src/components/TodoPanel.css
git commit -m "feat(todo): wire TodoDetailView into TodoPanel with hover + click"
```

---

### Task 4: Wire App.tsx — onUpdateTodo + execution overrides

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add handleUpdateTodo handler**

In App.tsx, near the other todo handlers:

```typescript
function handleUpdateTodo(id: string, updates: Partial<TodoItem>) {
  setTodos((prev) => prev.map((t) => t.id === id ? { ...t, ...updates } : t));
}
```

- [ ] **Step 2: Pass onUpdateTodo to TodoPanel**

Add `onUpdateTodo={handleUpdateTodo}` to the `<TodoPanel>` props.

- [ ] **Step 3: Wire execution overrides in onRunTodos**

In the `onRunTodos` callback (around line 2349), look up the todo being run and apply overrides:

```typescript
onRunTodos={() => {
  const nextTodo = todos.find((t) => !t.done);
  if (!nextTodo) return;
  const idx = todos.indexOf(nextTodo);
  const todoAgent = nextTodo.agent || agent;
  const todoModel = nextTodo.model || model;
  // Build prompt with notes context
  let todoPrompt = `Work on todo #${idx + 1}: ${nextTodo.text}`;
  if (nextTodo.notes) {
    const expandedNotes = expandPromptAliases(nextTodo.notes, aliasMap);
    todoPrompt += `\n\nContext: ${expandedNotes}`;
  }
  todoPrompt += `\n\nComplete this single item and mark it done with DONE: ${idx + 1}`;
  void handleRun(todoPrompt, { agentOverride: todoAgent, modelOverride: todoModel });
}}
```

Note: `handleRun` will need to accept optional overrides. Add an optional second param:
```typescript
async function handleRun(overridePrompt?: string, overrides?: { agentOverride?: string; modelOverride?: string }) {
```

And use `overrides?.agentOverride ?? agent` and `overrides?.modelOverride ?? model` when building the `runCodexExec` call.

- [ ] **Step 4: Wire execution overrides in auto-play continuation**

In the auto-play callback (around line 1744), apply the same pattern — look up `decision.nextTodo.agent`, `decision.nextTodo.model`, and `decision.nextTodo.notes`.

- [ ] **Step 5: Build aliasMap and pass to handlers**

Near the top of the App component, after `promptLibrary` state:

```typescript
const aliasMap = useMemo(() => buildAliasMap(promptLibrary), [promptLibrary]);
```

Import `buildAliasMap` and `expandPromptAliases` from `src/lib/promptAliases.ts`.

- [ ] **Step 6: Verify compile + test**

Run: `npx tsc --noEmit && npx vitest run`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "feat(todo): wire execution overrides and @alias expansion for todo runs"
```

---

## Verification Checklist

1. `npx tsc --noEmit` — compiles
2. `npx vitest run` — all tests pass
3. `cargo tauri dev`:
   - Hover todo item → blue left border + → arrow
   - Click → detail view replaces list
   - Edit title (click → input → Enter saves)
   - Add notes → persists after session switch
   - Set agent/model override → uses those when running
   - Add sub-tasks → toggle independently
   - Back button → returns to list
   - Restart app → all detail fields preserved
   - `@alias` in notes → expanded in agent prompt
