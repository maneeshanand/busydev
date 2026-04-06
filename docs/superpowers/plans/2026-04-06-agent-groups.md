# Agent Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add project-level agent groups that spawn multiple pre-configured sessions with shared context.

**Architecture:** AgentGroup is a new type stored on Project. Creating a group is CRUD on the project. Activating a group spawns one session per agent with the group's shared context frozen onto each session. The shared context is injected at run time by prepending it to the system prompt in the existing prompt-building logic.

**Tech Stack:** React, TypeScript, Vitest

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/types.ts` | Add `AgentGroup` interface, add `agentGroups?` to `Project`, add `groupId?` + `groupContext?` to `Session` |
| `src/lib/settings.ts` | Add `sanitizeAgentGroup`, wire into project sanitization, add session fields |
| `src/lib/settings.test.ts` | Tests for group sanitization and session field persistence |
| `src/App.tsx` | Group CRUD handlers, activation logic (spawn sessions), group context injection into system prompt |
| `src/App.css` | Group badge styles on session tabs |
| `src/components/ProjectNavigator.tsx` | Render groups section with create/edit/delete/activate UI |
| `src/components/ProjectNavigator.css` | Group list and form styles |

---

### Task 1: Add types and settings sanitization

**Files:**
- Modify: `src/types.ts`
- Modify: `src/lib/settings.ts`
- Modify: `src/lib/settings.test.ts`

- [ ] **Step 1: Add AgentGroup type and update Project/Session in types.ts**

After the `BusyAgent` interface (around line 101), add:

```typescript
export interface AgentGroup {
  id: string;
  name: string;
  agentIds: string[];
  sharedContext: string;
  createdAt: number;
}
```

Add to `Project` interface (before the closing `}`):

```typescript
  agentGroups?: AgentGroup[];
```

Add to `Session` interface (after `busyAgentId?`):

```typescript
  groupId?: string;
  groupContext?: string;
```

- [ ] **Step 2: Add sanitizeAgentGroup in settings.ts**

Import `AgentGroup` from `../types`. Add a `sanitizeAgentGroup` function near the other sanitizers:

```typescript
function sanitizeAgentGroup(value: unknown): AgentGroup | null {
  const obj = asObject(value);
  if (!obj) return null;
  const id = typeof obj.id === "string" ? obj.id : "";
  const name = typeof obj.name === "string" ? obj.name : "";
  const createdAt = typeof obj.createdAt === "number" ? obj.createdAt : 0;
  if (!id || !name || !createdAt) return null;
  const agentIds = Array.isArray(obj.agentIds)
    ? obj.agentIds.filter((a): a is string => typeof a === "string" && a.length > 0)
    : [];
  const sharedContext = typeof obj.sharedContext === "string" ? obj.sharedContext : "";
  return { id, name, agentIds, sharedContext, createdAt };
}
```

- [ ] **Step 3: Wire sanitizeAgentGroup into project sanitization**

In `sanitizeProjects`, find the line that returns the project object (line ~316):

```typescript
return { id, name, path, createdAt, sessions, activeSessionId };
```

Add `agentGroups`:

```typescript
const agentGroups = Array.isArray(p.agentGroups)
  ? p.agentGroups.map(sanitizeAgentGroup).filter(Boolean) as AgentGroup[]
  : undefined;
return { id, name, path, createdAt, sessions, activeSessionId, agentGroups };
```

- [ ] **Step 4: Add groupId and groupContext to sanitizeSession**

In `sanitizeSession`, after the `busyAgentId` line, add:

```typescript
    groupId: typeof obj?.groupId === "string" && obj.groupId.trim() ? obj.groupId.trim() : undefined,
    groupContext: typeof obj?.groupContext === "string" ? obj.groupContext : undefined,
