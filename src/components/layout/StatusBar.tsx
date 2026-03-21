import { useWorkspaceStore, useAgentStore } from "../../stores";
import { StatusIndicator } from "../sidebar/StatusIndicator";
import "./StatusBar.css";

export function StatusBar() {
  const { workspaces, selectedWorkspaceId } = useWorkspaceStore();
  const workspace = workspaces.find((w) => w.id === selectedWorkspaceId) ?? null;
  const { isRunning, usage } = useAgentStore();

  return (
    <div className="status-bar">
      <div className="status-bar__left">
        {workspace ? (
          <>
            <StatusIndicator status={workspace.status} />
            <span className="status-bar__workspace">{workspace.ticket ?? workspace.branch}</span>
            <span className="status-bar__separator">{"\u2022"}</span>
            <span className="status-bar__adapter">{workspace.agentAdapter}</span>
          </>
        ) : (
          <span className="status-bar__muted">No workspace selected</span>
        )}
      </div>
      <div className="status-bar__right">
        {isRunning && <span className="status-bar__running">Running</span>}
        {usage && (
          <>
            <span className="status-bar__tokens">{usage.totalTokens.toLocaleString()} tokens</span>
            <span className="status-bar__separator">{"\u2022"}</span>
            <span className="status-bar__cost">${usage.estimatedCostUsd.toFixed(4)}</span>
          </>
        )}
      </div>
    </div>
  );
}
