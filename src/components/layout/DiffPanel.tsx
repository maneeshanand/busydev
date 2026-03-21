import { useCallback, useState } from "react";
import { useWorkspaceStore } from "../../stores";
import { DiffHeader, DiffContent } from "../diff";
import "./DiffPanel.css";

export function DiffPanel() {
  const { workspaces, selectedWorkspaceId } = useWorkspaceStore();
  const workspace = workspaces.find((w) => w.id === selectedWorkspaceId) ?? null;
  const hasWorkspace = workspace !== null;

  const [fileCount, setFileCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleFilesChanged = useCallback((count: number) => {
    setFileCount(count);
  }, []);

  return (
    <div className="diff-panel">
      <DiffHeader hasWorkspace={hasWorkspace} fileCount={fileCount} onRefresh={handleRefresh} />
      <DiffContent
        key={refreshKey}
        hasWorkspace={hasWorkspace}
        worktreePath={workspace?.worktreePath ?? null}
        onFilesChanged={handleFilesChanged}
      />
    </div>
  );
}