```

- [ ] **Step 5: Add tests for group sanitization**

In `src/lib/settings.test.ts`, add a describe block for AgentGroup sanitization:

- Test: valid group with agents persists through sanitization
- Test: groups with missing id/name/createdAt are filtered out
- Test: sessions with groupId and groupContext preserve through sanitization
- Test: projects without agentGroups have field as undefined

Follow the same pattern as the existing TodoArchive sanitization tests.

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/lib/settings.test.ts`
Expected: All tests pass

- [ ] **Step 7: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 8: Commit**

```
feat(types): add AgentGroup type with settings sanitization
```

---

### Task 2: Add group CRUD and activation handlers in App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add group CRUD handlers**

Find the existing todo handlers area (near `handleClearTodos`). Add these handlers:

```typescript
function handleCreateGroup(name: string, agentIds: string[], sharedContext: string) {
  if (!activeProjectId) return;
  const group: AgentGroup = {
    id: crypto.randomUUID(),
    name,
    agentIds,
    sharedContext,
    createdAt: Date.now(),
  };
  setProjects((prev) => prev.map((p) =>
    p.id === activeProjectId
      ? { ...p, agentGroups: [...(p.agentGroups ?? []), group] }
      : p
  ));
}

function handleUpdateGroup(groupId: string, updates: Partial<AgentGroup>) {
  if (!activeProjectId) return;
  setProjects((prev) => prev.map((p) =>
    p.id === activeProjectId
      ? { ...p, agentGroups: (p.agentGroups ?? []).map((g) => g.id === groupId ? { ...g, ...updates } : g) }
      : p
  ));
}

function handleDeleteGroup(groupId: string) {
  if (!activeProjectId) return;
  setProjects((prev) => prev.map((p) =>
    p.id === activeProjectId
      ? { ...p, agentGroups: (p.agentGroups ?? []).filter((g) => g.id !== groupId) }
      : p
  ));
}
```

Import `AgentGroup` from `./types`.

- [ ] **Step 2: Add group activation handler**

This spawns one session per agent in the group:

```typescript
async function handleActivateGroup(groupId: string) {
  if (!activeProjectId || !activeProject) return;
  const group = (activeProject.agentGroups ?? []).find((g) => g.id === groupId);
  if (!group || group.agentIds.length === 0) return;

  const newSessions: Session[] = [];
  for (const agentId of group.agentIds) {
    const ba = allAgents.find((a) => a.id === agentId);
    if (!ba) continue;

    const session = makeSession(activeProjectId, activeProject.sessions.length + newSessions.length);
    session.name = ba.name;
    session.busyAgentId = ba.id;
    session.agent = ba.base;
    session.model = ba.model;
    session.approvalPolicy = ba.approvalPolicy;
    session.sandboxMode = ba.sandboxMode;
    session.groupId = group.id;
    session.groupContext = group.sharedContext;

    // Create worktree for each session
    try {
      const isGit = await isGitRepo(activeProject.path);
      if (isGit) {
        const shortId = session.id.split("-")[0];
        const slug = ba.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const branch = `busydev/${slug}-${shortId}`;
        const projectSlug = activeProject.path.replace(/\//g, "-").replace(/^-/, "");
        const wtPath = `/tmp/busydev-worktrees/${projectSlug}/${session.id}`;
        await createWorktree(activeProject.path, wtPath, branch);
        session.worktreePath = wtPath;
        session.worktreeBranch = branch;
      }
    } catch (err) {
      console.warn(`Worktree creation failed for ${ba.name}:`, err);
    }

    newSessions.push(session);
  }

  if (newSessions.length === 0) return;

  setProjects((prev) => prev.map((p) =>
    p.id === activeProjectId
      ? { ...p, sessions: [...p.sessions, ...newSessions], activeSessionId: newSessions[0].id }
      : p
  ));
  resetEphemeralState();
}
```

- [ ] **Step 3: Inject group context into system prompt**

Find the system prompt building logic (line ~1824):

```typescript
let systemPrompt = overrides?.systemPromptOverride || taggedBusyAgent?.systemPrompt || activeBusyAgent?.systemPrompt || "";
```

After this line, prepend group context if the session has one:

