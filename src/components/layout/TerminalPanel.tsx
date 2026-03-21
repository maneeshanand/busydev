import { useWorkspaceStore } from "../../stores";
import { TerminalTabBar, TerminalContent, useTerminalSession } from "../terminal";
import "./TerminalPanel.css";

export function TerminalPanel() {
  const { workspaces, selectedWorkspaceId } = useWorkspaceStore();
  const workspace = workspaces.find((w) => w.id === selectedWorkspaceId) ?? null;
  const hasWorkspace = workspace !== null;

  const { sessions, activeSessionId, createSession, closeSession, selectSession, resizeSession } =
    useTerminalSession(workspace?.worktreePath ?? null);

  return (
    <div className="terminal-panel">
      <TerminalTabBar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelect={selectSession}
        onCreate={createSession}
        onClose={closeSession}
        disabled={!hasWorkspace}
      />
      <TerminalContent
        activeSessionId={activeSessionId}
        hasWorkspace={hasWorkspace}
        onResize={resizeSession}
      />
    </div>
  );
}
