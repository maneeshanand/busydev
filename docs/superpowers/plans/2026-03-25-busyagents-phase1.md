# BusyAgents Phase 1 — Data Model, Presets, Settings UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add BusyAgent type, 10 SDLC preset agents, persistence, and a Settings → Agents tab for CRUD management.

**Architecture:** BusyAgent array stored globally in settings (same pattern as promptLibrary). Preset definitions in a dedicated module. Settings tab shows a card grid with in-place editor. CRUD follows the exact pattern of prompt library entries.

**Tech Stack:** React, TypeScript, Zustand (settings persistence), Vitest

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/types.ts` | Add `BusyAgent` interface |
| Create | `src/lib/busyAgents.ts` | Preset definitions + helper functions |
| Create | `src/lib/busyAgents.test.ts` | Tests for presets + sanitizer |
| Modify | `src/lib/settings.ts` | Add `sanitizeBusyAgent`, extend `StoredSettings`, handle in migration |
| Modify | `src/lib/settings.test.ts` | Persistence tests |
| Modify | `src/components/SettingsView.tsx` | Add "Agents" section with grid + editor |
| Modify | `src/components/SettingsView.css` | Agent card + editor styles |
| Modify | `src/App.tsx` | Add `busyAgents` state, CRUD handlers, pass to SettingsView |

---

### Task 1: BusyAgent type + preset definitions

**Files:**
- Modify: `src/types.ts`
- Create: `src/lib/busyAgents.ts`
- Create: `src/lib/busyAgents.test.ts`

- [ ] **Step 1: Add BusyAgent interface to types.ts**

After the `SavedPromptEntry` interface (~line 66), add:

```typescript
export interface BusyAgent {
  id: string;
  name: string;
  role: string;
  icon: string;
  base: "codex" | "claude";
  model: string;
  executionMode: "safe" | "balanced" | "full-auto";
  approvalPolicy: string;
  sandboxMode: string;
  systemPrompt: string;
  isPreset: boolean;
  createdAt: number;
  updatedAt: number;
}
```

- [ ] **Step 2: Create src/lib/busyAgents.ts with preset definitions**

```typescript
import type { BusyAgent } from "../types";

function makePreset(
  id: string,
  name: string,
  role: string,
  icon: string,
  base: "codex" | "claude",
  model: string,
  executionMode: "safe" | "balanced" | "full-auto",
  systemPrompt: string,
): BusyAgent {
  const policyMap = { safe: "never", balanced: "unless-allow-listed", "full-auto": "full-auto" };
  const sandboxMap = { safe: "read-only", balanced: "workspace-write", "full-auto": "danger-full-access" };
  return {
    id: `preset-${id}`,
    name,
    role,
    icon,
    base,
    model,
    executionMode,
    approvalPolicy: policyMap[executionMode],
    sandboxMode: sandboxMap[executionMode],
    systemPrompt,
    isPreset: true,
    createdAt: 0,
    updatedAt: 0,
  };
}