```typescript
// Prepend group shared context if session was spawned from a group
const groupCtx = activeSession?.groupContext;
if (groupCtx) {
  systemPrompt = systemPrompt
    ? `${groupCtx}\n\n---\n\n${systemPrompt}`
    : groupCtx;
}
```

- [ ] **Step 4: Wire group props to ProjectNavigator**

Find where `<ProjectNavigator` is rendered. Add these props:

```typescript
agentGroups={activeProject?.agentGroups ?? []}
busyAgents={allAgents}
onCreateGroup={handleCreateGroup}
onUpdateGroup={handleUpdateGroup}
onDeleteGroup={handleDeleteGroup}
onActivateGroup={handleActivateGroup}
```

- [ ] **Step 5: Add group badge to session tabs**

Find the session tab rendering (search for `session-tab-branch`). After the worktree branch badge, add a group badge:

```tsx
{s.groupId && (() => {
  const groupName = activeProject?.agentGroups?.find((g) => g.id === s.groupId)?.name;
  return groupName ? <span className="session-tab-group" title={groupName}>⊕</span> : null;
})()}
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: Errors about missing ProjectNavigator props (expected — Task 3 adds them)

- [ ] **Step 7: Commit**

```
feat(groups): add CRUD, activation, and context injection handlers
```

---

### Task 3: Update ProjectNavigator with groups UI

**Files:**
- Modify: `src/components/ProjectNavigator.tsx`
- Modify: `src/components/ProjectNavigator.css`

- [ ] **Step 1: Add group props to ProjectNavigatorProps**

```typescript
import type { Project, AgentGroup, BusyAgent } from "../types";
```

Add to the props interface:

```typescript
  agentGroups: AgentGroup[];
  busyAgents: BusyAgent[];
  onCreateGroup: (name: string, agentIds: string[], sharedContext: string) => void;
  onUpdateGroup: (groupId: string, updates: Partial<AgentGroup>) => void;
  onDeleteGroup: (groupId: string) => void;
  onActivateGroup: (groupId: string) => void;
```

Destructure them in the component.

- [ ] **Step 2: Add group form state**

Inside the component function, add state for the group create/edit form:

```typescript
const [showGroupForm, setShowGroupForm] = useState(false);
const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
const [groupName, setGroupName] = useState("");
const [groupAgentIds, setGroupAgentIds] = useState<string[]>([]);
const [groupContext, setGroupContext] = useState("");
```

Add helper functions:

```typescript
function openNewGroupForm() {
  setEditingGroupId(null);
  setGroupName("");
  setGroupAgentIds([]);
  setGroupContext("");
  setShowGroupForm(true);
}

function openEditGroupForm(group: AgentGroup) {
  setEditingGroupId(group.id);
  setGroupName(group.name);
  setGroupAgentIds([...group.agentIds]);
  setGroupContext(group.sharedContext);
  setShowGroupForm(true);
}

function handleGroupSubmit() {
  if (!groupName.trim() || groupAgentIds.length === 0) return;
  if (editingGroupId) {
    onUpdateGroup(editingGroupId, { name: groupName.trim(), agentIds: groupAgentIds, sharedContext: groupContext });
  } else {
    onCreateGroup(groupName.trim(), groupAgentIds, groupContext);
  }
  setShowGroupForm(false);
}

function toggleGroupAgent(agentId: string) {
  setGroupAgentIds((prev) =>
    prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId]
  );
}
```

- [ ] **Step 3: Render groups section in the JSX**

After the `<div className="project-list">...</div>` and before the closing `</div>` of `.project-nav`, add:

```tsx
<div className="project-nav-header">GROUPS</div>
<div className="group-list">
  {agentGroups.map((group) => (
    <div key={group.id} className="group-item">
      <span className="group-item-name" onClick={() => onActivateGroup(group.id)} title="Activate group">
        {group.name}
      </span>
      <span className="group-item-count">{group.agentIds.length}</span>
      <button type="button" className="group-item-edit" onClick={() => openEditGroupForm(group)} title="Edit">✎</button>
      <button type="button" className="group-item-remove" onClick={() => onDeleteGroup(group.id)} title="Delete">×</button>
    </div>
  ))}
  <button type="button" className="group-add-button" onClick={openNewGroupForm}>
    + New Group
  </button>
