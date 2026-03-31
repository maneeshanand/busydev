# Todo & Execution Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add clear-with-confirmation, load-plan-from-markdown, and session-scoped todo archives to the todo system.

**Architecture:** Three independent features wired into the existing TodoPanel + App.tsx handler pattern. Archives add a new type to Session, a third tab in TodoPanel, and sanitization in settings. Load plan reuses the existing `ADD_TODO:` agent pipeline with a file as input. Clear confirmation follows the existing `confirmTodoMode` dialog pattern.

**Tech Stack:** React, TypeScript, Tauri plugin-dialog/plugin-fs, Vitest

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/types.ts` | Add `TodoArchive` interface, add `todoArchives?` to `Session` |
| `src/App.tsx` | Add `confirmClearTodos` state, `handleArchiveTodos`, `handleDeleteArchive`, `handleLoadPlan` handlers; update `handleClearTodos` to auto-archive; wire new props to TodoPanel |
| `src/components/TodoPanel.tsx` | Add Archives tab, Load Plan button, archive button, clear confirmation wired via new props |
| `src/components/TodoPanel.css` | Styles for archive tab content |
| `src/lib/settings.ts` | Add `todoArchives` sanitization in `sanitizeSession` |
| `src/lib/settings.test.ts` | Tests for archive sanitization |

---

### Task 1: Add TodoArchive type and Session field

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add TodoArchive interface and Session field**

In `src/types.ts`, after the `TodoItem` interface (line 68), add:

```typescript
export interface TodoArchive {
  id: string;
  name: string;
  createdAt: number;
  todos: TodoItem[];
}
```

In the `Session` interface, after `autoPlay?: boolean;` (line 119), add:

```typescript
  todoArchives?: TodoArchive[];
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```
feat(types): add TodoArchive interface and Session.todoArchives field
```

---

### Task 2: Add settings sanitization for archives

**Files:**
- Modify: `src/lib/settings.ts`
- Modify: `src/lib/settings.test.ts`

- [ ] **Step 1: Add sanitizeTodoArchive function and wire into sanitizeSession**

In `src/lib/settings.ts`, add a `sanitizeTodoArchive` function near the existing `sanitizeTodoItem` function. It should validate `id` (string), `name` (string), `createdAt` (number), and `todos` (array of sanitized TodoItems). Return `null` for invalid archives.

In `sanitizeSession` (line 234), after the `autoPlay` line (252), add:

```typescript
    todoArchives: Array.isArray(obj?.todoArchives)
      ? obj.todoArchives.map(sanitizeTodoArchive).filter(Boolean) as TodoArchive[]
      : undefined,
```

Import `TodoArchive` from `../types`.

- [ ] **Step 2: Add test for archive sanitization**