export const PRESET_AGENTS: BusyAgent[] = [
  makePreset("tech-lead", "Tech Lead", "Planning & delegation", "👑", "claude", "claude-opus-4-6", "full-auto",
    `You are the Tech Lead for this project. Your responsibilities:
1. Analyze the user's high-level goal
2. Break it into concrete, ordered todo items using ADD_TODO: format
3. Assign the right specialist to each task using [agent:name] tags
4. Available agents: frontend-dev, backend-dev, devops, qa-engineer, security-reviewer, code-reviewer, documentation, data-engineer, ux-designer
5. Consider dependencies — order tasks so blockers come first
6. Keep individual tasks small (15-30 min of agent work)`),

  makePreset("frontend-dev", "Frontend Dev", "UI/UX implementation", "🖥", "claude", "claude-sonnet-4-6", "full-auto",
    "You are a frontend developer specializing in React and TypeScript. Focus on components, CSS, accessibility, and responsive design. Write clean, typed code. Follow existing patterns in the codebase."),

  makePreset("backend-dev", "Backend Dev", "API & data layer", "⚙️", "codex", "codex-mini", "full-auto",
    "You are a backend developer. Focus on Rust, APIs, database queries, and business logic. Write safe, efficient code. Handle errors properly. Follow existing patterns."),

  makePreset("devops", "DevOps", "CI/CD & infrastructure", "🔧", "codex", "codex-mini", "full-auto",
    "You are a DevOps engineer. Focus on GitHub Actions workflows, Docker, deployment scripts, and monitoring configuration. Ensure builds are reproducible and pipelines are reliable."),

  makePreset("qa-engineer", "QA Engineer", "Testing & automation", "🧪", "codex", "codex-mini", "balanced",
    "You are a QA engineer. Write comprehensive tests: unit, integration, and end-to-end. Verify acceptance criteria. Use existing test frameworks and patterns. Report failures clearly."),

  makePreset("security-reviewer", "Security Reviewer", "Security analysis", "🛡", "claude", "claude-opus-4-6", "safe",
    "You are a security reviewer. Analyze code for OWASP Top 10 vulnerabilities, injection risks, auth bypasses, and secret leaks. Flag issues with severity ratings. Do NOT fix — only report findings with specific file/line references."),

  makePreset("code-reviewer", "Code Reviewer", "Code quality", "📝", "claude", "claude-sonnet-4-6", "safe",
    "You are a code reviewer. Review diffs for correctness, readability, performance, and adherence to project patterns. Suggest improvements. Do NOT make changes — only provide review feedback."),

  makePreset("documentation", "Documentation", "Docs & README", "📖", "claude", "claude-sonnet-4-6", "full-auto",
    "You are a documentation writer. Write and update README files, API references, changelogs, and inline code comments. Be concise and accurate. Match existing documentation style."),

  makePreset("data-engineer", "Data Engineer", "Schema & migrations", "🗄", "codex", "codex-mini", "full-auto",
    "You are a data engineer. Design database schemas, write migrations, and handle data modeling. Ensure backward compatibility. Use existing ORM/query patterns."),

  makePreset("ux-designer", "UX Designer", "Design & wireframes", "🎨", "claude", "claude-sonnet-4-6", "balanced",
    "You are a UX designer. Analyze user flows, suggest UI improvements, create wireframe descriptions, and review design system consistency. Focus on usability and accessibility."),
];

/** Get a preset by its ID (without the preset- prefix) */
export function getPresetAgent(shortId: string): BusyAgent | undefined {
  return PRESET_AGENTS.find((a) => a.id === `preset-${shortId}`);
}

/** Merge user customizations onto presets: user agents override presets with matching IDs */
export function mergeWithPresets(userAgents: BusyAgent[]): BusyAgent[] {
  const userMap = new Map(userAgents.map((a) => [a.id, a]));
  const merged: BusyAgent[] = [];
  for (const preset of PRESET_AGENTS) {
    merged.push(userMap.get(preset.id) ?? preset);
    userMap.delete(preset.id);
  }
  // Append custom (non-preset) agents
  for (const agent of userMap.values()) {
    merged.push(agent);
  }
  return merged;
}

/** Generate a slug from a name for agent matching */
export function agentSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Find a BusyAgent by slug (for [agent:name] tag parsing) */
export function findAgentBySlug(agents: BusyAgent[], slug: string): BusyAgent | undefined {
  const normalized = agentSlug(slug);
  return agents.find((a) => agentSlug(a.name) === normalized);
}
```

- [ ] **Step 3: Write tests in src/lib/busyAgents.test.ts**

```typescript
import { describe, expect, it } from "vitest";
import { PRESET_AGENTS, mergeWithPresets, agentSlug, findAgentBySlug, getPresetAgent } from "./busyAgents";
import type { BusyAgent } from "../types";

describe("PRESET_AGENTS", () => {
  it("has 10 preset agents", () => {
    expect(PRESET_AGENTS).toHaveLength(10);
  });

  it("all presets have isPreset=true and preset- ID prefix", () => {
    for (const agent of PRESET_AGENTS) {
      expect(agent.isPreset).toBe(true);
      expect(agent.id).toMatch(/^preset-/);
    }
  });

  it("all presets have required fields populated", () => {
    for (const agent of PRESET_AGENTS) {
      expect(agent.name.length).toBeGreaterThan(0);
      expect(agent.role.length).toBeGreaterThan(0);
      expect(agent.icon.length).toBeGreaterThan(0);
      expect(agent.systemPrompt.length).toBeGreaterThan(0);
      expect(["codex", "claude"]).toContain(agent.base);
    }
  });
});

describe("getPresetAgent", () => {
  it("finds preset by short ID", () => {
    expect(getPresetAgent("tech-lead")?.name).toBe("Tech Lead");
    expect(getPresetAgent("nonexistent")).toBeUndefined();
  });
});

