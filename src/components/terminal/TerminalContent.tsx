import "./TerminalContent.css";

interface TerminalContentProps {
  hasWorkspace: boolean;
}

export function TerminalContent({ hasWorkspace }: TerminalContentProps) {
  return (
    <div className="terminal-content">
      <p className="terminal-content__empty">
        {hasWorkspace
          ? "No terminal session"
          : "Select a workspace"}
      </p>
    </div>
  );
}
