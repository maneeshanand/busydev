import { useState, useMemo, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import type { TodoItem, PersistedRun } from "../types";
import { TaskNode, type VisualMode } from "./visualizer/TaskNode";
import { TaskConnection } from "./visualizer/TaskConnection";
import { TaskTooltip } from "./visualizer/TaskTooltip";
import { TaskDetailModal } from "./visualizer/TaskDetailModal";
import { CameraController } from "./visualizer/CameraController";
import { Constellations } from "./visualizer/Constellations";
import "./AgentVisualizer.css";

interface AgentVisualizerProps {
  todos: TodoItem[];
  runs: PersistedRun[];
  running?: boolean;
  onClose: () => void;
}

export function AgentVisualizer({ todos, runs, running, onClose }: AgentVisualizerProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [visualMode, setVisualMode] = useState<VisualMode>("orbital");

  const nodes = useMemo(() => {
    // The first non-done todo is "running" if the session has an active agent
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

      // Match a run to this todo for the event stream detail view.
      // Display prompt format: "Todo #N: <text>" or raw user prompt.
      const todoTextLower = todo.text.toLowerCase();
      const run = runs.find((r) => {
        const p = r.prompt.toLowerCase();
        // Direct text match
        if (p.includes(todoTextLower)) return true;
        // Strip "Todo #N: " prefix and match remainder against todo text
        const stripped = p.replace(/^todo #\d+:\s*/, "");
        if (stripped && todoTextLower.includes(stripped)) return true;
        return false;
      });

      return {
        todo,
        run,
        state,
        position: [
          i * 4,
          Math.sin(i * 0.8) * 1.2,
          Math.cos(i * 1.1) * 0.8,
        ] as [number, number, number],
      };
    });
  }, [todos, runs, running]);

  const chainCenter = useMemo<[number, number, number]>(() => {
    if (nodes.length === 0) return [0, 0, 0];
    const midIdx = Math.floor(nodes.length / 2);
    return nodes[midIdx].position;
  }, [nodes]);

  const selectedTarget = selectedIndex !== null && nodes[selectedIndex]
    ? nodes[selectedIndex].position
    : null;

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

  return (
    <div className="viz-overlay" onKeyDown={handleKeyDown} tabIndex={0}>
      <button type="button" className="viz-back" onClick={handleClose}>
        ← Back
      </button>
      <div className="viz-controls">
        <select
          className="viz-mode-select"
          value={visualMode}
          onChange={(e) => setVisualMode(e.target.value as VisualMode)}
        >
          <option value="orbital">Orbital Rings</option>
          <option value="tactical">Tactical HUD</option>
          <option value="circuit">Circuit Board</option>
        </select>
        <span className="viz-info-text">
          {nodes.filter((n) => n.state === "completed").length}/{nodes.length} completed
        </span>
      </div>

      <Canvas
        camera={{
          position: [
            chainCenter[0],
            chainCenter[1] + 3,
            chainCenter[2] + Math.max(12, nodes.length * 2.5),
          ],
          fov: 50,
          near: 0.1,
          far: 500,
        }}
        style={{ background: "#0a0a1a" }}
      >
        <ambientLight intensity={0.15} />

        <Stars radius={100} depth={60} count={1200} factor={3} saturation={0} fade speed={0.5} />
        <Constellations count={14} radius={80} />

        <CameraController target={selectedTarget} chainCenter={chainCenter} />

        {nodes.map((node, i) => (
          <TaskNode
            key={node.todo.id}
            position={node.position}
            state={node.state}
            index={i}
            mode={visualMode}
            label={node.todo.text}
            toolCalls={node.run?.streamRows.filter((r) => r.category === "command").length}
            durationMs={node.run?.durationMs}
            onPointerOver={() => setHoveredIndex(i)}
            onPointerOut={() => setHoveredIndex(null)}
            onClick={() => setSelectedIndex(i)}
          />
        ))}

        {nodes.map((node, i) => {
          if (i === 0) return null;
          return (
            <TaskConnection
              key={`conn-${i}`}
              from={nodes[i - 1].position}
              to={node.position}
              fromState={nodes[i - 1].state}
              toState={node.state}
            />
          );
        })}

        {hoveredIndex !== null && nodes[hoveredIndex] && (
          <TaskTooltip
            position={nodes[hoveredIndex].position}
            todo={nodes[hoveredIndex].todo}
            run={nodes[hoveredIndex].run}
            index={hoveredIndex}
          />
        )}
      </Canvas>

      {selectedIndex !== null && nodes[selectedIndex] && (
        <TaskDetailModal
          todo={nodes[selectedIndex].todo}
          run={nodes[selectedIndex].run}
          index={selectedIndex}
          onClose={() => setSelectedIndex(null)}
        />
      )}
    </div>
  );
}
