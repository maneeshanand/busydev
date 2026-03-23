import { useMemo, useState } from "react";
import type { Project, Session } from "../types";
import "./SettingsView.css";

type SectionId =
  | "general"
  | "session"
  | "execution"
  | "todo"
  | "advanced";

interface SettingsViewProps {
  open: boolean;
  onClose: () => void;
  colorMode: "light" | "dark";
  setColorMode: (mode: "light" | "dark") => void;
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
  rightPanelWidth: number;
  setRightPanelWidth: (width: number) => void;
}

const SECTION_LABELS: Record<SectionId, string> = {
  general: "General",
  session: "Session",
  execution: "Execution",
  todo: "Todo Panel",
  advanced: "Advanced",
};

export function SettingsView(props: SettingsViewProps) {
  const [activeSection, setActiveSection] = useState<SectionId>("general");

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
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

