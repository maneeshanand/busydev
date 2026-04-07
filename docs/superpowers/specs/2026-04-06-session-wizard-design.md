# Session Wizard — Design Spec (Spec 1: Wizard Flow)

## Goal

A guided wizard that appears when creating a new session, offering "Quick Session" or "Build a Feature." The feature path collects a description, generates an AI plan with agent assignments, lets the user review/edit each step, then transitions to normal session execution with todos populated.

---

## Step 1: Choose Mode

Two cards replace the session panel content:

- **Quick Session** — creates a normal empty session (existing `handleNewSession` behavior)
- **Build a Feature** — enters the wizard flow

No modals or overlays. The wizard owns the session panel's main content area.

---

## Step 2: Describe the Feature

- Textarea for the feature description
- Hint text: "Tip: paste a ticket URL if your agent has Jira/Linear MCP access"
- Back button → returns to Step 1
- "Generate Plan →" button → sends description to the AI

---

## AI Plan Generation

Single agent call with a structured prompt:

```
You are a technical project planner. Given a feature description and available agents, create a step-by-step execution plan.

Available agents:
- backend-dev (Backend Dev): Rust/Node.js backend specialist
- frontend-dev (Frontend Dev): React/TypeScript UI specialist
- qa-engineer (QA Engineer): Testing and quality assurance
[...dynamically built from BusyAgents]

Output format — ONLY these lines, nothing else:
BRANCH: suggested-branch-name
ADD_TODO: [agent:slug] step description
ADD_TODO: [agent:slug] step description
...

Feature:
<user's description>
```

Response parsed using existing `ADD_TODO:` pipeline (`parseTodoAdditions`). Branch name extracted via regex `BRANCH:\s*(.+)`. Falls back to a slugified version of the description if no BRANCH line.

---

## Step 3: Review Plan

### Config Bar
Top section with three controls:

- **Branch name** — editable text input, pre-filled with AI suggestion (e.g., `feat/jwt-auth`)
- **LLM provider** — dropdown of enabled providers, defaults to session's current agent
- **Auto-execute** — checkbox, checked by default

### Plan Steps (expandable/editable)

Each step is a collapsible `<details>` element:

**Collapsed view:**
- Step number
- Task title
- Agent badge (colored chip with icon + name)

**Expanded view:**
- **Task** — editable text input for the step title
- **Notes / Context** — textarea for additional instructions (maps to `TodoItem.notes`)
- **Agent** — dropdown to change assigned BusyAgent
- **Remove** — button to delete the step

**Additional controls:**
- **+ Add Step** — button at the bottom to manually add a step
- **Regenerate** — re-runs the AI call with the same description
- **← Back** — returns to Step 2
- **Approve & Execute →** — starts execution

---

## Step 4: Approve & Execute

On "Approve & Execute":

1. Create a new session via `makeSession()`
2. Create worktree with the user-specified branch name
3. Set session's agent to the selected LLM provider
4. Populate `session.todos` from the plan steps:
   - `text` from the step title
   - `notes` from the step notes
   - `busyAgentId` from the agent assignment
   - `source: "agent"`
5. Enable `todoMode` on the session (skip confirmation dialog — wizard is the confirmation)
6. Enable `autoPlay` if the auto-execute checkbox was checked
7. Store `wizardPlan` on the session for reference
8. Close the wizard → transition to normal session view → execution begins

---

## Data Model

### WizardPlan (new, stored on Session)

```typescript
interface WizardPlan {
  description: string;
  branch: string;
  steps: { text: string; notes: string; agentSlug: string }[];
  createdAt: number;
}
```

### Session (modified)

```typescript
interface Session {
  // ...existing fields
  wizardPlan?: WizardPlan;
}
```

This is a frozen record of what the wizard produced — for reference only. Execution uses the todo system.

---

## Component Structure

| File | Responsibility |
|------|---------------|
| `src/components/SessionWizard.tsx` | Self-contained wizard with step state machine (Steps 1-3 as render functions) |
| `src/components/SessionWizard.css` | Wizard styles (cards, form inputs, expandable steps, config bar) |
| `src/types.ts` | Add `WizardPlan` interface, add `wizardPlan?` to `Session` |
| `src/lib/settings.ts` | Add `wizardPlan` sanitization to `sanitizeSession` |
| `src/App.tsx` | Add `wizardOpen` state, render `<SessionWizard>` when open, handle wizard completion callback |

---

## Integration with App.tsx

### Wizard Trigger
- `handleNewSession` sets `wizardOpen = true` instead of immediately creating a session
- The wizard renders in place of the session panel content when `wizardOpen` is true

### Wizard Completion Callback
The wizard calls back with:
```typescript
interface WizardResult {
  description: string;
  branch: string;
  provider: string;
  autoExecute: boolean;
  steps: { text: string; notes: string; agentId: string }[];
}
```

App.tsx handles:
- Creating the session
- Creating the worktree with the branch
- Populating todos
- Setting provider/todoMode/autoPlay
- Storing wizardPlan
- Closing the wizard

### Wizard Cancellation
Back from Step 1 or closing the wizard → `wizardOpen = false`, no session created.

---

## Settings Persistence

`wizardPlan` sanitization in `sanitizeSession`:
- Validate `description` (string), `branch` (string), `createdAt` (number)
- Validate `steps` is an array of objects with `text`/`notes`/`agentSlug` strings
- Return undefined for invalid data

---

## Files NOT Modified

- `src-tauri/` — no backend changes
- `src/lib/adapters/` — no stream adapter changes
- `src/components/TodoPanel.tsx` — wizard populates todos, existing todo system handles execution
- `src/components/AgentVisualizer.tsx` — visualizer works with todos regardless of how they were created

---

## Scope Exclusions (Spec 2: Parallel Execution)

- Parallel execution of independent steps
- Dependency graph between steps
- New execution UI for wizard mode
- Step reordering via drag-and-drop in the review panel
