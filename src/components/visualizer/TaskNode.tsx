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
      // Pronounced breathing pulse: scale oscillates 0.7 → 1.3
      const t = clock.getElapsedTime();
      const scale = 1 + Math.sin(t * 2) * 0.3;
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
