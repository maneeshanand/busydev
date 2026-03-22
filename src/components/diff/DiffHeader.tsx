import "./DiffHeader.css";

interface DiffHeaderProps {
  hasTarget: boolean;
  fileCount: number;
  onRefresh: () => void;
}

export function DiffHeader({ hasTarget, fileCount, onRefresh }: DiffHeaderProps) {
  return (
    <div className="diff-header">
      <span className="diff-header__title">{hasTarget ? "Changes" : "No path"}</span>
      {hasTarget && <span className="diff-header__badge">{fileCount}</span>}
      {hasTarget && (
        <button className="diff-header__refresh" onClick={onRefresh} title="Refresh diff">
          {"\u21BB"}
        </button>
      )}
    </div>
  );
}
