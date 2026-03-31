# Todo & Execution Improvements — Design Spec

## Goal

Add three improvements to the todo system: confirmation before clearing, loading plan markdown files to generate todos via agent, and read-only session-scoped archives for historical reference.

---

## Feature 1: Clear Todos with Confirmation

### Behavior

- When user clicks "Clear" in the TodoPanel, show a confirmation dialog
- Dialog text: "Archive and clear all todos?" with Cancel and Confirm buttons
- On confirm: auto-archive the current todo list (Feature 3), then clear all todos and disable auto-play
- If current todo list is empty, clear immediately without archiving or confirmation

### Implementation

- Add `confirmClearTodos` boolean state in App.tsx (same pattern as `confirmTodoMode`)
- Render a confirmation dialog when `confirmClearTodos` is true
- On confirm: call archive helper, then existing `handleClearTodos` logic

---

## Feature 2: Load Plan Markdown to Generate Todos

### Behavior

- "Load Plan" button appears in TodoPanel:
  - In the empty state (alongside the existing goal input)
  - As an action button when todos already exist (in the todo tab header area)
- Clicking opens a system file picker filtered to `.md` files
- Selected file is read and sent to the agent with a structured prompt
- Agent outputs `ADD_TODO:` lines which the existing parsing pipeline picks up

### Prompt Template

```
IMPORTANT: Do NOT ask questions, do NOT use skills, do NOT brainstorm. Just output a todo list immediately.

Read this plan document and break it into concrete, ordered implementation tasks.
Output ONLY ADD_TODO: lines, nothing else. No explanation, no questions, no preamble.
Each task should be a single actionable step.
If a task should be assigned to a specific agent, prefix with [agent:slug].

Example output format:
ADD_TODO: step one description
ADD_TODO: [agent:backend-dev] step two description

Plan:
<file contents>
```

### Implementation

- Add `onLoadPlan` prop to TodoPanel
- Handler in App.tsx:
  1. Open file dialog (`@tauri-apps/plugin-dialog` `open()` with `.md` filter)
  2. Read file contents (`@tauri-apps/plugin-fs` `readTextFile()`)
  3. Call `handleRun()` with the structured prompt containing file contents
- Reuses the entire existing `ADD_TODO:` parsing pipeline — no new parser needed

---

## Feature 3: Session-Scoped Todo Archives

### Data Model

```typescript
interface TodoArchive {
  id: string;           // crypto.randomUUID()
  name: string;         // auto-generated: "Archive — Mar 30, 2:15 PM"
  createdAt: number;    // Date.now()
  todos: TodoItem[];    // frozen snapshot of todos at archive time
}
```

Add to `Session` type:
```typescript
todoArchives?: TodoArchive[];
```

### Archive Triggers

- **Auto on clear:** Before clearing todos, archive the current list automatically
- **Manual:** "Archive" button in the todo tab header area
- **Skip condition:** Do not archive if the current todo list is empty

### Archive Name Format

`"Archive — {date}"` using `toLocaleDateString` + `toLocaleTimeString` (e.g., "Archive — Mar 30, 2:15 PM")

### UI: Archives Tab

Third tab in the TodoPanel alongside "Execution" and "Todo":
- Tab label: "Archives" (or archive icon)
- Shows list of archives sorted by `createdAt` descending (newest first)
- Each archive entry shows: name, date, todo count, completion count
- Click to expand: read-only todo list preserving done/pending status
- Delete button per archive (no confirmation needed — archives are disposable)
- Empty state: "No archives yet"

### Archives are Read-Only

- No editing, toggling, or reordering of archived todos
- No restore functionality — archives are purely historical reference
- Displayed with same visual treatment as the execution queue (checkmarks for done, dashes for pending)

### Settings Persistence

- `todoArchives` serialized in session settings alongside existing `todos`
- Sanitization: validate each archive has `id` (string), `name` (string), `createdAt` (number), `todos` (array)
- Individual archived todos sanitized same as regular todos

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/types.ts` | Add `TodoArchive` interface, add `todoArchives?` to `Session` |
| `src/components/TodoPanel.tsx` | Add Archives tab, Load Plan button, archive/clear confirmation UI |
| `src/components/TodoPanel.css` | Styles for archives tab and read-only archive list |
| `src/App.tsx` | Add `confirmClearTodos` state, `handleArchiveTodos`, `handleDeleteArchive`, `handleLoadPlan` handlers, wire new props |
| `src/lib/settings.ts` | Add `todoArchives` sanitization in session serializer |

## Files NOT Modified

- `src/lib/frontendUtils.tsx` — no changes needed, existing `ADD_TODO:` parsing handles plan loading
- `src/lib/adapters/` — no changes needed
- `src-tauri/` — no backend changes needed (file dialog and fs are already Tauri plugins)