In `src/lib/settings.test.ts`, add a test that verifies:
- Archives with valid data are preserved through save/load
- Archives with invalid data are filtered out
- Sessions without archives have `todoArchives` as undefined

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/lib/settings.test.ts`
Expected: All tests pass

- [ ] **Step 4: Commit**

```
feat(settings): add TodoArchive sanitization for session persistence
```

---

### Task 3: Add App.tsx handlers (archive, clear confirmation, load plan)

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add readTextFile import**

Add `readTextFile` to the existing `@tauri-apps/plugin-fs` import (line 4):

```typescript
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
```

- [ ] **Step 2: Add confirmClearTodos state**

Near the existing `confirmTodoMode` state (line 898), add:

```typescript
const [confirmClearTodos, setConfirmClearTodos] = useState(false);
```

- [ ] **Step 3: Add handleArchiveTodos function**

Near the existing todo handlers (after `handleClearTodos` at line 1267), add:

```typescript
function handleArchiveTodos() {
  if (todos.length === 0) return;
  const now = Date.now();
  const d = new Date(now);
  const name = `Archive — ${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  const archive: TodoArchive = {
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    todos: structuredClone(todos),
  };
  updateActiveSession((s) => ({
    ...s,
    todoArchives: [...(s.todoArchives ?? []), archive],
  }));
}
```

Import `TodoArchive` from `./types`.

- [ ] **Step 4: Add handleDeleteArchive function**

```typescript
function handleDeleteArchive(archiveId: string) {
  updateActiveSession((s) => ({
    ...s,
    todoArchives: (s.todoArchives ?? []).filter((a) => a.id !== archiveId),
  }));
}
```

- [ ] **Step 5: Update handleClearTodos to auto-archive**

Replace the existing `handleClearTodos` function:

```typescript
function handleClearTodos() {
  handleArchiveTodos();
  setTodos([]);
  setAutoPlayTodos(false);
  setConfirmClearTodos(false);
}
```

- [ ] **Step 6: Add handleLoadPlan function**

```typescript
async function handleLoadPlan() {
  const filePath = await open({
    multiple: false,
    filters: [{ name: "Markdown", extensions: ["md"] }],
  });
  if (!filePath) return;
  const contents = await readTextFile(filePath as string);
  void handleRun(`IMPORTANT: Do NOT ask questions, do NOT use skills, do NOT brainstorm. Just output a todo list immediately.

Read this plan document and break it into concrete, ordered implementation tasks.
Output ONLY ADD_TODO: lines, nothing else. No explanation, no questions, no preamble.
Each task should be a single actionable step.
If a task should be assigned to a specific agent, prefix with [agent:slug].

Example output format:
ADD_TODO: step one description
ADD_TODO: [agent:backend-dev] step two description

Plan:
${contents}`);
}
```

- [ ] **Step 7: Add clear confirmation dialog**

Near the existing `confirmTodoMode` dialog (around line 2600), add a confirmation dialog for clearing:

```tsx
{confirmClearTodos && (
  <div className="confirm-overlay" onClick={() => setConfirmClearTodos(false)}>
    <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
      <div className="confirm-title">Clear all todos?</div>
      <p className="confirm-body">
        The current todo list will be archived before clearing. You can view it in the Archives tab.
      </p>
      <div className="confirm-actions">
        <button type="button" className="confirm-cancel" onClick={() => setConfirmClearTodos(false)}>Cancel</button>
        <button
          type="button"
          className="confirm-cancel"
          style={{ background: "var(--vp-c-brand-1)", color: "white" }}
          onClick={handleClearTodos}
        >
          Archive & Clear
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 8: Update TodoPanel props**

Find the TodoPanel JSX (around line 2630). Update/add these props:

```tsx
onClearTodos={() => todos.length > 0 ? setConfirmClearTodos(true) : handleClearTodos()}
onArchiveTodos={handleArchiveTodos}
onDeleteArchive={handleDeleteArchive}
onLoadPlan={handleLoadPlan}
todoArchives={activeSession?.todoArchives ?? []}
```

- [ ] **Step 9: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: Errors about missing props on TodoPanel (expected — we'll add them in Task 4)

- [ ] **Step 10: Commit**

```
feat(todos): add archive, load plan, and clear confirmation handlers
```

---

### Task 4: Update TodoPanel UI

**Files:**
- Modify: `src/components/TodoPanel.tsx`
- Modify: `src/components/TodoPanel.css`

- [ ] **Step 1: Add new props to TodoPanelProps interface**

```typescript
onArchiveTodos?: () => void;
onDeleteArchive?: (archiveId: string) => void;
onLoadPlan?: () => void;
todoArchives?: TodoArchive[];
```

Import `TodoArchive` from `../types`. Update the `TabId` type:

```typescript
type TabId = "execution" | "todo" | "archives";
```

Destructure the new props in the component function.

- [ ] **Step 2: Add an ArchiveIcon SVG**

Near the existing icon components, add:

```typescript
function ArchiveIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="12" height="12">
      <rect x="2" y="3" width="20" height="5" rx="1" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M4 8v10a2 2 0 002 2h12a2 2 0 002-2V8" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M10 12h4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
```

- [ ] **Step 3: Add Load Plan button to todo empty state and todo header**

In the empty state (inside `renderTodoView`, the `todo-empty` div), add a "Load Plan" button below the goal input:

```tsx
{onLoadPlan && (
  <button type="button" className="todo-load-plan" onClick={onLoadPlan} disabled={!canRun}>
    Load Plan (.md)
  </button>
)}
```

Also add "Load Plan" and "Archive" action buttons at the top of `renderTodoView` when todos exist. Add a small toolbar div before the todo list map:

```tsx
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
    {_onClearTodos && (
      <button type="button" className="todo-action-btn todo-action-danger" onClick={_onClearTodos} title="Clear all todos">
        Clear
      </button>
    )}
  </div>
)}
```

Note: stop ignoring `_onClearTodos` — rename back to `onClearTodos` in the destructured props and use it directly.

- [ ] **Step 4: Add Archives tab**

In the tab bar (line 398), add a third tab:

```tsx
<button
  className={`todo-tab ${activeTab === "archives" ? "active" : ""}`}
  onClick={() => setActiveTab("archives")}
