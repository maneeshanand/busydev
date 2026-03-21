import "./DiffHeader.css";

interface DiffHeaderProps {
  hasWorkspace: boolean;
  fileCount: number;
  onRefresh: () => void;
}

export function DiffHeader({ hasWorkspace, fileCount, onRefresh }: DiffHeaderProps) {
  return (
    <div className="diff-header">
      <span className="diff-header__title">
        {hasWorkspace ? "Changes" : "No workspace"}
      </span>
      {hasWorkspace && <span className="diff-header__badge">{fileCount}</span>}
      {hasWorkspace && (
        <button className="diff-header__refresh" onClick={onRefresh} title="Refresh diff">
          {"\u21BB"}
        </button>
      )}
    </div>
  );
}
