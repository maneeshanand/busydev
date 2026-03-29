import { useEffect, useMemo, useState } from "react";
import type { BusyAgent, LlmProvider, SavedPromptEntry } from "../types";
import { getModelsForProvider } from "../lib/providers";
import { AgentIcon } from "./AgentIcon";
import "./SettingsView.css";

export type SectionId =
  | "general"
  | "execution"
  | "todo"
  | "library"
  | "agents"
  | "providers"
  | "terminal"
  | "advanced";

interface SettingsViewProps {
  open: boolean;
  onClose: () => void;
  initialSection?: SectionId;
  colorMode: "light" | "dark";
  setColorMode: (mode: "light" | "dark") => void;
  uiDensity: "comfortable" | "compact";
  setUiDensity: (density: "comfortable" | "compact") => void;
  splashEnabled: boolean;
  setSplashEnabled: (enabled: boolean) => void;
  splashDurationMs: number;
  setSplashDurationMs: (ms: number) => void;
  debugMode: boolean;
  setDebugMode: (enabled: boolean) => void;
  skipGitRepoCheck: boolean;
  setSkipGitRepoCheck: (enabled: boolean) => void;
  agent: string;
  approvalPolicy: string;
  setApprovalPolicy: (policy: string) => void;
  sandboxMode: string;
  setSandboxMode: (mode: string) => void;
  todoAutoPlayDefault: boolean;
  setTodoAutoPlayDefault: (enabled: boolean) => void;
  todoMaxRetries: number;
  setTodoMaxRetries: (n: number) => void;
  includeSessionHistoryInPrompt: boolean;
  setIncludeSessionHistoryInPrompt: (enabled: boolean) => void;
  claudeAutoContinue: boolean;
  setClaudeAutoContinue: (enabled: boolean) => void;
  terminalFontSize: number;
  setTerminalFontSize: (size: number) => void;
  terminalLineHeight: number;
  setTerminalLineHeight: (size: number) => void;
  rightPanelWidth: number;
  setRightPanelWidth: (width: number) => void;
  appVersion: string;
  appBuild: string;
  promptLibrary: SavedPromptEntry[];
  onCreatePromptLibraryEntry: (entry: { name: string; alias: string; kind: "prompt" | "function"; content: string }) => void;
  onUpdatePromptLibraryEntry: (entry: SavedPromptEntry) => void;
  onDeletePromptLibraryEntry: (id: string) => void;
  busyAgents: BusyAgent[];
  onCreateBusyAgent: (entry: Omit<BusyAgent, "id" | "createdAt" | "updatedAt">) => void;
  onUpdateBusyAgent: (agent: BusyAgent) => void;
  onDeleteBusyAgent: (id: string) => void;
  onResetBusyAgent: (id: string) => void;
  providers: LlmProvider[];
  onUpdateProvider: (provider: LlmProvider) => void;
  onResetEnvironment: () => void;
}

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