describe("mergeWithPresets", () => {
  it("returns presets when no user agents", () => {
    const merged = mergeWithPresets([]);
    expect(merged).toHaveLength(10);
    expect(merged[0].name).toBe("Tech Lead");
  });

  it("user override replaces matching preset", () => {
    const custom: BusyAgent = { ...PRESET_AGENTS[0], name: "My Tech Lead", systemPrompt: "custom" };
    const merged = mergeWithPresets([custom]);
    expect(merged).toHaveLength(10);
    expect(merged[0].name).toBe("My Tech Lead");
  });

  it("appends custom non-preset agents after presets", () => {
    const custom: BusyAgent = {
      id: "custom-1", name: "Release Manager", role: "releases", icon: "🚀",
      base: "claude", model: "claude-sonnet-4-6", executionMode: "full-auto",
      approvalPolicy: "full-auto", sandboxMode: "danger-full-access",
      systemPrompt: "handle releases", isPreset: false, createdAt: 1, updatedAt: 1,
    };
    const merged = mergeWithPresets([custom]);
    expect(merged).toHaveLength(11);
    expect(merged[10].name).toBe("Release Manager");
  });
});

describe("agentSlug", () => {
  it("converts name to lowercase hyphenated slug", () => {
    expect(agentSlug("Security Reviewer")).toBe("security-reviewer");
    expect(agentSlug("QA Engineer")).toBe("qa-engineer");
    expect(agentSlug("  Frontend Dev  ")).toBe("frontend-dev");
  });
});

