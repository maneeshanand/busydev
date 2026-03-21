import "./StatusIndicator.css";

const STATUS_COLORS: Record<string, string> = {
  Idle: "var(--status-idle, #666)",
  Running: "var(--status-running, #3b82f6)",
  NeedsInput: "var(--status-needs-input, #f59e0b)",
  Error: "var(--status-error, #ef4444)",
};

interface StatusIndicatorProps {
  status: string;
}

export function StatusIndicator({ status }: StatusIndicatorProps) {
  const color = STATUS_COLORS[status] ?? "var(--status-idle, #666)";
  const isRunning = status === "Running";

  return (
    <span
      className={`status-indicator ${isRunning ? "status-indicator--pulse" : ""}`}
      style={{ backgroundColor: color }}
      title={status}
    />
  );
}