</div>

{showGroupForm && (
  <div className="group-form">
    <div className="group-form-header">{editingGroupId ? "Edit Group" : "New Group"}</div>
    <input
      className="group-form-input"
      value={groupName}
      onChange={(e) => setGroupName(e.target.value)}
      placeholder="Group name..."
      autoFocus
    />
    <div className="group-form-label">Agents</div>
    <div className="group-form-agents">
      {busyAgents.map((ba) => (
        <label key={ba.id} className="group-form-agent">
          <input
            type="checkbox"
            checked={groupAgentIds.includes(ba.id)}
            onChange={() => toggleGroupAgent(ba.id)}
          />
          <span>{ba.name}</span>
        </label>
      ))}
      {busyAgents.length === 0 && <div className="group-form-empty">No BusyAgents defined</div>}
    </div>
    <div className="group-form-label">Shared Context</div>
    <textarea
      className="group-form-context"
      value={groupContext}
      onChange={(e) => setGroupContext(e.target.value)}
      placeholder="System prompt shared by all agents in this group..."
      rows={4}
    />
    <div className="group-form-actions">
      <button type="button" className="group-form-cancel" onClick={() => setShowGroupForm(false)}>Cancel</button>
      <button type="button" className="group-form-save" onClick={handleGroupSubmit} disabled={!groupName.trim() || groupAgentIds.length === 0}>
        {editingGroupId ? "Save" : "Create"}
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 4: Add CSS styles**

In `src/components/ProjectNavigator.css`, add styles for the group section. Follow the existing project list patterns (similar spacing, font sizes, hover effects). Key classes:

- `.group-list` — flex column
- `.group-item` — flex row, same height/padding as `.project-item`
- `.group-item-name` — flex 1, clickable, cursor pointer
- `.group-item-count` — small badge showing agent count
- `.group-item-edit`, `.group-item-remove` — hidden on default, visible on hover (same pattern as `.project-item-remove`)
- `.group-add-button` — subtle button similar to the "Add project" but smaller
- `.group-form` — card-like form area with padding, border-top
- `.group-form-input`, `.group-form-context` — full width inputs
- `.group-form-agents` — checklist
- `.group-form-actions` — flex row, gap, right-aligned

In `src/App.css`, add the group badge style:

```css
.session-tab-group {
  margin-left: 4px;
  font-size: 0.7rem;
  color: var(--vp-c-brand-1);
  opacity: 0.7;
}
```

- [ ] **Step 5: Verify TypeScript compiles and all tests pass**

Run: `npx tsc --noEmit && npx vitest run`
Expected: All pass

- [ ] **Step 6: Commit**

```
feat(groups): add groups UI to ProjectNavigator with create/edit/delete/activate
```

---

## Self-Review

**Spec coverage:**
- [x] AgentGroup data model — Task 1
- [x] Project.agentGroups — Task 1
- [x] Session.groupId + groupContext — Task 1
- [x] Settings sanitization — Task 1
- [x] Group CRUD handlers — Task 2
- [x] Group activation (spawn sessions) — Task 2
- [x] Shared context injection into system prompt — Task 2
- [x] Worktree creation per spawned session — Task 2
- [x] Groups UI in ProjectNavigator — Task 3
- [x] Group badge on session tabs — Task 2
- [x] Frozen context copy (not live reference) — Task 2 (stores `group.sharedContext` at spawn time)
- [x] Settings persistence tests — Task 1

**Placeholder scan:** No TBD/TODO. All code blocks complete.

**Type consistency:** `AgentGroup` used consistently. `groupId`/`groupContext` match across types.ts, settings.ts, App.tsx. `sanitizeAgentGroup` matches type fields.
