# Todo Agent Visualizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-screen 3D visualization of the todo execution workflow using Three.js, where tasks appear as glowing nodes in space connected by energy beams.

**Architecture:** A React Three Fiber scene rendered in a full-screen overlay. Each todo maps to a positioned sphere node with state-based coloring and glow. Camera auto-orbits with click-to-focus. Hover shows HTML tooltips via drei's Html component. Click opens a bottom modal with the task's event stream. The visualizer is opened from a button in the execution panel.

**Tech Stack:** Three.js, @react-three/fiber, @react-three/drei, React, TypeScript

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/components/AgentVisualizer.tsx` | Full-screen overlay: R3F Canvas, scene composition, state management (hovered/selected node) |
| `src/components/AgentVisualizer.css` | Overlay positioning, back button, modal, tooltip styles |
| `src/components/visualizer/TaskNode.tsx` | Single glowing sphere: mesh + emissive material + point light, hover/click, pulse animation |
| `src/components/visualizer/TaskConnection.tsx` | Energy beam line between two Vector3 positions |
| `src/components/visualizer/TaskTooltip.tsx` | Html overlay with task name, status, stats |
| `src/components/visualizer/TaskDetailModal.tsx` | Bottom modal with event stream rows |
| `src/components/visualizer/CameraController.tsx` | Auto-orbit + smooth fly-to on node select |
| `src/components/TodoPanel.tsx` | **Modified** — add Visualize button + onVisualize prop |
| `src/App.tsx` | **Modified** — add visualizerOpen state, render AgentVisualizer conditionally |

---

### Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Three.js and React Three Fiber packages**

Run:
```bash
npm install three @react-three/fiber @react-three/drei
npm install -D @types/three
```

- [ ] **Step 2: Verify the install succeeds and app still compiles**

Run: `npx tsc --noEmit`
Expected: No errors (R3F types should resolve)

- [ ] **Step 3: Commit**

```
chore(deps): add three, @react-three/fiber, @react-three/drei
```

---

### Task 2: Create TaskNode component

**Files:**
- Create: `src/components/visualizer/TaskNode.tsx`

- [ ] **Step 1: Create the TaskNode component**

This is a single glowing sphere in the 3D scene. It receives position, state (completed/running/pending), and hover/click callbacks. It renders a sphere mesh with emissive material plus a point light for glow. Running state has a pulsing scale animation.

```typescript
// src/components/visualizer/TaskNode.tsx
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";
import * as THREE from "three";

interface TaskNodeProps {
  position: [number, number, number];
  state: "completed" | "running" | "pending";
  index: number;
  onPointerOver: () => void;
  onPointerOut: () => void;
  onClick: () => void;
}

const STATE_CONFIG = {
  completed: {
    color: new THREE.Color("#6366f1"),
    emissive: new THREE.Color("#818cf8"),
    lightColor: "#818cf8",
    lightIntensity: 2,
    radius: 0.5,
    opacity: 1,
  },
  running: {
    color: new THREE.Color("#059669"),
    emissive: new THREE.Color("#34d399"),
    lightColor: "#34d399",
    lightIntensity: 4,
    radius: 0.6,
    opacity: 1,
  },
  pending: {
    color: new THREE.Color("#334155"),
    emissive: new THREE.Color("#475569"),
    lightColor: "#475569",
    lightIntensity: 0.5,
    radius: 0.35,
    opacity: 0.5,
  },
};

export function TaskNode({ position, state, onPointerOver, onPointerOut, onClick }: TaskNodeProps) {
  const meshRef = useRef<Mesh>(null);
  const config = STATE_CONFIG[state];

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    if (state === "running") {
      const scale = 1 + Math.sin(clock.getElapsedTime() * 3) * 0.15;
      meshRef.current.scale.setScalar(scale);
    } else {
      meshRef.current.scale.setScalar(1);
    }
  });

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onPointerOver={(e) => { e.stopPropagation(); onPointerOver(); }}
        onPointerOut={onPointerOut}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
      >
        <sphereGeometry args={[config.radius, 32, 32]} />
        <meshStandardMaterial
          color={config.color}
          emissive={config.emissive}
          emissiveIntensity={state === "running" ? 1.5 : 0.8}
          transparent={state === "pending"}
          opacity={config.opacity}
        />
      </mesh>
      <pointLight color={config.lightColor} intensity={config.lightIntensity} distance={6} />
    </group>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```
feat(visualizer): add TaskNode 3D sphere component
```

---

### Task 3: Create TaskConnection component

**Files:**
- Create: `src/components/visualizer/TaskConnection.tsx`

