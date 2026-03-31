import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { Mesh, Group } from "three";

export type VisualMode = "orbital" | "tactical" | "circuit";

interface TaskNodeProps {
  position: [number, number, number];
  state: "completed" | "running" | "pending";
  index: number;
  label?: string;
  toolCalls?: number;
  durationMs?: number;
  mode?: VisualMode;
  onPointerOver: () => void;
  onPointerOut: () => void;
  onClick: () => void;
}

const STATE_COLORS = {
  completed: { main: "#6366f1", emissive: "#818cf8", light: "#818cf8" },
  running: { main: "#059669", emissive: "#34d399", light: "#34d399" },
  pending: { main: "#334155", emissive: "#475569", light: "#475569" },
};

// ─── Orbital Rings Mode ───────────────────────────────────────────

function OrbitalNode({ state, onPointerOver, onPointerOut, onClick }: Omit<TaskNodeProps, "position" | "index" | "mode">) {
  const groupRef = useRef<Group>(null);
  const coreRef = useRef<Mesh>(null);
  const particleRef = useRef<Mesh>(null);
  const colors = STATE_COLORS[state];

  const coreRadius = state === "running" ? 0.2 : state === "completed" ? 0.18 : 0.12;
  const ringRadius = state === "running" ? 0.7 : state === "completed" ? 0.6 : 0.45;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (coreRef.current && state === "running") {
      const scale = 1 + Math.sin(t * 2) * 0.3;
      coreRef.current.scale.setScalar(scale);
    }
    if (particleRef.current && state !== "pending") {
      const angle = t * (state === "running" ? 2 : 0.8);
      particleRef.current.position.x = Math.cos(angle) * ringRadius;
      particleRef.current.position.z = Math.sin(angle) * ringRadius;
    }
  });

  return (
    <group
      ref={groupRef}
      onPointerOver={(e) => { e.stopPropagation(); onPointerOver(); }}
      onPointerOut={onPointerOut}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      {/* Core sphere */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[coreRadius, 24, 24]} />
        <meshStandardMaterial
          color={colors.main}
          emissive={colors.emissive}
          emissiveIntensity={state === "running" ? 2 : 1}
          transparent={state === "pending"}
          opacity={state === "pending" ? 0.4 : 1}
        />
      </mesh>

      {/* Inner ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[ringRadius * 0.65, 0.015, 8, 48]} />
        <meshStandardMaterial
          color={colors.emissive}
          emissive={colors.emissive}
          emissiveIntensity={0.5}
          transparent
          opacity={state === "pending" ? 0.15 : 0.4}
        />
      </mesh>

      {/* Outer ring */}
      <mesh rotation={[Math.PI / 2, 0, 0.3]}>
        <torusGeometry args={[ringRadius, state === "pending" ? 0.008 : 0.012, 8, 48]} />
        <meshStandardMaterial
          color={colors.emissive}
          emissive={colors.emissive}
          emissiveIntensity={0.3}
          transparent
          opacity={state === "pending" ? 0.1 : 0.3}
        />
      </mesh>

      {/* Orbiting particle (not for pending) */}
      {state !== "pending" && (
        <mesh ref={particleRef}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshBasicMaterial color={colors.light} />
        </mesh>
      )}

      <pointLight
        color={colors.light}
        intensity={state === "running" ? 4 : state === "completed" ? 2 : 0.5}
        distance={6}
      />
    </group>
  );
}

// ─── Tactical HUD Mode ────────────────────────────────────────────