export function SettingsView(props: SettingsViewProps) {
  const [activeSection, setActiveSection] = useState<SectionId>("general");
  const [confirmReset, setConfirmReset] = useState(false);
  const [newEntryKind, setNewEntryKind] = useState<"prompt" | "function">("prompt");
  const [newEntryName, setNewEntryName] = useState("");
  const [newEntryAlias, setNewEntryAlias] = useState("");
  const [newEntryContent, setNewEntryContent] = useState("");
  const [creatingEntry, setCreatingEntry] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAlias, setEditAlias] = useState("");
  const [editKind, setEditKind] = useState<"prompt" | "function">("prompt");
  const [editContent, setEditContent] = useState("");
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [agentForm, setAgentForm] = useState<Partial<BusyAgent>>({});
  const [creatingAgent, setCreatingAgent] = useState(false);

  useEffect(() => {
    if (!props.open) return;
    if (props.initialSection) setActiveSection(props.initialSection);
  }, [props.open, props.initialSection]);

  const sortedLibrary = useMemo(
    () => [...props.promptLibrary].sort((a, b) => b.updatedAt - a.updatedAt),
    [props.promptLibrary],
  );
  if (!props.open) return null;

  return (
    <div className="settings-page-overlay" onClick={props.onClose}>
      <div className="settings-page" onClick={(e) => e.stopPropagation()}>
        <aside className="settings-rail">
          <div className="settings-rail-title">Settings</div>
          <nav className="settings-nav">
            {(Object.keys(SECTION_LABELS) as SectionId[]).map((id) => (
              <button
                key={id}
                type="button"
                className={`settings-nav-item ${activeSection === id ? "is-active" : ""}`}
                onClick={() => setActiveSection(id)}
              >
                {SECTION_LABELS[id]}
              </button>
            ))}
          </nav>
          <div className="settings-rail-footer">
            <div className="settings-rail-version-row">
              <span className="settings-version-label">Version</span>
              <span className="settings-version-value">{props.appVersion}</span>
            </div>
            <div className="settings-rail-version-row">
              <span className="settings-version-label">Build</span>
              <span className="settings-version-value">{props.appBuild}</span>
            </div>
          </div>
        </aside>

        <main className="settings-main">
          <header className="settings-main-header">
            <h2>{SECTION_LABELS[activeSection]}</h2>
            <button type="button" className="settings-close-button" onClick={props.onClose} aria-label="Close settings">
              ✕
            </button>
          </header>

          {activeSection === "general" && (
            <section className="settings-section">
              <p className="settings-helper">Global preferences for the app UI.</p>
              <label>
                Theme
                <select value={props.colorMode} onChange={(e) => props.setColorMode(e.target.value as "light" | "dark")}>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </label>
              <label>
                Density
                <select value={props.uiDensity} onChange={(e) => props.setUiDensity(e.target.value as "comfortable" | "compact")}>
                  <option value="comfortable">Comfortable</option>
                  <option value="compact">Compact</option>
                </select>
              </label>
              <label className="settings-checkbox">
                <input
                  type="checkbox"
                  checked={props.splashEnabled}
                  onChange={(e) => props.setSplashEnabled(e.target.checked)}
                />
                Enable splash screen
              </label>
              <label>
                Splash duration: {props.splashDurationMs} ms
                <input
                  type="range"
                  min={0}
                  max={10000}
                  step={100}
                  value={props.splashDurationMs}
                  onChange={(e) => props.setSplashDurationMs(Number(e.target.value))}
                />
              </label>
            </section>
          )}

          {activeSection === "execution" && (
            <section className="settings-section">
              <p className="settings-helper">Advanced run behavior. Use the composer dropdowns for quick changes.</p>
              <label>
                Approval policy
                <select value={props.approvalPolicy} onChange={(e) => props.setApprovalPolicy(e.target.value)}>
                  <option value="full-auto">full-auto</option>
                  <option value="unless-allow-listed">allow-listed</option>
                  <option value="never">manual</option>
                </select>
              </label>
              {props.agent === "codex" && (
                <label>
                  Sandbox mode
                  <select value={props.sandboxMode} onChange={(e) => props.setSandboxMode(e.target.value)}>
                    <option value="read-only">read-only</option>
                    <option value="workspace-write">workspace-write</option>
                    <option value="danger-full-access">full-access</option>
                  </select>
                </label>
              )}
              <label className="settings-checkbox">
                <input
                  type="checkbox"
                  checked={props.skipGitRepoCheck}
                  onChange={(e) => props.setSkipGitRepoCheck(e.target.checked)}
                />
                Skip git repo check
              </label>
              <label className="settings-checkbox">
                <input
                  type="checkbox"
                  checked={props.includeSessionHistoryInPrompt}
                  onChange={(e) => props.setIncludeSessionHistoryInPrompt(e.target.checked)}
                />
                Include session history in prompt context
              </label>
              <label className="settings-checkbox">
                <input
                  type="checkbox"
                  checked={props.claudeAutoContinue}
                  onChange={(e) => props.setClaudeAutoContinue(e.target.checked)}
                />
                Claude auto-continue previous session
              </label>
            </section>
          )}

          {activeSection === "todo" && (
            <section className="settings-section">
              <p className="settings-helper">Todo auto-play defaults and limits.</p>
              <label className="settings-checkbox">
                <input
                  type="checkbox"
                  checked={props.todoAutoPlayDefault}
                  onChange={(e) => props.setTodoAutoPlayDefault(e.target.checked)}
                />
                Auto-play todos by default
              </label>
              <label>
                Max retries per todo: {props.todoMaxRetries}
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={props.todoMaxRetries}
                  onChange={(e) => props.setTodoMaxRetries(Number(e.target.value))}
                />
              </label>
              <label>
                Todo panel width: {props.rightPanelWidth}px
                <input
                  type="range"
                  min={220}
                  max={500}
                  step={10}
                  value={props.rightPanelWidth}
                  onChange={(e) => props.setRightPanelWidth(Number(e.target.value))}
                />
              </label>
            </section>
          )}

          {activeSection === "agents" && (
            <section className="settings-section">
              <p className="settings-helper">Specialized AI agents for your SDLC team.</p>
              <div className="settings-library-toolbar">
                <button
                  type="button"
                  className="settings-library-new"
                  onClick={() => {
                    setEditingAgentId(null);
                    setCreatingAgent((prev) => !prev);
                    setAgentForm({ base: "claude", model: "claude-sonnet-4-6", executionMode: "full-auto", isPreset: false, icon: "bot" });
                  }}
                >
                  + New Agent
                </button>
              </div>

              <div className={`settings-library-editor-shell ${creatingAgent ? "is-open" : ""}`}>
                {creatingAgent && (
                  <div className="settings-library-editor">
                    <label>
                      Name
                      <input
                        value={agentForm.name ?? ""}
                        onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })}
                        placeholder="Agent name"
                      />
                    </label>
                    <div className="agent-editor-grid">
                      <label>
                        Icon
                        <input
                          value={agentForm.icon ?? "bot"}
                          onChange={(e) => setAgentForm({ ...agentForm, icon: e.target.value })}
                          placeholder="bot"
                        />
                      </label>
                      <label>
                        Role
                        <input
                          value={agentForm.role ?? ""}
                          onChange={(e) => setAgentForm({ ...agentForm, role: e.target.value })}
                          placeholder="What does this agent do?"
                        />
                      </label>
                    </div>
                    <div className="agent-editor-grid agent-editor-grid-3">
                      <label>
                        Base agent
                        <select
                          value={(agentForm.base ?? "codex") as "codex" | "claude"}
                          onChange={(e) => setAgentForm({ ...agentForm, base: e.target.value as "codex" | "claude", model: "" })}
                        >
                          <option value="codex">Codex</option>
                          <option value="claude">Claude</option>
                        </select>
                      </label>
                      <label>
                        Model
                        <select
                          value={agentForm.model ?? ""}
                          onChange={(e) => setAgentForm({ ...agentForm, model: e.target.value })}
                        >
                          {(getModelsForProvider(props.providers, agentForm.base ?? "codex")).map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </label>
                      <label>
                        Execution
                        <select
                          value={(agentForm.executionMode ?? "full-auto") as "safe" | "balanced" | "full-auto"}
                          onChange={(e) => setAgentForm({ ...agentForm, executionMode: e.target.value as "safe" | "balanced" | "full-auto" })}
                        >
                          <option value="safe">Safe</option>
                          <option value="balanced">Balanced</option>
                          <option value="full-auto">Full Auto</option>
                        </select>
                      </label>
                    </div>
                    <label>
                      System prompt
                      <textarea
                        value={agentForm.systemPrompt ?? ""}
                        onChange={(e) => setAgentForm({ ...agentForm, systemPrompt: e.target.value })}
                        rows={6}
                        placeholder="Instructions for this agent..."
                      />
                    </label>
                    <div className="settings-library-actions">
                      <button
                        type="button"
                        onClick={() => {
                          const name = (agentForm.name ?? "").trim();
                          if (!name) return;
                          const policyMap: Record<string, string> = { safe: "never", balanced: "unless-allow-listed", "full-auto": "full-auto" };
                          const sandboxMap: Record<string, string> = { safe: "read-only", balanced: "workspace-write", "full-auto": "danger-full-access" };
                          const execMode = (agentForm.executionMode ?? "full-auto") as "safe" | "balanced" | "full-auto";
                          props.onCreateBusyAgent({
                            name,
                            role: (agentForm.role ?? "").trim(),
                            icon: (agentForm.icon ?? "bot").trim(),
                            base: (agentForm.base ?? "codex") as "codex" | "claude",
                            model: (agentForm.model ?? "").trim(),
                            executionMode: execMode,
                            approvalPolicy: policyMap[execMode],
                            sandboxMode: sandboxMap[execMode],
                            systemPrompt: (agentForm.systemPrompt ?? "").trim(),
                            isPreset: false,
                          });
                          setCreatingAgent(false);
                          setAgentForm({});
                        }}
                      >
                        Save Agent
                      </button>
                      <button type="button" onClick={() => { setCreatingAgent(false); setAgentForm({}); }}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>

              <div className="settings-library-list">
                {props.busyAgents.map((agent) => {
                  const isEditing = editingAgentId === agent.id;
                  const form = agentForm;
                  const base = (form.base ?? agent.base ?? "codex") as "codex" | "claude";
                  const modelOptions = getModelsForProvider(props.providers, base);
                  return (
                    <article key={agent.id} className="settings-library-row">
                      <div className="settings-library-row-head">
                        <span className="agent-row-icon"><AgentIcon name={agent.icon} size={18} /></span>
                        <div className="agent-row-meta">
                          <div className="settings-library-item-name">{agent.name}</div>
                          <div className="agent-row-role">{agent.role}</div>
                        </div>
                        <span className="settings-library-kind">{agent.isPreset ? "preset" : "custom"}</span>
                        <div className="settings-library-actions settings-library-actions-inline">
                          <button
                            type="button"
                            onClick={() => {
                              setCreatingAgent(false);
                              setEditingAgentId(isEditing ? null : agent.id);
                              setAgentForm({});
                            }}
                          >
                            {isEditing ? "Close" : "Edit"}
                          </button>
                          {!agent.isPreset && (
                            <button type="button" onClick={() => props.onDeleteBusyAgent(agent.id)}>Delete</button>
                          )}
                          {agent.isPreset && (
                            <button type="button" onClick={() => props.onResetBusyAgent(agent.id)}>Reset</button>
                          )}
                        </div>
                      </div>
                      <div className={`settings-library-editor-shell ${isEditing ? "is-open" : ""}`}>
                        {isEditing && (
                          <div className="settings-library-editor">
                            <label>
                              Name
                              <input
                                value={form.name ?? agent.name}
                                onChange={(e) => setAgentForm({ ...form, name: e.target.value })}
                              />
                            </label>
                            <div className="agent-editor-grid">
                              <label>
                                Icon
                                <input
                                  value={form.icon ?? agent.icon}
                                  onChange={(e) => setAgentForm({ ...form, icon: e.target.value })}
                                />
                              </label>
                              <label>
                                Role
                                <input
                                  value={form.role ?? agent.role}
                                  onChange={(e) => setAgentForm({ ...form, role: e.target.value })}
                                />
                              </label>
                            </div>
                            <div className="agent-editor-grid agent-editor-grid-3">
                              <label>
                                Base agent
                                <select
                                  value={base}
                                  onChange={(e) => setAgentForm({ ...form, base: e.target.value as "codex" | "claude", model: "" })}
                                >
                                  <option value="codex">Codex</option>
                                  <option value="claude">Claude</option>
                                </select>
                              </label>
                              <label>
                                Model
                                <select
                                  value={form.model ?? agent.model ?? ""}
                                  onChange={(e) => setAgentForm({ ...form, model: e.target.value })}
                                >
                                  {modelOptions.map((m) => <option key={m} value={m}>{m}</option>)}
                                </select>
                              </label>
                              <label>
                                Execution
                                <select
                                  value={(form.executionMode ?? agent.executionMode ?? "full-auto") as "safe" | "balanced" | "full-auto"}
                                  onChange={(e) => setAgentForm({ ...form, executionMode: e.target.value as "safe" | "balanced" | "full-auto" })}
                                >
                                  <option value="safe">Safe</option>
                                  <option value="balanced">Balanced</option>
                                  <option value="full-auto">Full Auto</option>
                                </select>
                              </label>
                            </div>
                            <label>
                              System prompt
                              <textarea
                                value={form.systemPrompt ?? agent.systemPrompt ?? ""}
                                onChange={(e) => setAgentForm({ ...form, systemPrompt: e.target.value })}
                                rows={6}
                              />
                            </label>
                            <div className="settings-library-actions">
                              <button
                                type="button"
                                onClick={() => {
                                  const name = (form.name ?? agent.name ?? "").trim();
                                  if (!name) return;
                                  const policyMap: Record<string, string> = { safe: "never", balanced: "unless-allow-listed", "full-auto": "full-auto" };
                                  const sandboxMap: Record<string, string> = { safe: "read-only", balanced: "workspace-write", "full-auto": "danger-full-access" };
                                  const execMode = (form.executionMode ?? agent.executionMode ?? "full-auto") as "safe" | "balanced" | "full-auto";
                                  props.onUpdateBusyAgent({
                                    ...agent,
                                    name,
                                    role: (form.role ?? agent.role ?? "").trim(),
                                    icon: (form.icon ?? agent.icon ?? "bot").trim(),
                                    base: (form.base ?? agent.base ?? "codex") as "codex" | "claude",
                                    model: (form.model ?? agent.model ?? "").trim(),
                                    executionMode: execMode,
                                    approvalPolicy: policyMap[execMode],
                                    sandboxMode: sandboxMap[execMode],
                                    systemPrompt: (form.systemPrompt ?? agent.systemPrompt ?? "").trim(),
                                    updatedAt: Date.now(),
                                  });
                                  setEditingAgentId(null);
                                  setAgentForm({});
                                }}
                              >
                                Save
                              </button>
                              <button type="button" onClick={() => { setEditingAgentId(null); setAgentForm({}); }}>Cancel</button>
                              {!agent.isPreset && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCreatingAgent(true);
                                    setEditingAgentId(null);
                                    setAgentForm({
                                      ...form,
                                      name: `${form.name ?? agent.name} (copy)`,
                                      isPreset: false,
                                    });
                                  }}
                                >
                                  Clone
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

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

          {activeSection === "terminal" && (
            <section className="settings-section">
              <p className="settings-helper">Terminal preferences (applies when terminal panel is enabled).</p>
              <label>
                Terminal font size: {props.terminalFontSize}
                <input
                  type="range"
                  min={10}
                  max={24}
                  step={1}
                  value={props.terminalFontSize}
                  onChange={(e) => props.setTerminalFontSize(Number(e.target.value))}
                />
              </label>
              <label>
                Terminal line height: {props.terminalLineHeight.toFixed(1)}
                <input
                  type="range"
                  min={1}
                  max={2}
                  step={0.1}
                  value={props.terminalLineHeight}
                  onChange={(e) => props.setTerminalLineHeight(Number(e.target.value))}
                />
              </label>
            </section>
          )}

          {activeSection === "library" && (
            <section className="settings-section">
              <p className="settings-helper">Manage reusable prompts/functions and reference them in composer via <code>#alias</code>. Tag agents in composer via <code>@alias</code>.</p>
              <div className="settings-library-toolbar">
                <button
                  type="button"
                  className="settings-library-new"
                  onClick={() => {
                    setEditingId(null);
                    setCreatingEntry((prev) => !prev);
                  }}
                >
                  + New Entry
                </button>
              </div>
              <div className={`settings-library-editor-shell ${creatingEntry ? "is-open" : ""}`}>
                {creatingEntry && (
                  <div className="settings-library-editor">
                    <label>
                      Type
                      <select value={newEntryKind} onChange={(e) => setNewEntryKind(e.target.value as "prompt" | "function")}>
                        <option value="prompt">Prompt</option>
                        <option value="function">Function</option>
                      </select>
                    </label>
                    <label>
                      Name
                      <input
                        value={newEntryName}
                        onChange={(e) => setNewEntryName(e.target.value)}
                        placeholder={newEntryKind === "function" ? "shipit" : "Release notes draft"}
                      />
                    </label>
                    <label>
                      Alias
                      <input
                        value={newEntryAlias}
                        onChange={(e) => setNewEntryAlias(e.target.value)}
                        placeholder={newEntryKind === "function" ? "shipit" : "release-notes"}
                      />
                    </label>
                    <label>
                      Content
                      <textarea
                        value={newEntryContent}
                        onChange={(e) => setNewEntryContent(e.target.value)}
                        rows={4}
                        placeholder={newEntryKind === "function" ? "Add the changes, commit with a message..." : "Write release notes for this branch..."}
                      />
                    </label>
                    <div className="settings-library-actions">
                      <button
                        type="button"
                        onClick={() => {
                          const name = newEntryName.trim();
                          const content = newEntryContent.trim();
                          const alias = newEntryAlias.trim();
                          if (!name || !content || !alias) return;
                          props.onCreatePromptLibraryEntry({
                            name,
                            alias,
                            kind: newEntryKind,
                            content,
                          });
                          setNewEntryName("");
                          setNewEntryAlias("");
                          setNewEntryContent("");
                          setNewEntryKind("prompt");
                          setCreatingEntry(false);
                        }}
                      >
                        Save Entry
                      </button>
                      <button type="button" onClick={() => setCreatingEntry(false)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>

              <div className="settings-library-list">
                {sortedLibrary.length === 0 && (
                  <div className="settings-helper">No saved prompts or functions yet.</div>
                )}
                {sortedLibrary.map((entry) => {
                  const isEditing = editingId === entry.id;
                  return (
                    <article key={entry.id} className="settings-library-row">
                      <div className="settings-library-row-head">
                        <div className="settings-library-item-name">{entry.name} <code>#{entry.alias}</code></div>
                        <span className="settings-library-kind">{entry.kind}</span>
                        <div className="settings-library-actions settings-library-actions-inline">
                          <button
                            type="button"
                            onClick={() => {
                              setCreatingEntry(false);
                              setEditingId(isEditing ? null : entry.id);
                              setEditName(entry.name);
                              setEditAlias(entry.alias);
                              setEditKind(entry.kind);
                              setEditContent(entry.content);
                            }}
                          >
                            {isEditing ? "Close" : "Edit"}
                          </button>
                          <button type="button" onClick={() => props.onDeletePromptLibraryEntry(entry.id)}>Delete</button>
                        </div>
                      </div>
                      <div className={`settings-library-editor-shell ${isEditing ? "is-open" : ""}`}>
                        {isEditing && (
                          <div className="settings-library-editor">
                            <label>
                              Type
                              <select value={editKind} onChange={(e) => setEditKind(e.target.value as "prompt" | "function")}>
                                <option value="prompt">Prompt</option>
                                <option value="function">Function</option>
                              </select>
                            </label>
                            <label>
                              Name
                              <input value={editName} onChange={(e) => setEditName(e.target.value)} />
                            </label>
                            <label>
                              Alias
                              <input value={editAlias} onChange={(e) => setEditAlias(e.target.value)} />
                            </label>
                            <label>
                              Content
                              <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={4} />
                            </label>
                            <div className="settings-library-actions">
                              <button
                                type="button"
                                onClick={() => {
                                  const name = editName.trim();
                                  const content = editContent.trim();
                                  const alias = editAlias.trim();
                                  if (!name || !content || !alias) return;
                                  props.onUpdatePromptLibraryEntry({
                                    ...entry,
                                    name,
                                    alias,
                                    kind: editKind,
                                    content,
                                    updatedAt: Date.now(),
                                  });
                                  setEditingId(null);
                                }}
                              >
                                Save
                              </button>
                              <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
                            </div>
                          </div>
                        )}
                      </div>
                      {!isEditing && (
                        <pre className="settings-library-content-preview">{entry.content}</pre>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {activeSection === "advanced" && (
            <section className="settings-section">
              <p className="settings-helper">Diagnostics and advanced behavior toggles.</p>
              <label className="settings-checkbox">
                <input
                  type="checkbox"
                  checked={props.debugMode}
                  onChange={(e) => props.setDebugMode(e.target.checked)}
                />
                Debug mode
              </label>

              <div className="settings-danger-zone">
                <h4>Danger Zone</h4>
                <p className="settings-helper">Permanently remove all projects, sessions, run history, and todos.</p>
                <button
                  type="button"
                  className="settings-reset-btn"
                  onClick={() => setConfirmReset(true)}
                >
                  Reset Environment
                </button>
              </div>

              {confirmReset && (
                <div className="confirm-overlay" onClick={() => setConfirmReset(false)}>
                  <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="confirm-title">Reset Environment?</div>
                    <p className="confirm-body">
                      This will permanently delete all projects, sessions, run history, and todos. This action cannot be undone.
                    </p>
                    <div className="confirm-actions">
                      <button type="button" className="confirm-cancel" onClick={() => setConfirmReset(false)}>Cancel</button>
                      <button
                        type="button"
                        className="confirm-danger"
                        onClick={() => {
                          setConfirmReset(false);
                          props.onResetEnvironment();
                          props.onClose();
                        }}
                      >
                        Reset Everything
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
