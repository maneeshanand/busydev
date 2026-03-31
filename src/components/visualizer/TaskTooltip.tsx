import { Html } from "@react-three/drei";
import type { TodoItem, PersistedRun } from "../../types";

interface TaskTooltipProps {
  position: [number, number, number];
  todo: TodoItem;
  run?: PersistedRun;
  index: number;
}

const STATE_BORDERS: Record<string, string> = {
  completed: "#818cf8",
  running: "#34d399",
  pending: "#475569",
};

export function TaskTooltip({ position, todo, run, index }: TaskTooltipProps) {
  const state = todo.done ? "completed" : run && !todo.done ? "running" : "pending";
  const toolCalls = run?.streamRows.filter((r) => r.category === "command").length ?? 0;
  const duration = run?.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : null;

  return (
    <Html position={position} center style={{ pointerEvents: "none" }}>
      <div
        style={{
          background: "rgba(15, 15, 20, 0.95)",
          border: `1px solid ${STATE_BORDERS[state]}`,
          borderLeft: `3px solid ${STATE_BORDERS[state]}`,
          padding: "8px 12px",
          borderRadius: "4px",
          whiteSpace: "nowrap",
          minWidth: "160px",
          transform: "translateY(-60px)",
          fontFamily: "var(--vp-font-family-mono, monospace)",
        }}
      >
        <div style={{ color: "rgba(255,255,255,0.9)", fontSize: "12px", fontWeight: 600 }}>
          Task {index + 1}: {todo.text.length > 40 ? todo.text.slice(0, 40) + "..." : todo.text}
        </div>
        <div style={{ color: STATE_BORDERS[state], fontSize: "10px", marginTop: "3px" }}>
          {todo.done ? "Completed" : run ? "Running" : "Pending"}
          {toolCalls > 0 && ` · ${toolCalls} tool calls`}
          {duration && ` · ${duration}`}
        </div>
      </div>
    </Html>
  );
}
