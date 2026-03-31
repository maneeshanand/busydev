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
      return { id: live.id, prompt: live.prompt, streamRows: live.streamRows, exitCode: null, durationMs: 0, finalSummary: "" };
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

const NODE_SPACING = 280; // px between node centers
const NODE_SIZE = 64;

export function AgentVisualizer({ todos, runs, inFlightRuns, running, onClose }: AgentVisualizerProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [visualMode, setVisualMode] = useState<VisualMode>("orbital");
  const canvasRef = useRef<HTMLDivElement>(null);

  // Pan/zoom state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number } | null>(null);

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

  // Center view on initial load
  useEffect(() => {
    if (canvasRef.current && nodes.length > 0) {
      const canvasW = canvasRef.current.offsetWidth;
      const chainW = (nodes.length - 1) * NODE_SPACING;
      const centerX = chainW / 2;
      setPan({ x: canvasW / 2 - centerX, y: 0 });
    }
  }, [nodes.length]);

  // Zoom via scroll wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.3, Math.min(4, zoom * delta));
    const ratio = newZoom / zoom;

    setPan((p) => ({
      x: mouseX - ratio * (mouseX - p.x),
      y: mouseY - ratio * (mouseY - p.y),
    }));
    setZoom(newZoom);
  }, [zoom]);

  // Pan via drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".viz-node")) return; // don't drag when clicking nodes
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPanX: pan.x, startPanY: pan.y };
    const handleMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setPan({
        x: dragRef.current.startPanX + (ev.clientX - dragRef.current.startX),
        y: dragRef.current.startPanY + (ev.clientY - dragRef.current.startY),
      });
    };
    const handleUp = () => {
      dragRef.current = null;
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
      document.body.style.cursor = "";
    };
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
    document.body.style.cursor = "grabbing";
  }, [pan]);

  // Click node → center + zoom in + show details
  const handleNodeClick = useCallback((i: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) { setSelectedIndex(i); return; }

    const nodeX = i * NODE_SPACING;
    const nodeY = 0;
    const targetZoom = 2;
    const centerX = rect.width / 2 - nodeX * targetZoom;
    const centerY = rect.height / 2 - nodeY * targetZoom - 60; // offset up for detail panel

    setZoom(targetZoom);
    setPan({ x: centerX, y: centerY });
    setSelectedIndex(i);
  }, []);

  const handleClose = useCallback(() => {
    setSelectedIndex(null);
    setHoveredIndex(null);
    onClose();
  }, [onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      if (selectedIndex !== null) {
        // Deselect and zoom back out
        setSelectedIndex(null);
        if (canvasRef.current && nodes.length > 0) {
          const canvasW = canvasRef.current.offsetWidth;
          const chainW = (nodes.length - 1) * NODE_SPACING;
          setZoom(1);
          setPan({ x: canvasW / 2 - chainW / 2, y: 0 });
        }
      } else {
        handleClose();
      }
    }
  }, [selectedIndex, handleClose, nodes.length]);

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

      <div
        className="viz-canvas"
        ref={canvasRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
      >
        <div
          className="viz-world"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        >
          {/* Connection lines */}
          <svg className="viz-connections" style={{ width: (nodes.length - 1) * NODE_SPACING + NODE_SIZE, height: NODE_SIZE }}>
            {nodes.map((node, i) => {
              if (i === 0) return null;
              const x1 = (i - 1) * NODE_SPACING + NODE_SIZE / 2;
              const x2 = i * NODE_SPACING + NODE_SIZE / 2;
              const y = NODE_SIZE / 2;
              return (
                <line
                  key={`conn-${i}`}
                  x1={x1} y1={y} x2={x2} y2={y}
                  className={`viz-svg-conn viz-svg-conn-${nodes[i - 1].state}-${node.state}`}
                />
              );
            })}
          </svg>

          {/* Nodes */}
          {nodes.map((node, i) => {
            const isHovered = hoveredIndex === i;
            const isSelected = selectedIndex === i;

            return (
              <div
                key={node.todo.id}
                className={`viz-node viz-node-${node.state} viz-node-${visualMode} ${isHovered ? "viz-node-hovered" : ""} ${isSelected ? "viz-node-selected" : ""}`}
                style={{ left: i * NODE_SPACING }}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => handleNodeClick(i)}
              >
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

                {/* Label only on hover or select */}
                {(isHovered || isSelected) && (
                  <div className="viz-node-label">
                    <div className="viz-node-title">{node.todo.text}</div>
                    <div className="viz-node-meta">
                      {node.state === "completed" ? "Done" : node.state === "running" ? "Running" : "Pending"}
                      {node.toolCalls > 0 && ` · ${node.toolCalls} tools`}
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
          onClose={() => {
            setSelectedIndex(null);
            // Zoom back out
            if (canvasRef.current && nodes.length > 0) {
              const canvasW = canvasRef.current.offsetWidth;
              const chainW = (nodes.length - 1) * NODE_SPACING;
              setZoom(1);
              setPan({ x: canvasW / 2 - chainW / 2, y: 0 });
            }
          }}
        />
      )}
    </div>
  );
}
