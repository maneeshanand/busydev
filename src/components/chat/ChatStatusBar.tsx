import type { Workspace } from "../../stores";
import { StatusIndicator } from "../sidebar/StatusIndicator";
import "./ChatStatusBar.css";

interface ChatStatusBarProps {
  workspace: Workspace | null;
}

export function ChatStatusBar({ workspace }: ChatStatusBarProps) {
  if (!workspace) {
    return (
      <div className="chat-status-bar">
        <span className="chat-status-bar__empty">No workspace selected</span>
      </div>
    );
  }

  const primaryText = workspace.ticket ?? workspace.branch;

  return (
    <div className="chat-status-bar">
      <StatusIndicator status={workspace.status} />
      <span className="chat-status-bar__name">{primaryText}</span>
      <span className="chat-status-bar__adapter">{workspace.agentAdapter}</span>
    </div>
  );
}
