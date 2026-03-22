import type { DiffHunk } from "../../lib";
import "./UnifiedDiff.css";

interface UnifiedDiffProps {
  hunks: DiffHunk[];
}

export function UnifiedDiff({ hunks }: UnifiedDiffProps) {
  return (
    <div className="unified-diff">
      {hunks.map((hunk, i) => (
        <div key={i} className="unified-diff__hunk">
          <div className="unified-diff__hunk-header">{hunk.header}</div>
          {hunk.lines.map((line, j) => (
            <div key={j} className={`unified-diff__line unified-diff__line--${line.type}`}>
              <span className="unified-diff__gutter unified-diff__gutter--old">
                {line.oldLineNo ?? ""}
              </span>
              <span className="unified-diff__gutter unified-diff__gutter--new">
                {line.newLineNo ?? ""}
              </span>
              <span className="unified-diff__prefix">
                {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
              </span>
              <span className="unified-diff__content">{line.content}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
