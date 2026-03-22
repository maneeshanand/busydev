import type { Workspace } from "../../stores";
import { StatusIndicator } from "./StatusIndicator";
import "./WorkspaceItem.css";

interface WorkspaceItemProps {
  workspace: Workspace;
  isSelected: boolean;
  onSelect: (workspaceId: string, projectId: string) => void;
}

export function WorkspaceItem({ workspace, isSelected, onSelect }: WorkspaceItemProps) {
  const primaryText = workspace.ticket ?? workspace.branch;

  return (
    <button
      className={`workspace-item ${isSelected ? "workspace-item--selected" : ""}`}
      onClick={() => onSelect(workspace.id, workspace.projectId)}
    >
      <StatusIndicator status={workspace.status} />
      <div className="workspace-item__text">
        <span className="workspace-item__name">{primaryText}</span>
        <span className="workspace-item__adapter">{workspace.agentAdapter}</span>
      </div>
    </button>
  );
}
