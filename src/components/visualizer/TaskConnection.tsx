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
    mid.y += 0.3;
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
