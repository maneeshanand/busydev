import { usePassthroughStore } from "../../stores";
import "./ChatStatusBar.css";

const ADAPTER_OPTIONS = ["Codex", "Claude Code"] as const;

export function ChatStatusBar() {
  const { adapter, workspacePath, setAdapter, setWorkspacePath } = usePassthroughStore();

  return (
    <div className="chat-status-bar">
      <label className="chat-status-bar__adapter-label" htmlFor="chat-status-adapter">
        Adapter
      </label>
      <select
        id="chat-status-adapter"
        className="chat-status-bar__adapter"
        value={adapter}
        onChange={(event) => setAdapter(event.target.value)}
      >
        {ADAPTER_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      <label className="chat-status-bar__path-label" htmlFor="chat-status-path">
        Path
      </label>
      <input
        id="chat-status-path"
        className="chat-status-bar__path"
        value={workspacePath}
        onChange={(event) => setWorkspacePath(event.target.value)}
        placeholder="/absolute/path/to/repo"
      />
    </div>
  );
}
