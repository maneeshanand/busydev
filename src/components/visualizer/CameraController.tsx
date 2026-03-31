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
