# Todo Agent Visualizer — Design Spec

## Goal

A full-screen 3D visualization of the todo execution workflow. Each task appears as a glowing node/planet in space, connected by energy beams. Hovering reveals task details, clicking shows the event stream. Camera auto-orbits with manual control.

---

## Entry Point

A "Visualize" button in the execution panel (TodoPanel). Opens a full-screen overlay that takes over the entire app window. Closes via "← Back" button (top-left) or Escape key.

---

## 3D Scene (Three.js + React Three Fiber)

### Background
- Deep black void (#0a0a1a)
- Subtle starfield particles (hundreds of tiny dots at random positions)

### Nodes (Task Spheres)
- Glowing spheres arranged in a semi-linear chain
- Slight vertical and depth variation between nodes (sinusoidal offset) so they don't sit in a flat line
- Node spacing: ~4 units apart along X axis
- Node states:
  - **Completed** — indigo/purple glow (#818cf8 / #4f46e5), full opacity
  - **Running** — green glow (#34d399 / #059669), pulsing scale animation (1.0 → 1.15 → 1.0)
  - **Pending** — dim gray (#64748b), 40% opacity, smaller radius
- Node radius: 0.5 base, pending 0.35, running 0.6
- Glow effect: emissive material + point light at each node position (low intensity, colored to match state)

### Connections (Energy Beams)
- Glowing lines between adjacent nodes
- Use `THREE.TubeGeometry` or thick `Line2` with a gradient
- Color interpolates between the two connected nodes' colors
- Completed→completed: bright, full opacity
- Into pending: fades to dim

### Camera
- Auto-orbits: slow rotation around the chain center (0.05 rad/s)
- OrbitControls enabled: user can drag to rotate, scroll to zoom
- On node click: smooth camera animation (lerp over ~1s) to focus on the clicked node at a comfortable distance
- Initial position: slightly above and behind the chain center, looking at midpoint

---

## Interactions

### Hover → Floating Tooltip
- Uses `@react-three/drei`'s `Html` component attached to the hovered node
- Shows:
  - Task number and name (e.g., "Task 3: Implement API endpoints")
  - Status badge (Completed / Running / Pending)
  - Duration (if completed)
  - Tool call count (if available from run data)
- Styled as a dark card with the node's accent color as left border
- Disappears when mouse leaves the node

### Click → Detail Modal
- Bottom-anchored modal overlay (40% viewport height)
- Semi-transparent dark background
- Shows:
  - Task header (name, status, duration)
  - Event stream: reuses the existing `StreamRow` rendering pattern from the execution panel
  - Scrollable if content overflows
- Close via X button, clicking outside, or Escape
- The 3D scene remains visible above the modal (dimmed slightly)

### Navigation
- "← Back" button: fixed position top-left, semi-transparent dark background, returns to execution panel
- Escape key: closes modal if open, otherwise closes visualizer

---

## Dependencies

```
npm install three @react-three/fiber @react-three/drei
```

- `three` — 3D rendering engine
- `@react-three/fiber` — React renderer for Three.js (declarative JSX scene graph)
- `@react-three/drei` — helpers: `OrbitControls`, `Html` (CSS overlay in 3D), `Stars`, `Float`

---

## Component Structure

| File | Responsibility |
|------|---------------|
| `src/components/AgentVisualizer.tsx` | Full-screen overlay, scene setup (Canvas, camera, lights, stars), maps todos to node positions, manages selected/hovered state |
| `src/components/AgentVisualizer.css` | Overlay positioning, back button, modal styles, tooltip styles |
| `src/components/visualizer/TaskNode.tsx` | Single glowing sphere: mesh + emissive material + point light, hover/click handlers, pulse animation for running state |
| `src/components/visualizer/TaskConnection.tsx` | Energy beam between two 3D positions, colored by node states |
| `src/components/visualizer/TaskTooltip.tsx` | Html overlay showing task name, status, stats on hover |
| `src/components/visualizer/TaskDetailModal.tsx` | Bottom modal with task header + event stream rows |
| `src/components/visualizer/CameraController.tsx` | Auto-orbit logic + smooth fly-to-node on selection |

---

## Data Flow

### Props to AgentVisualizer
```typescript
interface AgentVisualizerProps {
  todos: TodoItem[];
  runs: PersistedRun[];
  onClose: () => void;
}
```

### Node Position Calculation
Nodes are positioned along the X axis with sinusoidal Y/Z offsets:
```
x = index * 4
y = sin(index * 0.8) * 1.2
z = cos(index * 1.1) * 0.8
```

### Matching Todos to Runs
Runs are matched to todos by index in the `runs` array. The Nth completed todo corresponds to the Nth run (when runs were executed in todo auto-play order). If a run doesn't exist for a todo, the node has no event stream data.

---

## State Colors

| State | Sphere Color | Emissive | Point Light | Glow Intensity |
|-------|-------------|----------|-------------|----------------|
| Completed | #6366f1 | #818cf8 | #818cf8 | 0.8 |
| Running | #059669 | #34d399 | #34d399 | 1.2 (pulsing) |
| Pending | #334155 | #475569 | none | 0.2 |

---

## Files NOT Modified

- `src/App.tsx` — only adds state for visualizer open/closed and renders `<AgentVisualizer>` conditionally
- `src/components/TodoPanel.tsx` — only adds the "Visualize" button that calls a prop
- No backend changes

---

## Performance Notes

- Stars use `@react-three/drei`'s instanced `Stars` component (GPU-efficient)
- Node count is bounded by todo list size (typically 5-20), so no performance concerns
- Point lights per node are acceptable at this scale
- Modal event stream only renders when a node is selected (lazy)