>
  Archives
</button>
```

Update the tab content rendering:

```tsx
<div className="todo-tab-content">
  {activeTab === "execution" ? renderExecutionView() : activeTab === "todo" ? renderTodoView() : renderArchivesView()}
</div>
```

- [ ] **Step 5: Implement renderArchivesView**

Add a new render function:

```typescript
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
```

- [ ] **Step 6: Add CSS for new elements**

In `src/components/TodoPanel.css`, add styles for:

```css
/* Todo action buttons bar */
.todo-actions-bar {
  display: flex;
  gap: 6px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--vp-c-divider);
}

.todo-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  font-size: 0.72rem;
  color: var(--vp-c-text-3);
  background: transparent;
  border: 1px solid var(--vp-c-divider);
  cursor: pointer;
  transition: color 0.1s, border-color 0.1s;
}

.todo-action-btn:hover {
  color: var(--vp-c-text-1);
  border-color: var(--vp-c-text-3);
}

.todo-action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.todo-action-danger:hover {
  color: var(--vp-c-danger-1, #ef4444);
  border-color: var(--vp-c-danger-1, #ef4444);
}

.todo-load-plan {
  width: 100%;
  padding: 8px;
  margin-top: 8px;
  font-size: 0.78rem;
  color: var(--vp-c-text-2);
  background: transparent;
  border: 1px dashed var(--vp-c-divider);
  cursor: pointer;
  transition: color 0.1s, border-color 0.1s;
}

.todo-load-plan:hover {
  color: var(--vp-c-text-1);
  border-color: var(--vp-c-text-2);
}

.todo-load-plan:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Archives view */
.archives-view {
  padding: 0;
}

.archives-list {
  display: flex;
  flex-direction: column;
}

.archive-entry {
  border-bottom: 1px solid var(--vp-c-divider);
}

.archive-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 10px;
  cursor: pointer;
  font-size: 0.78rem;
  color: var(--vp-c-text-2);
  list-style: none;
}

.archive-summary::-webkit-details-marker {
  display: none;
}

.archive-summary:hover {
  background: var(--vp-c-bg-soft);
}

.archive-name {
  flex: 1;
  font-weight: 500;
  color: var(--vp-c-text-1);
}

.archive-meta {
  font-size: 0.7rem;
  color: var(--vp-c-text-3);
}

.archive-delete {
  border: none;
  background: transparent;
  color: var(--vp-c-text-3);
  font-size: 16px;
  cursor: pointer;
  padding: 0 4px;
  opacity: 0;
  transition: opacity 0.1s;
}

.archive-summary:hover .archive-delete {
  opacity: 1;
}

.archive-delete:hover {
  color: var(--vp-c-danger-1, #ef4444);
}

.archive-todos {
  padding: 0 0 6px;
}

.archive-done .queue-item-title {
  text-decoration: line-through;
  opacity: 0.6;
}
```

- [ ] **Step 7: Verify TypeScript compiles and all tests pass**

Run: `npx tsc --noEmit && npx vitest run`
Expected: All pass

- [ ] **Step 8: Commit**

```
feat(todos): add Archives tab, Load Plan button, clear confirmation UI
```

---

## Self-Review

**Spec coverage:**
- [x] Clear with confirmation — Task 3 (dialog) + Task 4 (Clear button wired to onClearTodos)
- [x] Auto-archive on clear — Task 3 (handleClearTodos calls handleArchiveTodos first)
- [x] Manual archive — Task 4 (Archive button in todo actions bar)
- [x] Skip archive if empty — Task 3 (handleArchiveTodos returns early if todos.length === 0)
- [x] Load plan markdown — Task 3 (handleLoadPlan) + Task 4 (Load Plan button)
- [x] Archives tab — Task 4 (third tab with read-only list)
- [x] Archive data model — Task 1 (TodoArchive type)
- [x] Settings persistence — Task 2 (sanitization)
- [x] Delete archive — Task 3 (handleDeleteArchive) + Task 4 (delete button per archive)
- [x] Read-only archives — Task 4 (no edit/toggle controls in archive view)

**Placeholder scan:** No TBD/TODO found.

**Type consistency:** `TodoArchive` used consistently. `todoArchives` field name matches throughout types.ts, settings.ts, App.tsx, TodoPanel.tsx.
