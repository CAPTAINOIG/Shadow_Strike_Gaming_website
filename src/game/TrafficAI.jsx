import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { VehicleActor } from './VehicleSystem';
import { useGameStore } from '../store/gameStore';

const traffic = new Map();

export default function TrafficAI() {
  const cx = useGameStore((s) => Math.floor(s.playerPosition.x / 100));
  const cz = useGameStore((s) => Math.floor(s.playerPosition.z / 100));
  const isShooting = useGameStore((s) => s.isShooting);
  const reportAssetError = useGameStore((s) => s.reportAssetError);
  const laneCars = useMemo(() => {
    const result = [];
    for (let z = cz - 1; z <= cz + 1; z++) for (let x = cx - 1; x <= cx + 1; x++) {
      const bx = x * 100; const bz = z * 100;
      result.push({ id: `traffic-n-${x}-${z}`, type: 'sedan', position: [bx + 45.8, 0, bz + 8], yaw: Math.PI, route: 'north', chunkZ: z, chunkX: x });
      result.push({ id: `traffic-s-${x}-${z}`, type: 'sedan', position: [bx + 54.2, 0, bz + 92], yaw: 0, route: 'south', chunkZ: z, chunkX: x });
    }
    return result;
  }, [cx, cz]);
  const register = useMemo(() => (id, entry) => { if (entry) traffic.set(id, entry); else traffic.delete(id); }, []);
  const speed = useRef(new Map());
  const fleeingUntil = useRef(new Map());

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const now = performance.now();
    const player = useGameStore.getState().playerPosition;
    traffic.forEach(({ ref, data }, id) => {
      const car = ref.current;
      if (!car) return;
      if (useGameStore.getState().activeVehicleId === id) return;
      let velocity = speed.current.get(id) || 5.5;
      const distanceToPlayer = Math.hypot(car.position.x - player.x, car.position.z - player.z);
      if (isShooting && distanceToPlayer < 28) fleeingUntil.current.set(id, now + 5500);
      const fleeing = (fleeingUntil.current.get(id) || 0) > now;
      if (fleeing) velocity = THREE.MathUtils.damp(velocity, 13, 1.6, dt);
      else velocity = THREE.MathUtils.damp(velocity, 6.2, 1.7, dt);

      // Two-phase intersection signal: stop at red before the crossing.
      const localZ = car.position.z - data.chunkZ * 100;
      const green = Math.floor(now / 5500 + data.chunkX) % 2 === 0;
      const approaching = data.route === 'north' ? localZ > 42 && localZ < 51 : localZ < 58 && localZ > 49;
      if (approaching && !green && !fleeing) velocity = THREE.MathUtils.damp(velocity, 0, 5, dt);

      let blocked = false;
      traffic.forEach((other, otherId) => {
        if (otherId === id || !other.ref.current) return;
        const d = car.position.distanceTo(other.ref.current.position);
        if (d < 4.2 && d > 0.01) blocked = true;
      });
      if (blocked) velocity = Math.min(velocity, 1.2);
      speed.current.set(id, velocity);

      const direction = data.route === 'north' ? 1 : -1;
      const fleeDirection = car.position.z < player.z ? -1 : 1;
      const move = fleeing ? fleeDirection : direction;
      car.position.z += move * velocity * dt;
      if (car.position.z > data.chunkZ * 100 + 99) car.position.z = data.chunkZ * 100 + 1;
      if (car.position.z < data.chunkZ * 100 + 1) car.position.z = data.chunkZ * 100 + 99;
      car.rotation.y = move > 0 ? Math.PI : 0;
    });
  });

  return <>{laneCars.map((data) => <VehicleActor key={data.id} data={data} register={register} reportAssetError={reportAssetError} />)}</>;
}