function TacticalNode({ state, index, label, toolCalls, durationMs, onPointerOver, onPointerOut, onClick }: Omit<TaskNodeProps, "position" | "mode">) {
  const groupRef = useRef<Group>(null);
  const colors = STATE_COLORS[state];
  const statusLabel = state === "completed" ? "COMPLETE" : state === "running" ? "ACTIVE" : "QUEUED";

  const size = state === "running" ? 0.7 : state === "completed" ? 0.6 : 0.5;

  useFrame(({ clock }) => {
    if (groupRef.current && state === "running") {
      const scale = 1 + Math.sin(clock.getElapsedTime() * 2) * 0.15;
      groupRef.current.scale.setScalar(scale);
    }
  });

  // Hexagonal shape via 6-sided cylinder
  return (
    <group
      ref={groupRef}
      onPointerOver={(e) => { e.stopPropagation(); onPointerOver(); }}
      onPointerOut={onPointerOut}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[size, size, 0.12, 6]} />
        <meshStandardMaterial
          color={colors.main}
          emissive={colors.emissive}
          emissiveIntensity={state === "running" ? 1.5 : 0.6}
          transparent
          opacity={state === "pending" ? 0.3 : 0.8}
        />
      </mesh>

      {/* Border ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[size, 0.02, 6, 6]} />
        <meshStandardMaterial
          color={colors.emissive}
          emissive={colors.emissive}
          emissiveIntensity={0.8}
          transparent
          opacity={state === "pending" ? 0.2 : 0.6}
        />
      </mesh>

      {/* HUD label */}
      <Html center position={[0, 0, 0]} style={{ pointerEvents: "none" }}>
        <div style={{
          textAlign: "center",
          fontFamily: "var(--vp-font-family-mono, monospace)",
          userSelect: "none",
        }}>
          <div style={{ fontSize: "16px", fontWeight: 700, color: colors.emissive }}>
            {String(index + 1).padStart(2, "0")}
          </div>
        </div>
      </Html>

      {/* Status label above */}
      <Html center position={[0, size + 0.35, 0]} style={{ pointerEvents: "none" }}>
        <div style={{
          fontSize: "8px",
          fontFamily: "var(--vp-font-family-mono, monospace)",
          color: colors.emissive,
          letterSpacing: "0.1em",
          whiteSpace: "nowrap",
          userSelect: "none",
          opacity: state === "pending" ? 0.4 : 0.8,
        }}>
          {statusLabel}
        </div>
      </Html>

      {/* Data readout below */}
      <Html center position={[0, -(size + 0.35), 0]} style={{ pointerEvents: "none" }}>
        <div style={{
          fontSize: "7px",
          fontFamily: "var(--vp-font-family-mono, monospace)",
          color: "rgba(255,255,255,0.3)",
          whiteSpace: "nowrap",
          userSelect: "none",
          textAlign: "center",
        }}>
          {label && <div style={{ marginBottom: "2px", color: state === "pending" ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.5)", fontSize: "7px", maxWidth: "80px", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>}
          {(toolCalls || durationMs) && state !== "pending" && (
            <div>{toolCalls ? `${toolCalls} tools` : ""}{toolCalls && durationMs ? " · " : ""}{durationMs ? `${(durationMs / 1000).toFixed(1)}s` : ""}</div>
          )}
        </div>
      </Html>

      <pointLight
        color={colors.light}
        intensity={state === "running" ? 3 : state === "completed" ? 1.5 : 0.3}
        distance={5}
      />
    </group>
  );
}

// ─── Circuit Board Mode ───────────────────────────────────────────

function CircuitNode({ state, index, label, toolCalls, durationMs, onPointerOver, onPointerOut, onClick }: Omit<TaskNodeProps, "position" | "mode">) {
  const groupRef = useRef<Group>(null);
  const colors = STATE_COLORS[state];

  const width = state === "running" ? 1.8 : 1.5;
  const height = state === "running" ? 1.2 : 1.0;

  useFrame(({ clock }) => {
    if (groupRef.current && state === "running") {
      const scale = 1 + Math.sin(clock.getElapsedTime() * 2) * 0.08;
      groupRef.current.scale.setScalar(scale);
    }
  });

  const displayLabel = label
    ? (label.length > 18 ? label.slice(0, 18) + "..." : label)
    : `Step ${index + 1}`;

  return (
    <group
      ref={groupRef}
      onPointerOver={(e) => { e.stopPropagation(); onPointerOver(); }}
      onPointerOut={onPointerOut}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      {/* Card body */}
      <mesh>
        <boxGeometry args={[width, height, 0.08]} />
        <meshStandardMaterial
          color={state === "pending" ? "#1a1a2e" : "#0f0f1a"}
          emissive={colors.emissive}
          emissiveIntensity={state === "running" ? 0.15 : 0.05}
          transparent
          opacity={state === "pending" ? 0.4 : 0.9}
        />
      </mesh>

      {/* Border */}
      <mesh>
        <boxGeometry args={[width + 0.04, height + 0.04, 0.06]} />
        <meshStandardMaterial
          color={colors.main}
          emissive={colors.emissive}
          emissiveIntensity={0.4}
          transparent
          opacity={state === "pending" ? 0.15 : 0.4}
          wireframe
        />
      </mesh>

      {/* Connection pins */}
      {/* Left pin */}
      <mesh position={[-(width / 2 + 0.1), 0, 0]}>
        <boxGeometry args={[0.12, 0.12, 0.08]} />
        <meshStandardMaterial
          color={colors.emissive}
          emissive={colors.emissive}
          emissiveIntensity={0.6}
          transparent
          opacity={state === "pending" ? 0.2 : 0.7}
        />
      </mesh>
      {/* Right pin */}
      <mesh position={[width / 2 + 0.1, 0, 0]}>
        <boxGeometry args={[0.12, 0.12, 0.08]} />
        <meshStandardMaterial
          color={colors.emissive}
          emissive={colors.emissive}
          emissiveIntensity={0.6}
          transparent
          opacity={state === "pending" ? 0.2 : 0.7}
        />
      </mesh>

      {/* Status LED */}
      {state === "running" && (
        <mesh position={[width / 2 - 0.2, height / 2 - 0.15, 0.05]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshBasicMaterial color={colors.light} />
        </mesh>
      )}

      {/* Text labels */}
      <Html center position={[0, 0.05, 0.06]} style={{ pointerEvents: "none" }}>
        <div style={{
          textAlign: "center",
          fontFamily: "var(--vp-font-family-mono, monospace)",
          userSelect: "none",
          width: `${width * 50}px`,
        }}>
          <div style={{ fontSize: "9px", fontWeight: 600, color: colors.emissive, opacity: state === "pending" ? 0.4 : 0.8 }}>
            {String(index + 1).padStart(2, "0")}
          </div>
          <div style={{
            fontSize: "8px",
            color: state === "pending" ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.7)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            marginTop: "2px",
          }}>
            {displayLabel}
          </div>
          {state !== "pending" && (toolCalls || durationMs) && (
            <div style={{ fontSize: "7px", color: "rgba(255,255,255,0.25)", marginTop: "3px" }}>
              {toolCalls ? `${toolCalls} tools` : ""}{toolCalls && durationMs ? " · " : ""}{durationMs ? `${(durationMs / 1000).toFixed(1)}s` : ""}
            </div>
          )}
        </div>
      </Html>

      <pointLight
        color={colors.light}
        intensity={state === "running" ? 2 : state === "completed" ? 1 : 0.2}
        distance={4}
      />
    </group>
  );
}

// ─── Main Export ──────────────────────────────────────────────────

export function TaskNode({ position, mode = "orbital", ...props }: TaskNodeProps) {
  return (
    <group position={position}>
      {mode === "orbital" && <OrbitalNode {...props} />}
      {mode === "tactical" && <TacticalNode {...props} />}
      {mode === "circuit" && <CircuitNode {...props} />}
    </group>
  );
}
