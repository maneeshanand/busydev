# Providers Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Providers" section to Settings for managing LLM providers — enable/disable them, configure models, set defaults, and control which appear in the prompt composer.

**Architecture:** New `LlmProvider` type persisted in `StoredSettings.providers`. A "Providers" section in SettingsView renders a list of providers (Codex, Claude, DeepSeek) with enable toggle, model list, and default model selection. The prompt composer agent/model dropdowns read from enabled providers instead of hardcoded lists.

**Tech Stack:** React, TypeScript, vitest

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/types.ts` | `LlmProvider` interface |
| `src/lib/providers.ts` | Default providers, helper functions |
| `src/lib/providers.test.ts` | Tests for provider helpers |
| `src/lib/settings.ts` | Add `providers` to `StoredSettings`, migration |
| `src/components/SettingsView.tsx` | Add "Providers" section with list UI |
| `src/App.tsx` | Provider state, pass to SettingsView and prompt composer, use for agent/model dropdowns |

---

### Task 1: LlmProvider type and default providers

**Files:**
- Modify: `src/types.ts`
- Create: `src/lib/providers.ts`
- Create: `src/lib/providers.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/providers.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import type { LlmProvider } from "../types";
import {
  DEFAULT_PROVIDERS,
  getEnabledProviders,
  getModelsForProvider,
  getDefaultModel,
  mergeWithDefaults,
} from "./providers";

describe("DEFAULT_PROVIDERS", () => {
  it("includes codex, claude, and deepseek", () => {
    const ids = DEFAULT_PROVIDERS.map((p) => p.id);
    expect(ids).toContain("codex");
    expect(ids).toContain("claude");
    expect(ids).toContain("deepseek");
  });

  it("all have at least one model", () => {
    for (const p of DEFAULT_PROVIDERS) {
      expect(p.models.length).toBeGreaterThan(0);
    }
  });

  it("all have a defaultModel that is in their models list", () => {
    for (const p of DEFAULT_PROVIDERS) {
      expect(p.models).toContain(p.defaultModel);
    }
  });
});

describe("getEnabledProviders", () => {
  it("returns only enabled providers", () => {
    const providers: LlmProvider[] = [
      { ...DEFAULT_PROVIDERS[0], enabled: true },
      { ...DEFAULT_PROVIDERS[1], enabled: false },
      { ...DEFAULT_PROVIDERS[2], enabled: true },
    ];
    const enabled = getEnabledProviders(providers);
    expect(enabled).toHaveLength(2);
    expect(enabled.map((p) => p.id)).not.toContain(DEFAULT_PROVIDERS[1].id);
  });
});

describe("getModelsForProvider", () => {
  it("returns models for a known provider", () => {
    const models = getModelsForProvider(DEFAULT_PROVIDERS, "claude");
    expect(models).toContain("claude-sonnet-4-6");
    expect(models).toContain("claude-opus-4-6");
  });

  it("returns empty array for unknown provider", () => {
    expect(getModelsForProvider(DEFAULT_PROVIDERS, "nope")).toEqual([]);
  });
});

describe("getDefaultModel", () => {
  it("returns defaultModel for a known provider", () => {
    const model = getDefaultModel(DEFAULT_PROVIDERS, "codex");
    expect(model).toBe("codex-mini");
  });

  it("returns empty string for unknown provider", () => {
    expect(getDefaultModel(DEFAULT_PROVIDERS, "nope")).toBe("");
  });
});

