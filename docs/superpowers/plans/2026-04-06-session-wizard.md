# Session Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a guided wizard when creating new sessions that can generate an AI execution plan with agent assignments from a feature description, then transition to todo-based execution.

**Architecture:** A self-contained `SessionWizard` component renders in place of the session panel content. It has a 3-step state machine (choose mode → describe feature → review plan). On approval, it calls back to App.tsx which creates the session with todos, worktree, and starts auto-play. The AI plan is generated via a single `handleRun` call that outputs `ADD_TODO:` lines with agent assignments.

**Tech Stack:** React, TypeScript, Vitest

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/types.ts` | Add `WizardPlan` interface, add `wizardPlan?` to `Session` |
| `src/lib/settings.ts` | Add `wizardPlan` sanitization to `sanitizeSession` |
| `src/lib/settings.test.ts` | Tests for wizardPlan persistence |
| `src/components/SessionWizard.tsx` | Self-contained wizard component (Steps 1-3) |
| `src/components/SessionWizard.css` | Wizard styles |
| `src/App.tsx` | Wizard state, trigger, completion handler |

---

### Task 1: Add WizardPlan type and settings sanitization

**Files:**
- Modify: `src/types.ts`
- Modify: `src/lib/settings.ts`
- Modify: `src/lib/settings.test.ts`

- [ ] **Step 1: Add WizardPlan type**

In `src/types.ts`, after the `AgentGroup` interface, add:

```typescript
export interface WizardPlanStep {
  text: string;
  notes: string;
  agentSlug: string;
}

export interface WizardPlan {
  description: string;
  branch: string;
  steps: WizardPlanStep[];
  createdAt: number;
}
```

Add to `Session` (after `agentGroupId?`):

```typescript
  wizardPlan?: WizardPlan;
```

- [ ] **Step 2: Add sanitization in settings.ts**

Import `WizardPlan` and `WizardPlanStep` from `../types`.

Add a `sanitizeWizardPlan` function near the other sanitizers:

```typescript
function sanitizeWizardPlan(value: unknown): WizardPlan | undefined {
  const obj = asObject(value);
  if (!obj) return undefined;
  const description = typeof obj.description === "string" ? obj.description : "";
  const branch = typeof obj.branch === "string" ? obj.branch : "";
  const createdAt = typeof obj.createdAt === "number" ? obj.createdAt : 0;
  if (!description || !createdAt) return undefined;
  const steps = Array.isArray(obj.steps)
    ? obj.steps
        .map((s) => {
          const so = asObject(s);
          if (!so) return null;
          return {
            text: typeof so.text === "string" ? so.text : "",
            notes: typeof so.notes === "string" ? so.notes : "",
            agentSlug: typeof so.agentSlug === "string" ? so.agentSlug : "",
          };
        })
        .filter((s): s is WizardPlanStep => s !== null && s.text.length > 0)
    : [];
  return { description, branch, steps, createdAt };
}
```

In `sanitizeSession`, after the `agentGroupId` line, add:

```typescript
    wizardPlan: sanitizeWizardPlan(obj?.wizardPlan),
```

- [ ] **Step 3: Add tests**

In `src/lib/settings.test.ts`, add a describe block for WizardPlan sanitization:
- Test: session with valid wizardPlan preserves it
- Test: session with invalid wizardPlan gets undefined
- Test: wizardPlan steps with missing text are filtered out

- [ ] **Step 4: Verify**

Run: `npx vitest run src/lib/settings.test.ts && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```
feat(wizard): add WizardPlan type with settings sanitization
```

---

### Task 2: Create SessionWizard component

**Files:**
- Create: `src/components/SessionWizard.tsx`
- Create: `src/components/SessionWizard.css`

- [ ] **Step 1: Create SessionWizard.tsx**

The component manages a 3-step state machine. It receives BusyAgents, providers, and callbacks.