- [ ] **Step 1: Create the TaskConnection component**

An energy beam line between two 3D positions. Uses a tube geometry for thickness with emissive glow. Color blends between the two node states.

```typescript
// src/components/visualizer/TaskConnection.tsx
import { useMemo } from "react";
import * as THREE from "three";

interface TaskConnectionProps {
  from: [number, number, number];
  to: [number, number, number];
  fromState: "completed" | "running" | "pending";
  toState: "completed" | "running" | "pending";
}

const STATE_COLORS: Record<string, THREE.Color> = {
  completed: new THREE.Color("#818cf8"),
  running: new THREE.Color("#34d399"),
  pending: new THREE.Color("#334155"),
};

export function TaskConnection({ from, to, fromState, toState }: TaskConnectionProps) {
  const { curve, color, opacity } = useMemo(() => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const mid = start.clone().lerp(end, 0.5);
    mid.y += 0.3; // slight upward arc
    const c = new THREE.QuadraticBezierCurve3(start, mid, end);
    const col = STATE_COLORS[fromState].clone().lerp(STATE_COLORS[toState], 0.5);
    const dim = fromState === "pending" || toState === "pending";
    return { curve: c, color: col, opacity: dim ? 0.25 : 0.7 };
  }, [from, to, fromState, toState]);

  return (
    <mesh>
      <tubeGeometry args={[curve, 20, 0.04, 8, false]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.6}
        transparent
        opacity={opacity}
      />
    </mesh>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```
feat(visualizer): add TaskConnection energy beam component
```

---

### Task 4: Create CameraController component

**Files:**
- Create: `src/components/visualizer/CameraController.tsx`

- [ ] **Step 1: Create the CameraController component**

Handles auto-orbit and smooth fly-to-node on selection. Uses drei's OrbitControls with autoRotate. When a target position is set, lerps the camera toward it.

```typescript
// src/components/visualizer/CameraController.tsx
import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

interface CameraControllerProps {
  target: [number, number, number] | null;
  chainCenter: [number, number, number];
}

