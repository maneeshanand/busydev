import { useEffect, useMemo, useState } from "react";
import type { Project, Session } from "../types";
import "./SettingsView.css";

export type SectionId =
  | "general"
  | "session"
  | "execution"
  | "todo"
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
  project: Project | null;
  session: Session | null;
  agent: string;
  setAgent: (agent: string) => void;
  model: string;
  setModel: (model: string) => void;
  approvalPolicy: string;
  setApprovalPolicy: (policy: string) => void;
  sandboxMode: string;
  setSandboxMode: (mode: string) => void;
  todoMode: boolean;
  setTodoMode: (enabled: boolean) => void;
  todoAutoPlayDefault: boolean;
  setTodoAutoPlayDefault: (enabled: boolean) => void;
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
  onResetEnvironment: () => void;
}

const SECTION_LABELS: Record<SectionId, string> = {
  general: "General",
  session: "Session",
  execution: "Execution",
  todo: "Todo Panel",
  terminal: "Terminal",
  advanced: "Advanced",
};

export function SettingsView(props: SettingsViewProps) {
  const [activeSection, setActiveSection] = useState<SectionId>("general");
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (!props.open) return;
    if (props.initialSection) setActiveSection(props.initialSection);
  }, [props.open, props.initialSection]);

  const modelOptions = useMemo(() => {
    if (props.agent === "claude") {
      return [
        { value: "", label: "claude-sonnet-4-6" },
        { value: "claude-opus-4-6", label: "claude-opus-4-6" },
        { value: "claude-haiku-4-5", label: "claude-haiku-4-5" },
      ];
    }
    return [
      { value: "", label: "codex-mini" },
      { value: "o3", label: "o3" },
      { value: "o4-mini", label: "o4-mini" },
    ];
  }, [props.agent]);

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
              <label>
                Active project
                <input value={props.project?.name ?? "No project selected"} readOnly />
              </label>
              <label>
                Project path
                <input value={props.project?.path ?? ""} readOnly />
              </label>
            </section>
          )}

          {activeSection === "session" && (
            <section className="settings-section">
              <p className="settings-helper">These values are scoped to the active session.</p>
              <label>
                Active session
                <input value={props.session?.name ?? "No session selected"} readOnly />
              </label>
              <label>
                Agent
                <select
                  value={props.agent}
                  onChange={(e) => {
                    props.setAgent(e.target.value);
                    props.setModel("");
                  }}
                >
                  <option value="codex">Codex</option>
                  <option value="claude">Claude Code</option>
                </select>
              </label>
              <label>
                Model
                <select value={props.model} onChange={(e) => props.setModel(e.target.value)}>
                  {modelOptions.map((opt) => (
                    <option key={opt.label} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
            </section>
          )}

          {activeSection === "execution" && (
            <section className="settings-section">
              <p className="settings-helper">Run behavior and safety controls.</p>
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
              <p className="settings-helper">Control Todo panel visibility and layout.</p>
              <label className="settings-checkbox">
                <input
                  type="checkbox"
                  checked={props.todoMode}
                  onChange={(e) => props.setTodoMode(e.target.checked)}
                />
                Enable todo mode
              </label>
              <label className="settings-checkbox">
                <input
                  type="checkbox"
                  checked={props.todoAutoPlayDefault}
                  onChange={(e) => props.setTodoAutoPlayDefault(e.target.checked)}
                />
                Auto-play todos by default
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
