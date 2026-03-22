import { usePassthroughStore, useSettingsStore } from "../../stores";
import "./SettingsPanel.css";

const ADAPTERS = ["Codex", "Claude Code"];
const MODES = ["auto", "plan", "code"];

export function SettingsPanel() {
  const { adapter, workspacePath, setAdapter, setWorkspacePath } = usePassthroughStore();
  const {
    defaultShell,
    defaultModel,
    defaultMode,
    setDefaultShell,
    setDefaultModel,
    setDefaultMode,
  } = useSettingsStore();

  return (
    <div className="settings-panel">
      <section className="settings-panel__section">
        <h3 className="settings-panel__heading">General</h3>

        <label className="settings-panel__label">
          <span className="settings-panel__label-text">Agent</span>
          <select
            className="settings-panel__select"
            value={adapter}
            onChange={(e) => setAdapter(e.target.value)}
          >
            {ADAPTERS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>

        <label className="settings-panel__label">
          <span className="settings-panel__label-text">Local Path</span>
          <input
            className="settings-panel__input"
            type="text"
            value={workspacePath}
            onChange={(e) => setWorkspacePath(e.target.value)}
            placeholder="/absolute/path/to/repo"
          />
        </label>

        <label className="settings-panel__label">
          <span className="settings-panel__label-text">Default Shell</span>
          <input
            className="settings-panel__input"
            type="text"
            value={defaultShell}
            onChange={(e) => setDefaultShell(e.target.value)}
            placeholder="System default"
          />
        </label>
      </section>

      <section className="settings-panel__section">
        <h3 className="settings-panel__heading">Agent Config</h3>

        <label className="settings-panel__label">
          <span className="settings-panel__label-text">Model</span>
          <input
            className="settings-panel__input"
            type="text"
            value={defaultModel}
            onChange={(e) => setDefaultModel(e.target.value)}
            placeholder="Default model"
          />
        </label>

        <label className="settings-panel__label">
          <span className="settings-panel__label-text">Mode</span>
          <select
            className="settings-panel__select"
            value={defaultMode}
            onChange={(e) => setDefaultMode(e.target.value)}
          >
            {MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </section>
    </div>
  );
}
