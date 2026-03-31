import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import type { TodoItem, PersistedRun, InFlightRun } from "../types";
import { TaskDetailModal } from "./visualizer/TaskDetailModal";
import "./AgentVisualizer.css";

export type VisualMode = "orbital" | "tactical" | "circuit";

interface AgentVisualizerProps {
  todos: TodoItem[];
  runs: PersistedRun[];
  inFlightRuns?: Record<string, InFlightRun>;
  running?: boolean;
  onClose: () => void;
}

function matchPrompt(prompt: string, todoText: string): boolean {
  const pl = prompt.toLowerCase();
  const tl = todoText.toLowerCase();
  if (pl.includes(tl)) return true;
  const stripped = pl.replace(/^todo #\d+:\s*/, "");
  return stripped.length > 0 && tl.includes(stripped);
}

function getSelectedRun(
  todo: TodoItem,
  runs: PersistedRun[],
  inFlightRuns?: Record<string, InFlightRun>,
): PersistedRun | undefined {
  const persisted = runs.find((r) => matchPrompt(r.prompt, todo.text));
  if (persisted) return persisted;
  if (inFlightRuns) {
    const live = Object.values(inFlightRuns).find((r) => matchPrompt(r.prompt, todo.text));
    if (live) {
      return {
        id: live.id,
        prompt: live.prompt,
        streamRows: live.streamRows,
        exitCode: null,
        durationMs: 0,
        finalSummary: "",
      };
    }
  }
  return undefined;
}

interface NodeData {
  todo: TodoItem;
  run?: PersistedRun;
  state: "completed" | "running" | "pending";
  toolCalls: number;
  durationMs: number;
}

export function AgentVisualizer({ todos, runs, inFlightRuns, running, onClose }: AgentVisualizerProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [visualMode, setVisualMode] = useState<VisualMode>("orbital");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pulsePhase, setPulsePhase] = useState(0);

  // Animate pulse for running nodes
  useEffect(() => {
    if (!running) return;
    let raf: number;
    const tick = () => {
      setPulsePhase(Date.now() / 500);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  const nodes: NodeData[] = useMemo(() => {
    const firstPendingIdx = todos.findIndex((t) => !t.done);
    return todos.map((todo, i) => {
      let state: "completed" | "running" | "pending";
      if (todo.done) {
        state = "completed";
      } else if (running && i === firstPendingIdx) {
        state = "running";
      } else {
        state = "pending";
      }
      const run = runs.find((r) => matchPrompt(r.prompt, todo.text));
      const toolCalls = run?.streamRows.filter((r) => r.category === "command").length ?? 0;
      return { todo, run, state, toolCalls, durationMs: run?.durationMs ?? 0 };
    });
  }, [todos, runs, running]);

  const handleClose = useCallback(() => {
    setSelectedIndex(null);
    setHoveredIndex(null);
    onClose();
  }, [onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      if (selectedIndex !== null) {
        setSelectedIndex(null);
      } else {
        handleClose();
      }
    }
  }, [selectedIndex, handleClose]);

  const completedCount = nodes.filter((n) => n.state === "completed").length;

  return (
    <div className="viz-overlay" onKeyDown={handleKeyDown} tabIndex={0}>
      <div className="viz-toolbar">
        <button type="button" className="viz-back" onClick={handleClose}>
          ← Back
        </button>
        <div className="viz-controls">
          <select
            className="viz-mode-select"
            value={visualMode}
            onChange={(e) => setVisualMode(e.target.value as VisualMode)}
          >
            <option value="orbital">Orbital</option>
            <option value="tactical">Tactical</option>
            <option value="circuit">Circuit</option>
          </select>
          <span className="viz-info-text">
            {completedCount}/{nodes.length} completed
          </span>
        </div>
      </div>

      <div className="viz-canvas" ref={scrollRef}>
        <div className="viz-chain" style={{ minWidth: Math.max(600, nodes.length * 160) }}>
          {nodes.map((node, i) => {
            const isHovered = hoveredIndex === i;
            const isSelected = selectedIndex === i;
            const pulseScale = node.state === "running" ? 1 + Math.sin(pulsePhase) * 0.12 : 1;

            return (
              <div key={node.todo.id} className="viz-node-group">
                {/* Connection line (not for first) */}
                {i > 0 && (
                  <div className={`viz-connection viz-conn-${nodes[i - 1].state}-${node.state}`} />
                )}

                {/* Node */}
                <div
                  className={`viz-node viz-node-${node.state} viz-node-${visualMode} ${isHovered ? "viz-node-hovered" : ""} ${isSelected ? "viz-node-selected" : ""}`}
                  style={node.state === "running" ? { transform: `scale(${pulseScale})` } : undefined}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onClick={() => setSelectedIndex(i)}
                >
                  {/* Mode-specific inner content */}
                  {visualMode === "orbital" && (
                    <>
                      <div className="viz-orbital-ring" />
                      <div className="viz-orbital-ring viz-orbital-ring-outer" />
                      <div className="viz-orbital-core" />
                    </>
                  )}
                  {visualMode === "tactical" && (
                    <span className="viz-tactical-num">{String(i + 1).padStart(2, "0")}</span>
                  )}
                  {visualMode === "circuit" && (
                    <>
                      <div className="viz-circuit-pin viz-circuit-pin-left" />
                      <div className="viz-circuit-pin viz-circuit-pin-right" />
                      {node.state === "running" && <div className="viz-circuit-led" />}
                    </>
                  )}
                </div>

                {/* Label */}
                <div className="viz-node-label">
                  <div className="viz-node-title">
                    {node.todo.text.length > 28 ? node.todo.text.slice(0, 28) + "..." : node.todo.text}
                  </div>
                  <div className="viz-node-meta">
                    {node.state === "completed" ? "Done" : node.state === "running" ? "Running" : "Pending"}
                    {node.toolCalls > 0 && ` · ${node.toolCalls} tools`}
                    {node.durationMs > 0 && ` · ${(node.durationMs / 1000).toFixed(1)}s`}
                  </div>
                </div>

                {/* Tooltip on hover */}
                {isHovered && (
                  <div className="viz-tooltip">
                    <div className="viz-tooltip-title">Task {i + 1}: {node.todo.text}</div>
                    <div className="viz-tooltip-meta">
                      {node.state === "completed" ? "Completed" : node.state === "running" ? "In Progress" : "Pending"}
                      {node.toolCalls > 0 && ` · ${node.toolCalls} tool calls`}
                      {node.durationMs > 0 && ` · ${(node.durationMs / 1000).toFixed(1)}s`}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {selectedIndex !== null && nodes[selectedIndex] && (
        <TaskDetailModal
          todo={nodes[selectedIndex].todo}
          run={getSelectedRun(nodes[selectedIndex].todo, runs, inFlightRuns)}
          index={selectedIndex}
          onClose={() => setSelectedIndex(null)}
        />
      )}
    </div>
  );
}
