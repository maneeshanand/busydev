import { useEffect, useMemo, useState } from "react";
import type { SavedPromptEntry } from "../types";
import "./SettingsView.css";

export type SectionId =
  | "general"
  | "execution"
  | "todo"
  | "library"
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
  onResetEnvironment: () => void;
}

const SECTION_LABELS: Record<SectionId, string> = {
  general: "General",
  execution: "Execution",
  todo: "Todo",
  library: "Prompt Library",
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAlias, setEditAlias] = useState("");
  const [editKind, setEditKind] = useState<"prompt" | "function">("prompt");
  const [editContent, setEditContent] = useState("");

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
              <div className="settings-version-row">
                <span className="settings-version-label">Version</span>
                <span className="settings-version-value">{props.appVersion}</span>
                <span className="settings-version-label">Build</span>
                <span className="settings-version-value">{props.appBuild}</span>
              </div>
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
              <p className="settings-helper">Save reusable prompts and functions for this app session history.</p>
              <div className="settings-library-guide">
                <h4>How to use saved prompts/functions</h4>
                <ul>
                  <li>
                    <strong>Recommended:</strong> call saved entries using <code>@alias</code> (example: <code>@shipit</code>)
                    directly in the composer prompt.
                  </li>
                  <li>
                    Aliases should be short and stable; use name prefixes as optional tags for grouping
                    (example: <code>[release] Ship It</code>, alias <code>shipit</code>).
                  </li>
                  <li>
                    Type <code>@</code> in composer to open fuzzy typeahead and choose a saved alias quickly.
                  </li>
                </ul>
              </div>
              <div className="settings-library-create">
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
                  }}
                >
                  Save Entry
                </button>
              </div>

              <div className="settings-library-list">
                {sortedLibrary.length === 0 && (
                  <div className="settings-helper">No saved prompts or functions yet.</div>
                )}
                {sortedLibrary.map((entry) => {
                  const isEditing = editingId === entry.id;
                  return (
                    <article key={entry.id} className="settings-library-item">
                      {isEditing ? (
                        <>
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
                        </>
                      ) : (
                        <>
                          <div className="settings-library-item-header">
                            <div className="settings-library-item-name">{entry.name} <code>@{entry.alias}</code></div>
                            <span className="settings-library-kind">{entry.kind}</span>
                          </div>
                          <pre className="settings-library-content-preview">{entry.content}</pre>
                          <div className="settings-library-actions">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(entry.id);
                                setEditName(entry.name);
                                setEditAlias(entry.alias);
                                setEditKind(entry.kind);
                                setEditContent(entry.content);
                              }}
                            >
                              Edit
                            </button>
                            <button type="button" onClick={() => props.onDeletePromptLibraryEntry(entry.id)}>Delete</button>
                          </div>
                        </>
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