describe("findAgentBySlug", () => {
  it("finds agent by slug match", () => {
    expect(findAgentBySlug(PRESET_AGENTS, "security-reviewer")?.name).toBe("Security Reviewer");
    expect(findAgentBySlug(PRESET_AGENTS, "Security Reviewer")?.name).toBe("Security Reviewer");
  });

  it("returns undefined for no match", () => {
    expect(findAgentBySlug(PRESET_AGENTS, "nonexistent")).toBeUndefined();
  });
});
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/busyAgents.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/lib/busyAgents.ts src/lib/busyAgents.test.ts
git commit -m "feat(agents): add BusyAgent type, 10 SDLC preset agents, and helpers"
```

---

### Task 2: Settings persistence

**Files:**
- Modify: `src/lib/settings.ts`
- Modify: `src/lib/settings.test.ts`

- [ ] **Step 1: Write persistence tests**

Add to `src/lib/settings.test.ts` inside the `migrateStoredSettings` describe:

```typescript
  it("preserves BusyAgents through save/load", () => {
    const migrated = migrateStoredSettings({
      projects: [],
      busyAgents: [
        {
          id: "preset-tech-lead", name: "My Tech Lead", role: "planning", icon: "👑",
          base: "claude", model: "claude-opus-4-6", executionMode: "full-auto",
          approvalPolicy: "full-auto", sandboxMode: "danger-full-access",
          systemPrompt: "custom prompt", isPreset: true, createdAt: 1, updatedAt: 2,
        },
        {
          id: "custom-1", name: "Release Mgr", role: "releases", icon: "🚀",
          base: "codex", model: "o3", executionMode: "balanced",
          approvalPolicy: "unless-allow-listed", sandboxMode: "workspace-write",
          systemPrompt: "handle releases", isPreset: false, createdAt: 3, updatedAt: 4,
        },
      ],
    });

    expect(migrated?.busyAgents).toHaveLength(2);
    expect(migrated?.busyAgents[0].name).toBe("My Tech Lead");
    expect(migrated?.busyAgents[0].systemPrompt).toBe("custom prompt");
    expect(migrated?.busyAgents[1].name).toBe("Release Mgr");
    expect(migrated?.busyAgents[1].isPreset).toBe(false);
  });

  it("defaults busyAgents to empty array when missing", () => {
    const migrated = migrateStoredSettings({ projects: [] });
    expect(migrated?.busyAgents).toEqual([]);
  });

  it("strips invalid BusyAgent entries", () => {
    const migrated = migrateStoredSettings({
      projects: [],
      busyAgents: [
        { id: "a", name: "", role: "x", icon: "x", base: "claude", model: "m" }, // no name
        { id: "b", name: "Good", role: "r", icon: "🔧", base: "codex", model: "m", systemPrompt: "p" }, // valid
        "not-an-object",
      ],
    });
    expect(migrated?.busyAgents).toHaveLength(1);
    expect(migrated?.busyAgents[0].name).toBe("Good");
  });
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx vitest run src/lib/settings.test.ts`
Expected: FAIL — `busyAgents` not on StoredSettings

- [ ] **Step 3: Implement sanitizeBusyAgent and update StoredSettings**

In `src/lib/settings.ts`:

Add to imports: `BusyAgent`

Add `busyAgents: BusyAgent[]` to `StoredSettings` interface.
Add `busyAgents?: BusyAgent[]` to `LegacyStoredSettings` type.

Add sanitizer function (after `sanitizeSavedPromptEntry`):

```typescript
function sanitizeBusyAgent(value: unknown): BusyAgent | null {
  const obj = asObject(value);
  if (!obj) return null;
  const name = typeof obj.name === "string" ? obj.name.trim() : "";
  if (!name) return null;
  const base = obj.base === "claude" ? "claude" : "codex";
  const execMode = (["safe", "balanced", "full-auto"] as const).includes(obj.executionMode as any)
    ? (obj.executionMode as "safe" | "balanced" | "full-auto")
    : "full-auto";
  const policyMap = { safe: "never", balanced: "unless-allow-listed", "full-auto": "full-auto" };
  const sandboxMap = { safe: "read-only", balanced: "workspace-write", "full-auto": "danger-full-access" };
  const now = Date.now();
  return {
    id: typeof obj.id === "string" ? obj.id : makeId(),
    name,
    role: typeof obj.role === "string" ? obj.role.trim() : "",
    icon: typeof obj.icon === "string" ? obj.icon : "🤖",
    base,
    model: typeof obj.model === "string" ? obj.model.trim() : "",
    executionMode: execMode,
    approvalPolicy: typeof obj.approvalPolicy === "string" ? obj.approvalPolicy : policyMap[execMode],
    sandboxMode: typeof obj.sandboxMode === "string" ? obj.sandboxMode : sandboxMap[execMode],
    systemPrompt: typeof obj.systemPrompt === "string" ? obj.systemPrompt : "",
    isPreset: typeof obj.isPreset === "boolean" ? obj.isPreset : false,
    createdAt: typeof obj.createdAt === "number" ? obj.createdAt : now,
    updatedAt: typeof obj.updatedAt === "number" ? obj.updatedAt : now,
  };
}
```

In `migrateStoredSettings`, add to the return object:

```typescript
    busyAgents: (Array.isArray(legacy.busyAgents) ? legacy.busyAgents : [])
      .map(sanitizeBusyAgent)
      .filter(Boolean) as BusyAgent[],
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run src/lib/settings.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/settings.ts src/lib/settings.test.ts
git commit -m "feat(agents): add BusyAgent persistence with sanitizer"
```

---

### Task 3: App.tsx — state + CRUD handlers

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add busyAgents state**

Near the `promptLibrary` state (~line 791), add:

```typescript
const [busyAgents, setBusyAgents] = useState<BusyAgent[]>([]);
```

Import `BusyAgent` from types and `mergeWithPresets` from `./lib/busyAgents`.

Add a derived merged list:

```typescript
const allAgents = useMemo(() => mergeWithPresets(busyAgents), [busyAgents]);
```

- [ ] **Step 2: Add to settings save object**

In the useMemo that builds the settings object for persistence, add `busyAgents`.

- [ ] **Step 3: Add to settings load**

In the migration load block (~line 1003), add:

```typescript
setBusyAgents(migrated.busyAgents);
```

- [ ] **Step 4: Add CRUD handlers** (follow promptLibrary pattern)

```typescript
function createBusyAgent(entry: Omit<BusyAgent, "id" | "createdAt" | "updatedAt">) {
  const now = Date.now();
  const agent: BusyAgent = { ...entry, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
  setBusyAgents((prev) => [...prev, agent]);
}

function updateBusyAgent(agent: BusyAgent) {
  setBusyAgents((prev) => prev.map((a) => a.id === agent.id ? { ...agent, updatedAt: Date.now() } : a));
}

function deleteBusyAgent(id: string) {
  setBusyAgents((prev) => prev.filter((a) => a.id !== id));
}

function resetBusyAgentToPreset(id: string) {
  const preset = PRESET_AGENTS.find((a) => a.id === id);
  if (!preset) return;
  setBusyAgents((prev) => prev.filter((a) => a.id !== id));
}
```

Import `PRESET_AGENTS` from `./lib/busyAgents`.

- [ ] **Step 5: Pass to SettingsView**

Add props to the `<SettingsView>` call:

```typescript
busyAgents={allAgents}
onCreateBusyAgent={createBusyAgent}
onUpdateBusyAgent={updateBusyAgent}
onDeleteBusyAgent={deleteBusyAgent}
onResetBusyAgent={resetBusyAgentToPreset}
```

- [ ] **Step 6: Add to resetEnvironment handler**

In the `onResetEnvironment` callback, add `setBusyAgents([])`.

- [ ] **Step 7: Verify compile**

Run: `npx tsc --noEmit`
Expected: FAIL — SettingsView doesn't accept new props yet (that's Task 4)

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx
git commit -m "feat(agents): add busyAgents state and CRUD handlers in App.tsx"
```

---

### Task 4: Settings → Agents tab UI

**Files:**
- Modify: `src/components/SettingsView.tsx`
- Modify: `src/components/SettingsView.css`

- [ ] **Step 1: Add SectionId and props**

Add `"agents"` to `SectionId` type (after `"library"`).
Add `agents: "Agents"` to `SECTION_LABELS`.

Add props to `SettingsViewProps`:

```typescript
busyAgents: BusyAgent[];
onCreateBusyAgent: (entry: Omit<BusyAgent, "id" | "createdAt" | "updatedAt">) => void;
onUpdateBusyAgent: (agent: BusyAgent) => void;
onDeleteBusyAgent: (id: string) => void;
onResetBusyAgent: (id: string) => void;
```

Import `BusyAgent` from types.

- [ ] **Step 2: Add agents section JSX**

After the `library` section block, add the agents section. Two views: grid (default) and editor (when `editingAgentId` is set).

Add state:
```typescript
const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
const [agentForm, setAgentForm] = useState<Partial<BusyAgent>>({});
```

Grid view: maps `props.busyAgents`, separating presets from custom agents, renders cards.
Editor view: shows form fields, save/clone/delete/reset buttons.

(Full JSX is large — implementer should follow the wireframe from the spec and the pattern of the library section.)

Key elements:
- Card grid: 2 columns, each card has icon, name, role, base/model/execution chips, PRESET badge
- Click card → `setEditingAgentId(agent.id)` + populate `agentForm`
- Editor: back link, name input, icon input, role input, base select, model select (options based on base), execution select, systemPrompt textarea
- Save button: calls `onUpdateBusyAgent` or `onCreateBusyAgent`
- Clone button: creates a copy with `isPreset: false` and new ID
- Delete button: only for non-preset agents
- Reset button: only for preset agents, calls `onResetBusyAgent`
- "+ New Agent" button: opens editor with empty form

- [ ] **Step 3: Add CSS**

Add to `src/components/SettingsView.css`:

```css
.agent-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  width: min(760px, 100%);
}

.agent-card {
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: color-mix(in srgb, var(--vp-c-bg-soft) 74%, transparent);
  padding: 10px 12px;
  cursor: pointer;
  transition: border-color 0.15s;
}

.agent-card:hover {
  border-color: var(--vp-c-brand-3);
}

.agent-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.agent-card-icon {
  font-size: 18px;
}

.agent-card-name {
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.agent-card-role {
  font-size: 0.7rem;
  color: var(--vp-c-text-3);
}

.agent-card-preset-badge {
  margin-left: auto;
  font-size: 0.62rem;
  color: var(--vp-c-text-3);
  border: 1px solid var(--vp-c-divider);
  border-radius: 3px;
  padding: 1px 4px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.agent-card-chips {
  display: flex;
  gap: 4px;
}

.agent-card-chip {
  background: var(--vp-c-bg-mute);
  padding: 2px 6px;
  border-radius: 2px;
  font-size: 0.68rem;
  color: var(--vp-c-text-2);
}

.agent-section-label {
  font-size: 0.7rem;
  color: var(--vp-c-text-3);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
}

.agent-editor {
  width: min(640px, 100%);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.agent-editor-back {
  background: transparent;
  border: none;
  color: var(--vp-c-brand-1);
  cursor: pointer;
  font-size: 0.82rem;
  padding: 0;
}

.agent-editor-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.agent-new-card {
  border: 1px dashed var(--vp-c-divider);
  border-radius: 12px;
  padding: 20px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--vp-c-text-3);
  font-size: 0.82rem;
}

.agent-new-card:hover {
  border-color: var(--vp-c-brand-3);
  color: var(--vp-c-text-1);
}
```

- [ ] **Step 4: Verify compile + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/SettingsView.tsx src/components/SettingsView.css
git commit -m "feat(agents): add Settings → Agents tab with card grid and editor"
```

---

## Verification

1. `npx tsc --noEmit` — compiles
2. `npx vitest run` — all tests pass
3. `cargo tauri dev`:
   - Settings → Agents shows 10 preset agent cards in a grid
   - Click card → editor with all fields populated
   - Edit name/model/system prompt → Save → card updates
   - Clone → creates a copy in Custom section
   - "+ New Agent" → empty editor, fill in, Save → appears in Custom
   - Delete custom agent → removed
   - Reset preset agent → reverts to default
   - Restart app → customizations and custom agents persist