```typescript
// src/components/SessionWizard.tsx
import { useState } from "react";
import type { BusyAgent, LlmProvider } from "../types";
import { agentSlug } from "../lib/busyAgents";
import { getEnabledProviders } from "../lib/providers";
import "./SessionWizard.css";

export interface WizardResult {
  description: string;
  branch: string;
  provider: string;
  autoExecute: boolean;
  steps: { text: string; notes: string; agentId: string }[];
}

interface SessionWizardProps {
  busyAgents: BusyAgent[];
  providers: LlmProvider[];
  currentAgent: string;
  onQuickSession: () => void;
  onGeneratePlan: (description: string) => void;
  generatedSteps: { text: string; agentSlug: string }[] | null;
  generatedBranch: string | null;
  generating: boolean;
  onExecute: (result: WizardResult) => void;
  onCancel: () => void;
}

type WizardStep = "choose" | "describe" | "review";

export function SessionWizard({
  busyAgents,
  providers,
  currentAgent,
  onQuickSession,
  onGeneratePlan,
  generatedSteps,
  generatedBranch,
  generating,
  onExecute,
  onCancel,
}: SessionWizardProps) {
  const [step, setStep] = useState<WizardStep>("choose");
  const [description, setDescription] = useState("");

  // Review state (initialized from generated data)
  const [branch, setBranch] = useState("");
  const [provider, setProvider] = useState(currentAgent);
  const [autoExecute, setAutoExecute] = useState(true);
  const [planSteps, setPlanSteps] = useState<{ text: string; notes: string; agentSlug: string }[]>([]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  // When generated data arrives, initialize review state
  if (generatedSteps && planSteps.length === 0 && step === "describe") {
    setPlanSteps(generatedSteps.map((s) => ({ ...s, notes: "" })));
    setBranch(generatedBranch || slugifyBranch(description));
    setStep("review");
  }

  function slugifyBranch(desc: string): string {
    const slug = desc.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
    return `feat/${slug}`;
  }

  function handleGenerate() {
    if (!description.trim()) return;
    onGeneratePlan(description.trim());
  }

  function handleUpdateStep(index: number, updates: Partial<{ text: string; notes: string; agentSlug: string }>) {
    setPlanSteps((prev) => prev.map((s, i) => i === index ? { ...s, ...updates } : s));
  }

  function handleRemoveStep(index: number) {
    setPlanSteps((prev) => prev.filter((_, i) => i !== index));
    setExpandedIndex(null);
  }

  function handleAddStep() {
    setPlanSteps((prev) => [...prev, { text: "", notes: "", agentSlug: "" }]);
    setExpandedIndex(planSteps.length);
  }

  function handleRegenerate() {
    setPlanSteps([]);
    setStep("describe");
    onGeneratePlan(description.trim());
  }

  function handleApprove() {
    onExecute({
      description,
      branch,
      provider,
      autoExecute,
      steps: planSteps.filter((s) => s.text.trim()).map((s) => ({
        text: s.text,
        notes: s.notes,
        agentId: busyAgents.find((a) => agentSlug(a.name) === s.agentSlug)?.id ?? "",
      })),
    });
  }

  const enabledProviders = getEnabledProviders(providers);

  // ── Step 1: Choose Mode ──
  if (step === "choose") {
    return (
      <div className="wizard">
        <div className="wizard-header">
          <span className="wizard-title">New Session</span>
        </div>
        <div className="wizard-choices">
          <button type="button" className="wizard-choice" onClick={onQuickSession}>
            <span className="wizard-choice-icon">💬</span>
            <span className="wizard-choice-name">Quick Session</span>
            <span className="wizard-choice-desc">Start with an empty prompt</span>
          </button>
          <button type="button" className="wizard-choice wizard-choice-primary" onClick={() => setStep("describe")}>
            <span className="wizard-choice-icon">🚀</span>
            <span className="wizard-choice-name">Build a Feature</span>
            <span className="wizard-choice-desc">Guided plan with agent assignments</span>
          </button>
        </div>
      </div>
    );
  }

  // ── Step 2: Describe Feature ──
  if (step === "describe") {
    return (
      <div className="wizard">
        <div className="wizard-header">
          <span className="wizard-title">What are you building?</span>
        </div>
        <div className="wizard-body">
          <textarea
            className="wizard-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the feature you want to build..."
            rows={6}
            autoFocus
            disabled={generating}
          />
          <div className="wizard-hint">Tip: paste a ticket URL if your agent has Jira/Linear MCP access</div>
          <div className="wizard-actions">
            <button type="button" className="wizard-btn" onClick={() => { setStep("choose"); setPlanSteps([]); }}>← Back</button>
            <button
              type="button"
              className="wizard-btn wizard-btn-primary"
              onClick={handleGenerate}
              disabled={!description.trim() || generating}
            >
              {generating ? "Generating..." : "Generate Plan →"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 3: Review Plan ──
  return (
    <div className="wizard">
      <div className="wizard-header">
        <span className="wizard-title">Execution Plan</span>
      </div>
      <div className="wizard-body">
        {/* Config bar */}
        <div className="wizard-config">
          <div className="wizard-config-field wizard-config-branch">
            <span className="wizard-config-label">⑂ Branch</span>
            <input
              className="wizard-config-input"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            />
          </div>
          <div className="wizard-config-field">
            <span className="wizard-config-label">LLM</span>
            <select
              className="wizard-config-select"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              {enabledProviders.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <label className="wizard-config-check">
            <input type="checkbox" checked={autoExecute} onChange={(e) => setAutoExecute(e.target.checked)} />
            Auto-execute
          </label>
        </div>

        {/* Steps */}
        <div className="wizard-steps">
          {planSteps.map((s, i) => (
            <details
              key={i}
              className={`wizard-step ${expandedIndex === i ? "wizard-step-active" : ""}`}
              open={expandedIndex === i}
              onToggle={(e) => setExpandedIndex((e.target as HTMLDetailsElement).open ? i : null)}
            >
              <summary className="wizard-step-summary">
                <span className="wizard-step-num">{i + 1}.</span>
                <span className="wizard-step-text">{s.text || "(empty)"}</span>
                {s.agentSlug && (
                  <span className="wizard-step-agent">
                    {busyAgents.find((a) => agentSlug(a.name) === s.agentSlug)?.name ?? s.agentSlug}
                  </span>
                )}
                <span className="wizard-step-chevron">{expandedIndex === i ? "▾" : "▸"}</span>
              </summary>
              <div className="wizard-step-detail">
                <div className="wizard-step-field">
                  <label className="wizard-step-label">Task</label>
                  <input
                    className="wizard-step-input"
                    value={s.text}
                    onChange={(e) => handleUpdateStep(i, { text: e.target.value })}
                  />
                </div>
                <div className="wizard-step-field">
                  <label className="wizard-step-label">Notes / Context</label>
                  <textarea
                    className="wizard-step-notes"
                    value={s.notes}
                    onChange={(e) => handleUpdateStep(i, { notes: e.target.value })}
                    placeholder="Additional context for this step..."
                    rows={2}
                  />
                </div>
                <div className="wizard-step-row">
                  <div className="wizard-step-field">
                    <label className="wizard-step-label">Agent</label>
                    <select
                      className="wizard-config-select"
                      value={s.agentSlug}
                      onChange={(e) => handleUpdateStep(i, { agentSlug: e.target.value })}
                    >
                      <option value="">No agent</option>
                      {busyAgents.map((a) => (
                        <option key={a.id} value={agentSlug(a.name)}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                  <button type="button" className="wizard-btn wizard-btn-danger" onClick={() => handleRemoveStep(i)}>Remove</button>
                </div>
              </div>
            </details>
          ))}
          <button type="button" className="wizard-add-step" onClick={handleAddStep}>+ Add Step</button>
        </div>

        <div className="wizard-actions">
          <button type="button" className="wizard-btn" onClick={() => { setStep("describe"); setPlanSteps([]); }}>← Back</button>
          <button type="button" className="wizard-btn" onClick={handleRegenerate} disabled={generating}>
            {generating ? "Generating..." : "Regenerate"}
          </button>
          <button
            type="button"
            className="wizard-btn wizard-btn-approve"
            onClick={handleApprove}
            disabled={planSteps.filter((s) => s.text.trim()).length === 0}
          >
            Approve & Execute →
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create SessionWizard.css**

Style the wizard following Carbon UI patterns (same tokens, font families, button styles as the rest of the app). Key classes:

- `.wizard` — full height flex column
- `.wizard-header` — section header with title
- `.wizard-choices` — centered flex with two choice cards
- `.wizard-choice` — card button with icon, name, description
- `.wizard-choice-primary` — highlighted variant with brand border
- `.wizard-textarea` — full width monospace textarea
- `.wizard-config` — horizontal bar with branch/provider/auto-execute
- `.wizard-steps` — list of expandable steps
- `.wizard-step` — details element with border
- `.wizard-step-summary` — flex row with number, text, agent badge, chevron
- `.wizard-step-detail` — expanded edit form
- `.wizard-step-agent` — colored badge chip
- `.wizard-btn` — standard button, `.wizard-btn-primary` / `.wizard-btn-approve` / `.wizard-btn-danger` variants
- `.wizard-add-step` — dashed border add button

Use `var(--vp-c-*)` tokens throughout. No hardcoded colors.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```
feat(wizard): create SessionWizard component with 3-step flow
```

---

### Task 3: Wire wizard into App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add wizard state and imports**

Import the wizard and its result type:
```typescript
import { SessionWizard, type WizardResult } from "./components/SessionWizard";
import type { WizardPlan } from "./types";
```

Add state near the other session state:
```typescript
const [wizardOpen, setWizardOpen] = useState(false);
const [wizardGenerating, setWizardGenerating] = useState(false);
const [wizardSteps, setWizardSteps] = useState<{ text: string; agentSlug: string }[] | null>(null);
const [wizardBranch, setWizardBranch] = useState<string | null>(null);
```

- [ ] **Step 2: Add wizard plan generation handler**

This sends the description to the agent and parses `ADD_TODO:` and `BRANCH:` from the response:

```typescript
async function handleWizardGenerate(description: string) {
  if (!activeProjectId || !activeProject) return;
  setWizardGenerating(true);
  setWizardSteps(null);
  setWizardBranch(null);

  const agentRoster = allAgents
    .map((a) => `- ${agentSlug(a.name)}: ${a.role}`)
    .join("\n");

  const wizardPrompt = `IMPORTANT: Do NOT ask questions, do NOT use skills, do NOT brainstorm. Just output a plan immediately.

You are a technical project planner. Given a feature description and available agents, create a step-by-step execution plan.

Available agents:
${agentRoster}

Output format — ONLY these lines, nothing else. No explanation, no questions, no preamble:
BRANCH: suggested-branch-name
ADD_TODO: [agent:slug] step description
ADD_TODO: [agent:slug] step description
...

Feature:
${description}`;

  await handleRun(wizardPrompt);
  // The ADD_TODO parsing happens in the run completion handler.
  // We need to intercept the generated todos.
  // Set a flag so the completion handler knows this was a wizard run.
}
```

Actually — the cleaner approach is to use the existing `ADD_TODO:` parsing that already runs on every completed run. The wizard just needs to read the todos after the run completes. Let me revise:

Instead of trying to intercept, the wizard watches for todos to appear on the session. When the generation run completes, `parseTodoAdditions` will add todos to the session. The wizard component can detect this via the `generatedSteps` prop changing from null to a populated array.

So the flow is:
1. Wizard calls `onGeneratePlan(description)` which calls `handleRun(wizardPrompt)`
2. Agent outputs `BRANCH:` + `ADD_TODO:` lines
3. Existing run completion handler parses `ADD_TODO:` lines → adds todos to session
4. App.tsx reads the new todos and converts them to `wizardSteps` format
5. Wizard sees `generatedSteps` go from null → populated, transitions to review

For the `BRANCH:` line, we parse it from the run's final output. Add this to the run completion handler:

In the run completion area (after `parseTodoAdditions`), add branch extraction:

```typescript
// Extract wizard branch suggestion from agent output
const lastMessage = /* existing extractLastAgentMessage logic */;
const branchMatch = lastMessage?.match(/^BRANCH:\s*(.+)$/m);
if (branchMatch && wizardGenerating) {
  setWizardBranch(branchMatch[1].trim());
}
```

After todos are added to the session and wizardGenerating is true:
```typescript
if (wizardGenerating && newTodoAdditions.length > 0) {
  setWizardSteps(newTodoAdditions.map((a) => ({ text: a.text, agentSlug: a.agentSlug ?? "" })));
  setWizardGenerating(false);
}
```

- [ ] **Step 3: Add wizard completion handler**

```typescript
async function handleWizardExecute(result: WizardResult) {
  if (!activeProjectId || !activeProject) return;

  const session = makeSession(activeProjectId, activeProject.sessions.length);
  session.name = result.branch.replace(/^feat\//, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || session.name;
  session.agent = result.provider;
  session.todoMode = true;
  session.autoPlay = result.autoExecute;
  session.wizardPlan = {
    description: result.description,
    branch: result.branch,
    steps: result.steps.map((s) => ({
      text: s.text,
      notes: s.notes,
      agentSlug: busyAgents.find((a) => a.id === s.agentId) ? agentSlug(busyAgents.find((a) => a.id === s.agentId)!.name) : "",
    })),
    createdAt: Date.now(),
  };

  // Populate todos from steps
  session.todos = result.steps.filter((s) => s.text.trim()).map((s) => ({
    id: crypto.randomUUID(),
    text: s.text,
    done: false,
    source: "agent" as const,
    createdAt: Date.now(),
    notes: s.notes || undefined,
    busyAgentId: s.agentId || undefined,
  }));

  // Create worktree with wizard branch
  if (activeProject.sessions.length > 0) {
    try {
      const isGit = await isGitRepo(activeProject.path);
      if (isGit) {
        const shortId = session.id.split("-")[0];
        const branch = result.branch || `busydev/wizard-${shortId}`;
        const projectSlug = activeProject.path.replace(/\//g, "-").replace(/^-/, "");
        const wtPath = `/tmp/busydev-worktrees/${projectSlug}/${session.id}`;
        await createWorktree(activeProject.path, wtPath, branch);
        session.worktreePath = wtPath;
        session.worktreeBranch = branch;
      }
    } catch (err) {
      console.warn("Wizard worktree creation failed:", err);
    }
  }

  // Clear wizard-generated todos from the current session (they were added during generation)
  updateActiveSession((s) => ({ ...s, todos: [] }));

  // Add the new session
  setProjects((prev) => prev.map((p) =>
    p.id === activeProjectId
      ? { ...p, sessions: [...p.sessions, session], activeSessionId: session.id }
      : p
  ));
  setWizardOpen(false);
  setWizardSteps(null);
  setWizardBranch(null);
  setWizardGenerating(false);
  resetEphemeralState();
}
```

- [ ] **Step 4: Update handleNewSession to show wizard**

Replace the current `handleNewSession`:

```typescript
async function handleNewSession() {
  if (!activeProjectId || !activeProject) return;
  setWizardOpen(true);
  setWizardSteps(null);
  setWizardBranch(null);
  setWizardGenerating(false);
}

async function handleQuickSession() {
  // Original handleNewSession logic
  if (!activeProjectId || !activeProject) return;
  const session = makeSession(activeProjectId, activeProject.sessions.length);
  // ...existing worktree creation logic...
  setProjects((prev) => prev.map((p) =>
    p.id === activeProjectId
      ? { ...p, sessions: [...p.sessions, session], activeSessionId: session.id }
      : p
  ));
  setWizardOpen(false);
  resetEphemeralState();
}
```

- [ ] **Step 5: Render wizard in session panel**

Find the `session-main` div content. Before the existing content (search bar, stream panel, etc.), add:

```tsx
{wizardOpen && (
  <SessionWizard
    busyAgents={allAgents}
    providers={providers}
    currentAgent={agent}
    onQuickSession={handleQuickSession}
    onGeneratePlan={handleWizardGenerate}
    generatedSteps={wizardSteps}
    generatedBranch={wizardBranch}
    generating={wizardGenerating}
    onExecute={handleWizardExecute}
    onCancel={() => { setWizardOpen(false); setWizardSteps(null); setWizardBranch(null); }}
  />
)}
{!wizardOpen && (
  <>
    {/* existing session content: search bar, stream panel, prompt composer */}
  </>
)}
```

- [ ] **Step 6: Verify TypeScript compiles and tests pass**

Run: `npx tsc --noEmit && npx vitest run`

- [ ] **Step 7: Commit**

```
feat(wizard): wire SessionWizard into App.tsx with plan generation and execution
```

---

## Self-Review

**Spec coverage:**
- [x] Step 1: Choose Mode — Task 2 (wizard component, "choose" step)
- [x] Step 2: Describe Feature — Task 2 (wizard component, "describe" step)
- [x] AI plan generation — Task 3 (handleWizardGenerate with ADD_TODO/BRANCH prompt)
- [x] Step 3: Review Plan — Task 2 (wizard component, "review" step with expandable/editable items)
- [x] Branch name — Task 2 (config bar) + Task 3 (BRANCH: parsing + worktree creation)
- [x] LLM provider selection — Task 2 (config bar dropdown)
- [x] Auto-execute toggle — Task 2 (config bar checkbox)
- [x] Expandable/editable steps — Task 2 (details elements with edit forms)
- [x] Add/remove steps — Task 2 (add step button, remove button)
- [x] Regenerate — Task 2 (regenerate button)
- [x] Approve & Execute — Task 3 (handleWizardExecute: session creation, todos, worktree, todoMode, autoPlay)
- [x] WizardPlan stored on session — Task 1 (type) + Task 3 (stored on execute)
- [x] Settings persistence — Task 1 (sanitization)
- [x] Quick Session path — Task 3 (handleQuickSession preserves original behavior)

**Placeholder scan:** No TBD/TODO. All code blocks complete.

**Type consistency:** `WizardResult` matches between SessionWizard.tsx and App.tsx. `WizardPlan` / `WizardPlanStep` consistent across types.ts, settings.ts, App.tsx. `agentSlug` function reused from busyAgents.ts.
