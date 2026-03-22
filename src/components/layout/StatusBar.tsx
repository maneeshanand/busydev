import { usePassthroughStore, useAgentStore } from "../../stores";
import "./StatusBar.css";

export function StatusBar() {
  const { adapter, workspacePath } = usePassthroughStore();
  const { isRunning, usage } = useAgentStore();
  const hasTarget = workspacePath.trim().length > 0;

  return (
    <div className="status-bar">
      <div className="status-bar__left">
        {hasTarget ? (
          <>
            <span className="status-bar__workspace">{workspacePath}</span>
            <span className="status-bar__separator">{"\u2022"}</span>
            <span className="status-bar__adapter">{adapter}</span>
          </>
        ) : (
          <span className="status-bar__muted">No path configured</span>
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