export function CameraController({ target, chainCenter }: CameraControllerProps) {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();
  const flyTarget = useRef<THREE.Vector3 | null>(null);
  const flyLook = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    if (target) {
      const pos = new THREE.Vector3(...target);
      flyTarget.current = new THREE.Vector3(pos.x, pos.y + 2, pos.z + 5);
      flyLook.current = pos;
    } else {
      flyTarget.current = null;
      flyLook.current = null;
    }
  }, [target]);

  useFrame(() => {
    if (flyTarget.current && flyLook.current && controlsRef.current) {
      camera.position.lerp(flyTarget.current, 0.03);
      controlsRef.current.target.lerp(flyLook.current, 0.03);
      controlsRef.current.update();

      if (camera.position.distanceTo(flyTarget.current) < 0.1) {
        flyTarget.current = null;
        flyLook.current = null;
      }
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      autoRotate
      autoRotateSpeed={0.3}
      enableDamping
      dampingFactor={0.05}
      target={chainCenter}
      minDistance={3}
      maxDistance={40}
    />
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```
feat(visualizer): add CameraController with auto-orbit and fly-to
```

---

### Task 5: Create TaskTooltip component

**Files:**
- Create: `src/components/visualizer/TaskTooltip.tsx`

- [ ] **Step 1: Create the TaskTooltip component**

Uses drei's `Html` component to render a floating HTML tooltip in 3D space attached to the hovered node. Shows task name, status, duration, tool call count.

```typescript
// src/components/visualizer/TaskTooltip.tsx
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```
feat(visualizer): add TaskTooltip floating HTML overlay
```

---

### Task 6: Create TaskDetailModal component

**Files:**
- Create: `src/components/visualizer/TaskDetailModal.tsx`

- [ ] **Step 1: Create the TaskDetailModal component**

A bottom-anchored modal overlay that shows a task's event stream. Reuses the `StreamRow` rendering pattern from the main app. Renders visible stream rows from the selected task's `PersistedRun`.

```typescript
// src/components/visualizer/TaskDetailModal.tsx
import type { TodoItem, PersistedRun, StreamRow } from "../../types";
import { formatMessage } from "../../lib/frontendUtils";

interface TaskDetailModalProps {
  todo: TodoItem;
  run?: PersistedRun;
  index: number;
  onClose: () => void;
}

function renderRow(row: StreamRow) {
  if (row.hidden) return null;
  switch (row.category) {
    case "message":
      return (
        <div key={row.id} className="viz-modal-message">
          {formatMessage(row.text)}
        </div>
      );
    case "command":
      return (
        <div key={row.id} className="viz-modal-command">
          <span className="viz-modal-prefix">$</span>
          <span>{row.command ?? row.text}</span>
          <span className={`viz-modal-status is-${row.status}`}>
            {row.status === "done" && "done"}
            {row.status === "failed" && `exit ${row.exitCode}`}
          </span>
        </div>
      );
    case "file_change":
      return (
        <div key={row.id} className="viz-modal-file">
          <span className="viz-modal-file-label">edited</span> {row.text}
        </div>
      );
    case "error":
      return <div key={row.id} className="viz-modal-error">{row.text}</div>;
    default:
      return row.text ? <div key={row.id} className="viz-modal-status-row">{row.text}</div> : null;
  }
}

export function TaskDetailModal({ todo, run, index, onClose }: TaskDetailModalProps) {
  const state = todo.done ? "completed" : run ? "running" : "pending";
  const duration = run?.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : null;

  return (
    <div className="viz-modal-overlay" onClick={onClose}>
      <div className="viz-modal" onClick={(e) => e.stopPropagation()}>
        <div className="viz-modal-header">
          <div className="viz-modal-title">
            <span className={`viz-modal-dot viz-dot-${state}`} />
            Task {index + 1}: {todo.text}
          </div>
          <div className="viz-modal-meta">
            {state.charAt(0).toUpperCase() + state.slice(1)}
            {duration && ` · ${duration}`}
            {run && ` · ${run.streamRows.filter((r) => r.category === "command").length} tool calls`}
          </div>
          <button type="button" className="viz-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="viz-modal-body">
          {run ? (
            run.streamRows.filter((r) => !r.hidden).map(renderRow)
          ) : (
            <div className="viz-modal-empty">No execution data yet</div>
          )}
          {run?.finalSummary && (
            <div className="viz-modal-summary">{formatMessage(run.finalSummary)}</div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```
feat(visualizer): add TaskDetailModal with event stream rendering
```

---

### Task 7: Create AgentVisualizer main component and CSS

**Files:**
- Create: `src/components/AgentVisualizer.tsx`
- Create: `src/components/AgentVisualizer.css`

- [ ] **Step 1: Create the AgentVisualizer component**

This is the full-screen overlay that composes all the visualizer pieces. It sets up the R3F Canvas, positions nodes, manages hover/selected state, and renders tooltips + modal.

```typescript
// src/components/AgentVisualizer.tsx
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
  // First non-done todo with a matching run is "running"
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
```

- [ ] **Step 2: Create the CSS file**

```css
/* src/components/AgentVisualizer.css */

.viz-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: #0a0a1a;
  outline: none;
}

.viz-back {
  position: fixed;
  top: 12px;
  left: 16px;
  z-index: 10001;
  background: rgba(22, 22, 22, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.7);
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
  font-family: var(--vp-font-family-mono, monospace);
  transition: color 0.15s, border-color 0.15s;
}

.viz-back:hover {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.3);
}

.viz-info {
  position: fixed;
  top: 12px;
  right: 16px;
  z-index: 10001;
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
  font-family: var(--vp-font-family-mono, monospace);
}

/* Detail modal */
.viz-modal-overlay {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  top: 0;
  z-index: 10002;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: flex-end;
}

.viz-modal {
  width: 100%;
  max-height: 45vh;
  background: rgba(22, 22, 22, 0.97);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.viz-modal-header {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
  position: relative;
}

.viz-modal-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  font-weight: 600;
}

.viz-modal-meta {
  color: rgba(255, 255, 255, 0.4);
  font-size: 11px;
  margin-top: 3px;
}

.viz-modal-close {
  position: absolute;
  top: 10px;
  right: 12px;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.4);
  font-size: 20px;
  cursor: pointer;
  padding: 0 4px;
}

.viz-modal-close:hover {
  color: #fff;
}

.viz-modal-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.viz-dot-completed { background: #818cf8; }
.viz-dot-running { background: #34d399; }
.viz-dot-pending { background: #475569; }

.viz-modal-body {
  padding: 12px 16px;
  overflow-y: auto;
  flex: 1;
  font-size: 13px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.8);
}

.viz-modal-message {
  padding: 4px 0;
  color: rgba(255, 255, 255, 0.85);
}

.viz-modal-command {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 0;
  font-family: var(--vp-font-family-mono, monospace);
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.viz-modal-prefix {
  color: rgba(255, 255, 255, 0.3);
}

.viz-modal-status.is-done { color: #34d399; margin-left: auto; }
.viz-modal-status.is-failed { color: #ef4444; margin-left: auto; }

.viz-modal-file {
  padding: 2px 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.viz-modal-file-label {
  color: #818cf8;
  font-size: 11px;
  margin-right: 4px;
}

.viz-modal-error {
  color: #ef4444;
  padding: 3px 0;
  font-size: 12px;
}

.viz-modal-status-row {
  color: rgba(255, 255, 255, 0.3);
  font-size: 11px;
  padding: 2px 0;
}

.viz-modal-empty {
  color: rgba(255, 255, 255, 0.3);
  text-align: center;
  padding: 24px;
}

.viz-modal-summary {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.7);
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```
feat(visualizer): add AgentVisualizer main component and styles
```

---

### Task 8: Wire visualizer into App.tsx and TodoPanel

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/TodoPanel.tsx`

- [ ] **Step 1: Add visualizerOpen state and render AgentVisualizer in App.tsx**

Read `src/App.tsx`. Find the existing state declarations near `confirmTodoMode` / `confirmClearTodos`. Add:

```typescript
const [visualizerOpen, setVisualizerOpen] = useState(false);
```

Import `AgentVisualizer`:
```typescript
import { AgentVisualizer } from "./components/AgentVisualizer";
```

Find where `TodoPanel` is rendered (around line 2703). Add the `onVisualize` prop:
```typescript
onVisualize={() => setVisualizerOpen(true)}
```

Find the end of the component's return JSX (just before the closing `</div>` of the container). Add the visualizer overlay conditionally:

```tsx
{visualizerOpen && (
  <AgentVisualizer
    todos={todos}
    runs={activeSession?.runs ?? []}
    onClose={() => setVisualizerOpen(false)}
  />
)}
```

- [ ] **Step 2: Add Visualize button to TodoPanel**

Read `src/components/TodoPanel.tsx`. Add `onVisualize` to the props interface:

```typescript
onVisualize?: () => void;
```

Destructure it in the component function.

In the `renderExecutionView` function, find the player section (the `todo-player` div). Add a Visualize button after the existing player buttons. Good placement is right before the `<span className="todo-player-status">` element:

```tsx
{onVisualize && todos.length > 0 && (
  <button
    type="button"
    className="todo-player-btn"
    onClick={onVisualize}
    title="Visualize execution"
    style={{ marginLeft: "auto" }}
  >
    <svg viewBox="0 0 24 24" aria-hidden="true" width="14" height="14">
      <circle cx="5" cy="12" r="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="6" r="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="19" cy="12" r="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M7 11l3-4M14 7l3 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  </button>
)}
```

Also add a standalone "Visualize" button in the execution view for when there's no player bar (i.e., when all todos are done or there are no pending items). Find the QUEUE section (after the progress bar area). Add before the queue list:

```tsx
{onVisualize && todos.length > 0 && pending.length === 0 && (
  <button
    type="button"
    className="todo-action-btn"
    onClick={onVisualize}
    title="Visualize execution"
    style={{ margin: "6px 10px" }}
  >
    Visualize
  </button>
)}
```

- [ ] **Step 3: Verify TypeScript compiles and all tests pass**

Run: `npx tsc --noEmit && npx vitest run`
Expected: All pass

- [ ] **Step 4: Commit**

```
feat(visualizer): wire AgentVisualizer into App and TodoPanel
```

---

## Self-Review

**Spec coverage:**
- [x] Full-screen overlay — Task 7 (AgentVisualizer + CSS)
- [x] Deep space background with starfield — Task 7 (Stars component)
- [x] Glowing spheres with state colors — Task 2 (TaskNode)
- [x] Pulse animation for running — Task 2 (useFrame animation)
- [x] Energy beam connections — Task 3 (TaskConnection)
- [x] Auto-orbit camera — Task 4 (CameraController with OrbitControls autoRotate)
- [x] Click-to-focus camera — Task 4 (lerp to target)
- [x] Hover tooltip — Task 5 (TaskTooltip with Html)
- [x] Click detail modal — Task 6 (TaskDetailModal with event stream)
- [x] Back button + Escape — Task 7 (handleClose, handleKeyDown)
- [x] Entry point button — Task 8 (TodoPanel Visualize button)
- [x] Dependencies installed — Task 1

**Placeholder scan:** No TBD/TODO found. All code blocks are complete.

**Type consistency:** `AgentVisualizerProps` uses `TodoItem[]` and `PersistedRun[]` consistently. Node state type `"completed" | "running" | "pending"` used identically across TaskNode, TaskConnection, TaskTooltip, TaskDetailModal. Position type `[number, number, number]` consistent throughout.
