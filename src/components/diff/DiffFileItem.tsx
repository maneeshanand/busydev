import { useState } from "react";
import type { DiffFile } from "../../lib";
import { UnifiedDiff } from "./UnifiedDiff";
import "./DiffFileItem.css";

interface DiffFileItemProps {
  file: DiffFile;
  onAccept: (path: string) => void;
  onRevert: (path: string) => void;
}

export function DiffFileItem({ file, onAccept, onRevert }: DiffFileItemProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="diff-file-item">
      <div className="diff-file-item__header">
        <button
          className="diff-file-item__toggle"
          onClick={() => setExpanded((prev) => !prev)}
        >
          <span className={`diff-file-item__chevron ${expanded ? "diff-file-item__chevron--open" : ""}`}>
            {"\u25B6"}
          </span>
          <span className="diff-file-item__path">{file.path}</span>
          <span className="diff-file-item__stats">
            {file.additions > 0 && (
              <span className="diff-file-item__additions">+{file.additions}</span>
            )}
            {file.deletions > 0 && (
              <span className="diff-file-item__deletions">-{file.deletions}</span>
            )}
          </span>
        </button>
        <div className="diff-file-item__actions">
          <button
            className="diff-file-item__accept"
            onClick={() => onAccept(file.path)}
            title="Accept changes (git add)"
          >
            Accept
          </button>
          <button
            className="diff-file-item__revert"
            onClick={() => onRevert(file.path)}
            title="Revert changes"
          >
            Revert
          </button>
        </div>
      </div>
      {expanded && <UnifiedDiff hunks={file.hunks} />}
    </div>
  );
}
