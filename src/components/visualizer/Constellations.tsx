import { useMemo } from "react";
import * as THREE from "three";

interface ConstellationsProps {
  count?: number;
  radius?: number;
}

/** Generate random constellation lines in the background starfield. */
export function Constellations({ count = 12, radius = 80 }: ConstellationsProps) {
  const lines = useMemo(() => {
    const result: { points: THREE.Vector3[]; opacity: number }[] = [];
    // Generate random star positions on a sphere
    const starPoints: THREE.Vector3[] = [];
    for (let i = 0; i < count * 8; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = radius * (0.7 + Math.random() * 0.3);
      starPoints.push(new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi),
      ));
    }

    // Form constellations by connecting nearby stars
    const used = new Set<number>();
    for (let c = 0; c < count; c++) {
      const startIdx = Math.floor(Math.random() * starPoints.length);
      if (used.has(startIdx)) continue;
      used.add(startIdx);

      const constellation: THREE.Vector3[] = [starPoints[startIdx]];
      let current = starPoints[startIdx];

      // Add 2-4 connected stars
      const segCount = 2 + Math.floor(Math.random() * 3);
      for (let s = 0; s < segCount; s++) {
        let bestIdx = -1;
        let bestDist = Infinity;
        for (let j = 0; j < starPoints.length; j++) {
          if (used.has(j)) continue;
          const d = current.distanceTo(starPoints[j]);
          if (d < bestDist && d > 3 && d < 25) {
            bestDist = d;
            bestIdx = j;
          }
        }
        if (bestIdx === -1) break;
        used.add(bestIdx);
        constellation.push(starPoints[bestIdx]);
        current = starPoints[bestIdx];
      }

      if (constellation.length >= 2) {
        result.push({ points: constellation, opacity: 0.08 + Math.random() * 0.1 });
      }
    }
    return result;
  }, [count, radius]);

  return (
    <group>
      {lines.map((constellation, i) => {
        return (
          <lineSegments key={i}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                array={new Float32Array(constellation.points.flatMap((p) => [p.x, p.y, p.z]))}
                count={constellation.points.length}
                itemSize={3}
              />
              <bufferAttribute
                attach="index"
                array={new Uint16Array(
                  constellation.points.flatMap((_, j) =>
                    j < constellation.points.length - 1 ? [j, j + 1] : []
                  )
                )}
                count={(constellation.points.length - 1) * 2}
                itemSize={1}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#8888cc" transparent opacity={constellation.opacity} />
          </lineSegments>
        );
      })}
      {/* Faint dots at constellation vertices */}
      {lines.flatMap((c, ci) =>
        c.points.map((p, pi) => (
          <mesh key={`star-${ci}-${pi}`} position={p}>
            <sphereGeometry args={[0.15, 8, 8]} />
            <meshBasicMaterial color="#aaaadd" transparent opacity={0.2} />
          </mesh>
        ))
      )}
    </group>
  );
}
