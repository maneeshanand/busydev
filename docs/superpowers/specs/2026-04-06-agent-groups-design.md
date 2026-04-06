# Agent Groups — Design Spec

## Goal

Project-level collections of BusyAgents with shared context. Activating a group spawns one session per agent, each pre-configured with the group's shared system prompt plus the agent's individual role.

---

## Data Model

### AgentGroup (new type)
```typescript
interface AgentGroup {
  id: string;
  name: string;            // e.g., "Full Stack Team"
  agentIds: string[];      // references to BusyAgent IDs
  sharedContext: string;   // text prepended to all agents' system prompts
  createdAt: number;
}
```

### Project (modified)
```typescript
interface Project {
  // ...existing fields
  agentGroups?: AgentGroup[];
}
```

### Session (modified)
```typescript
interface Session {
  // ...existing fields
  groupId?: string;        // links to AgentGroup.id that spawned this session
  groupContext?: string;    // frozen copy of the group's sharedContext at spawn time
}
```

---

## Shared Context Injection

When a session has `groupContext`, the effective system prompt at run time is:

```
[groupContext]
---
[BusyAgent's own systemPrompt]
```

This is injected in the prompt-building logic in App.tsx where `systemPromptOverride` is applied. No backend changes needed.

The `groupContext` is a frozen copy (not a live reference) — editing the group's shared context after spawning does not retroactively change existing sessions. This avoids surprises mid-execution.

---

## UI: Groups Section in Project Sidebar

A "GROUPS" section in the project rail, between the session list and the footer actions.

### Creating a Group
- "New Group" button opens an inline form (or a modal):
  - **Name** — text input (e.g., "Full Stack Team")
  - **Agents** — multi-select checklist from available BusyAgents (presets + custom)
  - **Shared Context** — textarea for the shared system prompt (supports `#alias` tags)
  - Save / Cancel buttons

### Group List
- Each group shows: name, agent count, created date
- Click → activates the group (spawns sessions)
- Edit button → reopens the form with existing values
- Delete button → removes the group (does not delete spawned sessions)

### Editing a Group
- Same form as creation, pre-filled with current values
- Editing does not affect already-spawned sessions (they have frozen `groupContext`)

---

## Activating a Group

When user clicks a group to activate:

1. For each `agentId` in `group.agentIds`:
   - Look up the BusyAgent by ID
   - Create a new session via `makeSession()`
   - Set `session.name` to the agent's name (e.g., "Backend Dev")
   - Set `session.busyAgentId` to the agent's ID
   - Set `session.groupId` to the group's ID
   - Set `session.groupContext` to `group.sharedContext`
   - Create a git worktree (existing logic for non-first sessions)
2. Add all sessions to the project
3. Switch to the first spawned session

---

## Session UI Indicators

- Sessions spawned from a group show a small group badge (similar to the worktree badge) with the group name
- The badge is derived from `session.groupId` → looking up `project.agentGroups` for the name

---

## Settings Persistence

### AgentGroup sanitization
- Validate `id` (string), `name` (string), `agentIds` (string array), `sharedContext` (string), `createdAt` (number)
- Added to `sanitizeProject` alongside existing session sanitization

### Session fields
- `groupId`: `typeof obj?.groupId === "string" ? obj.groupId : undefined`
- `groupContext`: `typeof obj?.groupContext === "string" ? obj.groupContext : undefined`
- Added to `sanitizeSession` in settings.ts

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/types.ts` | Add `AgentGroup` interface, add `agentGroups?` to `Project`, add `groupId?` + `groupContext?` to `Session` |
| `src/lib/settings.ts` | Add `sanitizeAgentGroup`, wire into project sanitization, add session fields |
| `src/lib/settings.test.ts` | Tests for group sanitization |
| `src/App.tsx` | Group CRUD handlers, activation logic, group context injection into system prompt, group badge rendering |
| `src/App.css` | Group section styles, badge styles |
| `src/components/ProjectNavigator.tsx` | Render groups section with create/edit/delete/activate |
| `src/components/ProjectNavigator.css` | Group list styles |

## Files NOT Modified

- `src-tauri/` — no backend changes (groups are frontend-only state)
- `src/lib/adapters/` — no changes to stream adapters
- `src/components/TodoPanel.tsx` — no todo changes
