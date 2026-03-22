import { usePassthroughStore } from "../../stores";
import { TerminalTabBar, TerminalContent, useTerminalSession } from "../terminal";
import "./TerminalPanel.css";

export function TerminalPanel() {
  const { workspacePath } = usePassthroughStore();
  const hasTarget = workspacePath.trim().length > 0;

  const { sessions, activeSessionId, createSession, closeSession, selectSession, resizeSession } =
    useTerminalSession(hasTarget ? workspacePath : null);

  return (
    <div className="terminal-panel">
      <TerminalTabBar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelect={selectSession}
        onCreate={createSession}
        onClose={closeSession}
        disabled={!hasTarget}
      />
      <TerminalContent
        activeSessionId={activeSessionId}
        hasWorkspace={hasTarget}
        onResize={resizeSession}
      />
    </div>
  );
}
