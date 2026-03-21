import "./DiffContent.css";

interface DiffContentProps {
  hasWorkspace: boolean;
}

export function DiffContent({ hasWorkspace }: DiffContentProps) {
  return (
    <div className="diff-content">
      <p className="diff-content__empty">
        {hasWorkspace
          ? "No changes to review"
          : "Select a workspace to view changes"}
      </p>
    </div>
  );
}
