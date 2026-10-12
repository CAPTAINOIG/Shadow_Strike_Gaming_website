import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import CharacterModel from './CharacterModel';
import { VehicleActor } from './VehicleSystem';
import { combatSystem } from '../systems/combatSystem';
import { useGameStore } from '../store/gameStore';

function Officer({ id, start, aggression }) {
  const ref = useRef();
  const cooldown = useRef(0);
  const [state, setState] = useState('running');
  useEffect(() => {
    combatSystem.register(id, { team: 'police', x: start[0], y: 0, z: start[2], health: 120 + aggression * 20 });
    return () => combatSystem.unregister(id);
  }, [id, start, aggression]);
  useFrame((_, delta) => {
    if (!ref.current) return;
    const unit = combatSystem.get(id);
    if (!unit?.alive) { if (state !== 'dead') setState('dead'); return; }
    const player = useGameStore.getState().playerPosition;
    const dx = player.x - ref.current.position.x; const dz = player.z - ref.current.position.z;
    const distance = Math.hypot(dx, dz);
    ref.current.rotation.y = Math.atan2(-dx, -dz);
    if (distance > 5.5) {
      ref.current.position.x += dx / Math.max(distance, 0.001) * (2.2 + aggression * 0.32) * delta;
      ref.current.position.z += dz / Math.max(distance, 0.001) * (2.2 + aggression * 0.32) * delta;
    }
    combatSystem.update(id, { position: ref.current.position });
    const nextState = distance < 17 ? 'shooting' : 'running';
    if (state !== nextState) setState(nextState);
    cooldown.current -= delta;
    if (distance < 15 && cooldown.current <= 0) {
      cooldown.current = Math.max(0.45, 1.35 - aggression * 0.12);
      useGameStore.getState().damagePlayer(3 + aggression * 1.1);
    }
  });
  return <group ref={ref} position={start} userData={{ policeOfficer: true }}><CharacterModel team="enemy" state={state} /></group>;
}

export default function WantedSystem() {
  const level = useGameStore((s) => s.wantedLevel);
  const cx = useGameStore((s) => Math.floor(s.playerPosition.x / 100));
  const cz = useGameStore((s) => Math.floor(s.playerPosition.z / 100));
  const reportAssetError = useGameStore((s) => s.reportAssetError);
  const carsRef = useRef(new Map());
  const cars = useMemo(() => {
    const player = useGameStore.getState().playerPosition;
    const result = [];
    const count = level >= 3 ? 2 : level > 0 ? 1 : 0;
    for (let i = 0; i < count; i++) {
      const side = i === 0 ? -1 : 1;
      result.push({ id: `police-car-${cx}-${cz}-${i}`, type: 'police', position: [player.x + side * 30, 0, player.z + (i === 0 ? -30 : 30)], yaw: 0 });
    }
    return result;
  }, [level, cx, cz]);
  const register = useMemo(() => (id, item) => { if (item) carsRef.current.set(id, item); else carsRef.current.delete(id); }, []);
  const officers = useMemo(() => {
    const player = useGameStore.getState().playerPosition;
    return Array.from({ length: level ? Math.min(10, level * 2) : 0 }, (_, index) => {
      const angle = (index / Math.max(1, level * 2)) * Math.PI * 2;
      const radius = 24 + (index % 3) * 3;
      return { id: `police-officer-${cx}-${cz}-${level}-${index}`, aggression: level, start: [player.x + Math.cos(angle) * radius, 0, player.z + Math.sin(angle) * radius] };
    });
  }, [level, cx, cz]);

  useFrame((_, delta) => {
    if (!level) return;
    const target = useGameStore.getState().playerPosition;
    carsRef.current.forEach(({ ref }) => {
      const car = ref.current;
      if (!car) return;
      const dx = target.x - car.position.x; const dz = target.z - car.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance > 8) {
        car.rotation.y = Math.atan2(-dx, -dz);
        car.position.x += dx / distance * (5 + level) * delta;
        car.position.z += dz / distance * (5 + level) * delta;
      }
    });
  });

  return <>
    {officers.map((officer) => <Officer key={officer.id} {...officer} />)}
    {cars.map((car) => <VehicleActor key={car.id} data={car} register={register} reportAssetError={reportAssetError} />)}
  </>;
}
