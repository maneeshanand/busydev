import type { TerminalSessionInfo } from "./useTerminalSession";
import "./TerminalTabBar.css";

interface TerminalTabBarProps {
  sessions: TerminalSessionInfo[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onClose: (id: string) => void;
  disabled: boolean;
}

export function TerminalTabBar({
  sessions,
  activeSessionId,
  onSelect,
  onCreate,
  onClose,
  disabled,
}: TerminalTabBarProps) {
  return (
    <div className="terminal-tab-bar">
      {sessions.map((session, i) => (
        <div
          key={session.id}
          className={`terminal-tab-bar__tab ${
            activeSessionId === session.id ? "terminal-tab-bar__tab--active" : ""
          }`}
        >
          <button className="terminal-tab-bar__tab-label" onClick={() => onSelect(session.id)}>
            Terminal {i + 1}
          </button>
          <button
            className="terminal-tab-bar__tab-close"
            onClick={(e) => {
              e.stopPropagation();
              onClose(session.id);
            }}
            title="Close terminal"
          >
            {"\u2715"}
          </button>
        </div>
      ))}
      <button
        className="terminal-tab-bar__add"
        onClick={onCreate}
        disabled={disabled}
        title="New terminal"
      >
        +
      </button>
    </div>
  );
}
