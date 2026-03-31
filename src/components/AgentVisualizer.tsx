import { useState, useMemo, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import type { TodoItem, PersistedRun } from "../types";
import { TaskNode } from "./visualizer/TaskNode";
import { TaskConnection } from "./visualizer/TaskConnection";
import { TaskTooltip } from "./visualizer/TaskTooltip";
import { TaskDetailModal } from "./visualizer/TaskDetailModal";
import { CameraController } from "./visualizer/CameraController";
import "./AgentVisualizer.css";

interface AgentVisualizerProps {
  todos: TodoItem[];
  runs: PersistedRun[];
  onClose: () => void;
}

function getNodeState(todo: TodoItem, runIndex: number, runs: PersistedRun[]): "completed" | "running" | "pending" {
  if (todo.done) return "completed";
  if (runIndex < runs.length) return "running";
  return "pending";
}

export function AgentVisualizer({ todos, runs, onClose }: AgentVisualizerProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const nodes = useMemo(() => {
    return todos.map((todo, i) => ({
      todo,
      run: i < runs.length ? runs[i] : undefined,
      state: getNodeState(todo, i, runs),
      position: [
        i * 4,
        Math.sin(i * 0.8) * 1.2,
        Math.cos(i * 1.1) * 0.8,
      ] as [number, number, number],
    }));
  }, [todos, runs]);

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
      <div className="viz-info">
        {nodes.filter((n) => n.state === "completed").length}/{nodes.length} completed
      </div>

      <Canvas
        camera={{ position: [chainCenter[0], chainCenter[1] + 4, chainCenter[2] + 12], fov: 50 }}
        style={{ background: "#0a0a1a" }}
      >
        <ambientLight intensity={0.15} />

        <Stars radius={100} depth={60} count={800} factor={3} saturation={0} fade speed={0.5} />

        <CameraController target={selectedTarget} chainCenter={chainCenter} />

        {nodes.map((node, i) => (
          <TaskNode
            key={node.todo.id}
            position={node.position}
            state={node.state}
            index={i}
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
