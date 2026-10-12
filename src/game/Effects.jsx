// Shadow Strike: Last Stand - Visual Effects (Tracers, Impacts, Muzzle Flashes)
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore, GAME_STATES } from '../store/gameStore';

// Enhanced tracer line effect
function TracerEffect({ from, to }) {
  const lineRef = useRef();
  const opacity = useRef(0.8);

  useFrame(() => {
    if (lineRef.current && lineRef.current.material) {
      opacity.current *= 0.95;
      lineRef.current.material.opacity = opacity.current;
    }
  });

  const geometry = useMemo(() => {
    const points = [
      new THREE.Vector3(from.x, from.y, from.z),
      new THREE.Vector3(to.x, to.y, to.z),
    ];
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [from, to]);

  return (
    <line ref={lineRef} geometry={geometry}>
      <lineBasicMaterial color="#ffdd55" transparent opacity={0.8} linewidth={3} />
    </line>
  );
}

// Enhanced impact effect with better particles
function ImpactEffect({ position }) {
  const groupRef = useRef();
  const sparkRefs = useRef([]);
  const [sparkPositions, setSparkPositions] = useState(() => {
    return Array.from({ length: 8 }, () => ({
      x: (Math.random() - 0.5) * 0.4,
      y: (Math.random() - 0.5) * 0.3,
      z: (Math.random() - 0.5) * 0.4,
      vx: (Math.random() - 0.5) * 0.5,
      vy: Math.random() * 0.3,
      vz: (Math.random() - 0.5) * 0.5,
      life: 1,
    }));
  });

  useFrame(() => {
    if (groupRef.current) {
      setSparkPositions((prev) =>
        prev.map((spark) => ({
          ...spark,
          x: spark.x + spark.vx * 0.016,
          y: spark.y + spark.vy * 0.016 - 0.1 * 0.016,
          z: spark.z + spark.vz * 0.016,
          vy: spark.vy - 0.15,
          life: spark.life - 0.02,
        }))
      );
    }
  });

  return (
    <group ref={groupRef} position={[position.x, position.y || 1, position.z]}>
      {/* Central glow */}
      <mesh>
        <sphereGeometry args={[0.15, 6, 4]} />
        <meshBasicMaterial color="#ffaa33" transparent opacity={0.6} />
      </mesh>
      
      {/* Bright light */}
      <pointLight color="#ffaa22" intensity={6} distance={4} decay={2} />
      
      {/* Animated spark particles */}
      {sparkPositions.map((spark, i) => (
        spark.life > 0 && (
          <mesh
            key={i}
            position={[spark.x, spark.y, spark.z]}
            ref={(el) => (sparkRefs.current[i] = el)}
          >
            <boxGeometry args={[0.02, 0.02, 0.02]} />
            <meshBasicMaterial
              color="#ffdd66"
              transparent
              opacity={Math.max(0, spark.life * 0.8)}
            />
          </mesh>
        )
      ))}
    </group>
  );
}

export default function Effects() {
  const effects = useGameStore((s) => s.effects);
  const gameState = useGameStore((s) => s.gameState);

  if (gameState !== GAME_STATES.PLAYING && gameState !== GAME_STATES.PAUSED) return null;

  return (
    <group>
      {effects.map((effect) => {
        if (effect.type === 'tracer' && effect.from && effect.to) {
          return <TracerEffect key={effect.id} from={effect.from} to={effect.to} />;
        }
        if (effect.type === 'impact' && effect.position) {
          return <ImpactEffect key={effect.id} position={effect.position} />;
        }
        return null;
      })}
    </group>
  );
}
