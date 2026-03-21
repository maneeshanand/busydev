import { useWorkspaceStore } from "../../stores";
import { DiffHeader, DiffContent } from "../diff";
import "./DiffPanel.css";

export function DiffPanel() {
  const { selectedWorkspaceId } = useWorkspaceStore();
  const hasWorkspace = selectedWorkspaceId !== null;

  return (
    <div className="diff-panel">
      <DiffHeader hasWorkspace={hasWorkspace} />
      <DiffContent hasWorkspace={hasWorkspace} />
    </div>
  );
}
