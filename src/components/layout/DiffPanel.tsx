import { useCallback, useState } from "react";
import { usePassthroughStore } from "../../stores";
import { DiffHeader, DiffContent } from "../diff";
import "./DiffPanel.css";

export function DiffPanel() {
  const { workspacePath } = usePassthroughStore();
  const hasTarget = workspacePath.trim().length > 0;

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
      <DiffHeader hasTarget={hasTarget} fileCount={fileCount} onRefresh={handleRefresh} />
      <DiffContent
        key={refreshKey}
        hasTarget={hasTarget}
        targetPath={hasTarget ? workspacePath : null}
        onFilesChanged={handleFilesChanged}
      />
    </div>
  );
}