describe("mergeWithDefaults", () => {
  it("adds missing providers from defaults", () => {
    const userProviders: LlmProvider[] = [
      { ...DEFAULT_PROVIDERS[0] },
    ];
    const merged = mergeWithDefaults(userProviders);
    expect(merged).toHaveLength(DEFAULT_PROVIDERS.length);
  });

  it("preserves user overrides", () => {
    const userProviders: LlmProvider[] = [
      { ...DEFAULT_PROVIDERS[0], enabled: false, defaultModel: "o3" },
    ];
    const merged = mergeWithDefaults(userProviders);
    const codex = merged.find((p) => p.id === "codex")!;
    expect(codex.enabled).toBe(false);
    expect(codex.defaultModel).toBe("o3");
  });

  it("updates models list from defaults while keeping user defaultModel", () => {
    const userProviders: LlmProvider[] = [
      { ...DEFAULT_PROVIDERS[0], models: ["old-model"], defaultModel: "codex-mini" },
    ];
    const merged = mergeWithDefaults(userProviders);
    const codex = merged.find((p) => p.id === "codex")!;
    expect(codex.models).toEqual(DEFAULT_PROVIDERS[0].models);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/providers.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Add LlmProvider type to types.ts**

Add to `src/types.ts` after the `BusyAgent` interface (around line 94):

```typescript
export interface LlmProvider {
  id: string;
  name: string;
  enabled: boolean;
  models: string[];
  defaultModel: string;
}
```

- [ ] **Step 4: Create providers.ts**

Create `src/lib/providers.ts`:

```typescript
import type { LlmProvider } from "../types";

export const DEFAULT_PROVIDERS: LlmProvider[] = [
  {
    id: "codex",
    name: "Codex",
    enabled: true,
    models: ["codex-mini", "o3", "o4-mini"],
    defaultModel: "codex-mini",
  },
  {
    id: "claude",
    name: "Claude",
    enabled: true,
    models: ["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5"],
    defaultModel: "claude-sonnet-4-6",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    enabled: false,
    models: ["deepseek-chat", "deepseek-reasoner"],
    defaultModel: "deepseek-reasoner",
  },
];

export function getEnabledProviders(providers: LlmProvider[]): LlmProvider[] {
  return providers.filter((p) => p.enabled);
}

export function getModelsForProvider(providers: LlmProvider[], providerId: string): string[] {
  return providers.find((p) => p.id === providerId)?.models ?? [];
}

export function getDefaultModel(providers: LlmProvider[], providerId: string): string {
  return providers.find((p) => p.id === providerId)?.defaultModel ?? "";
}

export function mergeWithDefaults(userProviders: LlmProvider[]): LlmProvider[] {
  const userMap = new Map(userProviders.map((p) => [p.id, p]));
  return DEFAULT_PROVIDERS.map((def) => {
    const user = userMap.get(def.id);
    if (!user) return { ...def };
    return {
      ...def,
      enabled: user.enabled,
      defaultModel: def.models.includes(user.defaultModel) ? user.defaultModel : def.defaultModel,
    };
  });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/providers.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/lib/providers.ts src/lib/providers.test.ts
git commit -m "feat(settings): add LlmProvider type and default providers with tests"
```

---

### Task 2: Add providers to StoredSettings and migration

**Files:**
- Modify: `src/lib/settings.ts`

- [ ] **Step 1: Add providers to StoredSettings interface**

In `src/lib/settings.ts`, add to the `StoredSettings` interface (after `busyAgents`):

```typescript
  providers: LlmProvider[];
```

Add import at top:

```typescript
import type { LlmProvider } from "../types";
```

- [ ] **Step 2: Add providers to migrateStoredSettings**

Find the `migrateStoredSettings` function. After the existing field migrations, add:

```typescript
    providers: Array.isArray(raw.providers) ? raw.providers : [],
```

- [ ] **Step 3: Bump SETTINGS_VERSION**

Find `const SETTINGS_VERSION` and increment it by 1.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: Errors in App.tsx where `buildSettingsSnapshot` is missing `providers` — that's expected, will be fixed in Task 4.

- [ ] **Step 5: Commit**

```bash
git add src/lib/settings.ts
git commit -m "feat(settings): add providers to StoredSettings with migration"
```

---

### Task 3: Add Providers section to SettingsView

**Files:**
- Modify: `src/components/SettingsView.tsx`

- [ ] **Step 1: Add "providers" to SectionId type**

```typescript
export type SectionId =
  | "general"
  | "execution"
  | "todo"
  | "library"
  | "agents"
  | "providers"
  | "terminal"
  | "advanced";
```

- [ ] **Step 2: Add label to SECTION_LABELS**

```typescript
const SECTION_LABELS: Record<SectionId, string> = {
  general: "General",
  execution: "Execution",
  todo: "Todo",
  library: "Prompt Library",
  agents: "Agents",
  providers: "Providers",
  terminal: "Terminal",
  advanced: "Advanced",
};
```

- [ ] **Step 3: Add provider props to SettingsViewProps**

Add to the `SettingsViewProps` interface:

```typescript
  providers: LlmProvider[];
  onUpdateProvider: (provider: LlmProvider) => void;
```

Add import at top:

```typescript
import type { BusyAgent, LlmProvider, SavedPromptEntry } from "../types";
```

- [ ] **Step 4: Add Providers section rendering**

Find the section rendering block (the `{activeSection === "agents" && (` block). After the agents section closing `)}`, add:

```typescript
          {activeSection === "providers" && (
            <div className="settings-section">
              <h2>Providers</h2>
              <p className="settings-hint">
                Enable or disable LLM providers and set default models. Enabled providers appear in the prompt composer.
              </p>
              <div className="settings-provider-list">
                {props.providers.map((provider) => (
                  <div key={provider.id} className="settings-provider-row">
                    <div className="settings-provider-header">
                      <label className="settings-provider-toggle">
                        <input
                          type="checkbox"
                          checked={provider.enabled}
                          onChange={(e) =>
                            props.onUpdateProvider({ ...provider, enabled: e.target.checked })
                          }
                        />
                        <span className="settings-provider-name">{provider.name}</span>
                      </label>
                    </div>
                    {provider.enabled && (
                      <div className="settings-provider-details">
                        <label className="settings-provider-model-label">
                          Default model
                          <select
                            value={provider.defaultModel}
                            onChange={(e) =>
                              props.onUpdateProvider({ ...provider, defaultModel: e.target.value })
                            }
                          >
                            {provider.models.map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </label>
                        <div className="settings-provider-models">
                          <span className="settings-provider-models-label">Available models:</span>
                          {provider.models.map((m) => (
                            <span key={m} className="settings-provider-model-chip">{m}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: Errors in App.tsx where SettingsView is missing new props — expected, fixed in Task 4.

- [ ] **Step 6: Commit**

```bash
git add src/components/SettingsView.tsx
git commit -m "feat(settings): add Providers section to SettingsView"
```

---

### Task 4: Add provider CSS to SettingsView.css

**Files:**
- Modify: `src/components/SettingsView.css`

- [ ] **Step 1: Add provider styles**

Append to `src/components/SettingsView.css`:

```css
/* ── Providers ─────────────────────────────────────────────────── */

.settings-provider-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.settings-provider-row {
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  padding: 14px 16px;
}

.settings-provider-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.settings-provider-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-size: 0.86rem;
  font-weight: 500;
}

.settings-provider-toggle input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #6366f1;
  cursor: pointer;
}

.settings-provider-name {
  color: var(--vp-c-text-1);
}

.settings-provider-details {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--vp-c-divider);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.settings-provider-model-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.78rem;
  color: var(--vp-c-text-2);
}

.settings-provider-model-label select {
  font-family: var(--vp-font-family-mono);
  font-size: 0.78rem;
  padding: 3px 8px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  color: var(--vp-c-text-1);
}

.settings-provider-models {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.settings-provider-models-label {
  font-size: 0.72rem;
  color: var(--vp-c-text-3);
}

.settings-provider-model-chip {
  font-family: var(--vp-font-family-mono);
  font-size: 0.68rem;
  padding: 2px 8px;
  background: var(--vp-c-bg-mute);
  border: 1px solid var(--vp-c-divider);
  border-radius: 3px;
  color: var(--vp-c-text-2);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SettingsView.css
git commit -m "style(settings): add Providers section CSS"
```

---

### Task 5: Wire providers into App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add imports**

Add at top of App.tsx:

```typescript
import { DEFAULT_PROVIDERS, getEnabledProviders, getModelsForProvider, mergeWithDefaults } from "./lib/providers";
```

- [ ] **Step 2: Add providers state**

After the `busyAgents` state declaration (search for `useState<BusyAgent[]>`), add:

```typescript
const [providers, setProviders] = useState<LlmProvider[]>(() => mergeWithDefaults([]));
```

Add `LlmProvider` to the type import from `"./types"`.

- [ ] **Step 3: Add provider update handler**

After the `deleteBusyAgent` function, add:

```typescript
  function updateProvider(provider: LlmProvider) {
    setProviders((prev) => prev.map((p) => p.id === provider.id ? provider : p));
  }
```

- [ ] **Step 4: Add providers to buildSettingsSnapshot**

In the `buildSettingsSnapshot` callback, add `providers` to the returned object.

Add `providers` to the `useCallback` dependency array.

- [ ] **Step 5: Load providers from saved settings**

In the settings hydration block (search for `setBusyAgents(migrated.busyAgents`), add after it:

```typescript
          if (migrated.providers) setProviders(mergeWithDefaults(migrated.providers));
```

- [ ] **Step 6: Pass providers to SettingsView**

Find the `<SettingsView` JSX. Add these props:

```typescript
              providers={providers}
              onUpdateProvider={updateProvider}
```

- [ ] **Step 7: Replace hardcoded agent dropdown with providers-driven list**

Find the agent select in the prompt composer (the `<select>` with `raw:codex`, `raw:claude`, `raw:deepseek` options around line 2750). Replace the three hardcoded `<option>` elements:

```typescript
                <option value="raw:codex">Codex</option>
                <option value="raw:claude">Claude</option>
                <option value="raw:deepseek">DeepSeek</option>
```

With:

```typescript
                {getEnabledProviders(providers).map((p) => (
                  <option key={p.id} value={`raw:${p.id}`}>{p.name}</option>
                ))}
```

- [ ] **Step 8: Replace hardcoded model dropdowns with providers-driven list**

Find the model select in the prompt composer (the `<select>` with hardcoded claude/codex/deepseek model options). Replace the ternary chain:

```typescript
                    {agent === "claude" ? (
                      <>
                        <option value="">claude-sonnet-4-6</option>
                        <option value="claude-opus-4-6">claude-opus-4-6</option>
                        <option value="claude-haiku-4-5">claude-haiku-4-5</option>
                      </>
                    ) : agent === "deepseek" ? (
                      <option value="">deepseek-reasoner</option>
                    ) : (
                      <>
                        <option value="">codex-mini</option>
                        <option value="o3">o3</option>
                        <option value="o4-mini">o4-mini</option>
                      </>
                    )}
```

With:

```typescript
                    {getModelsForProvider(providers, agent).map((m, i) => (
                      <option key={m} value={i === 0 ? "" : m}>{m}</option>
                    ))}
```

- [ ] **Step 9: Replace hardcoded model lists in SettingsView agents section**

Find the model dropdown in the agents section of SettingsView.tsx (around line 326). Replace:

```typescript
                    {((agentForm.base ?? "codex") === "claude"
                      ? ["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5"]
                      : ["codex-mini", "o3", "o4-mini"]).map((m) => (
```

With:

```typescript
                    {(getModelsForProvider(props.providers, agentForm.base ?? "codex")).map((m) => (
```

Add import at top of SettingsView.tsx:

```typescript
import { getModelsForProvider } from "../lib/providers";
```

- [ ] **Step 10: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 11: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 12: Commit**

```bash
git add src/App.tsx src/components/SettingsView.tsx
git commit -m "feat(settings): wire providers into App and prompt composer"
```

---

### Task 6: End-to-end verification

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: Build succeeds
