import { useWorkspaceStore } from "../../stores";
import { TerminalTabBar, TerminalContent } from "../terminal";
import "./TerminalPanel.css";

export function TerminalPanel() {
  const { selectedWorkspaceId } = useWorkspaceStore();
  const hasWorkspace = selectedWorkspaceId !== null;

  return (
    <div className="terminal-panel">
      <TerminalTabBar />
      <TerminalContent hasWorkspace={hasWorkspace} />
    </div>
  );
}
