import "./DiffHeader.css";

interface DiffHeaderProps {
  hasWorkspace: boolean;
}

export function DiffHeader({ hasWorkspace }: DiffHeaderProps) {
  return (
    <div className="diff-header">
      <span className="diff-header__title">
        {hasWorkspace ? "Changes" : "No workspace"}
      </span>
      {hasWorkspace && <span className="diff-header__badge">0</span>}
    </div>
  );
}
