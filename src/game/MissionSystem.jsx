import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import CharacterModel from './CharacterModel';
import { combatSystem } from '../systems/combatSystem';
import { GAME_STATES, useGameStore } from '../store/gameStore';

const MISSIONS = [
  { id: 'drive', title: 'Night run', objective: 'Drive to the marked location', target: { x: 250, y: 0, z: 40 }, hint: 'F enter/exit vehicle · reach the gold marker' },
  { id: 'gang', title: 'Warehouse takeover', objective: 'Eliminate the gang at the warehouse', target: { x: 850, y: 0, z: 50 }, hint: 'Clear the warehouse district' },
  { id: 'escape', title: 'Lose the heat', objective: 'Escape the police pursuit', target: { x: -150, y: 0, z: 40 }, hint: 'Reach the marker to shake the patrols' },
];

function GangMember({ id, start }) {
  const ref = useRef(); const timer = useRef(0); const [state, setState] = useState('idle');
  useEffect(() => {
    combatSystem.register(id, { team: 'enemy', x: start[0], y: 0, z: start[2], health: 100 });
    return () => combatSystem.unregister(id);
  }, [id, start]);
  useFrame((_, delta) => {
    if (!ref.current) return;
    const unit = combatSystem.get(id);
    if (!unit?.alive) { if (state !== 'dead') setState('dead'); return; }
    const player = useGameStore.getState().playerPosition;
    const dx = player.x - ref.current.position.x; const dz = player.z - ref.current.position.z;
    const distance = Math.hypot(dx, dz);
    ref.current.rotation.y = Math.atan2(-dx, -dz);
    if (distance > 7 && distance < 52) {
      ref.current.position.x += dx / distance * 1.7 * delta;
      ref.current.position.z += dz / distance * 1.7 * delta;
    }
    combatSystem.update(id, { position: ref.current.position });
    const next = distance < 25 ? 'shooting' : distance < 52 ? 'running' : 'idle';
    if (state !== next) setState(next);
    timer.current -= delta;
    if (distance < 21 && timer.current <= 0) { timer.current = 1.25; useGameStore.getState().damagePlayer(5); }
  });
  return <group ref={ref} position={start}><CharacterModel team="enemy" state={state} /></group>;
}

export default function MissionSystem() {
  const gameState = useGameStore((s) => s.gameState);
  const mission = useGameStore((s) => s.openWorldMission);
  const setMission = useGameStore((s) => s.setOpenWorldMission);
  const setNotice = useGameStore((s) => s.setMissionNotice);
  const [missionIndex, setMissionIndex] = useState(0);
  const completing = useRef(false);

  useEffect(() => {
    if (gameState === GAME_STATES.PLAYING && !mission) {
      setMissionIndex(0); setMission({ ...MISSIONS[0], status: 'active' });
    }
  }, [gameState, mission, setMission]);
  useEffect(() => {
    const keyDown = (event) => {
      if (event.key.toLowerCase() !== 'm' || gameState !== GAME_STATES.PLAYING) return;
      const next = (missionIndex + 1) % MISSIONS.length;
      setMissionIndex(next); setNotice(''); completing.current = false;
      setMission({ ...MISSIONS[next], status: 'active' });
      if (MISSIONS[next].id === 'escape' && useGameStore.getState().wantedLevel === 0) useGameStore.getState().raiseWantedLevel(2);
    };
    window.addEventListener('keydown', keyDown);
    return () => window.removeEventListener('keydown', keyDown);
  }, [gameState, missionIndex, setMission, setNotice]);

  const gangs = useMemo(() => [
    { id: 'warehouse-gang-1', start: [838, 0, 42] },
    { id: 'warehouse-gang-2', start: [850, 0, 60] },
    { id: 'warehouse-gang-3', start: [864, 0, 46] },
  ], []);

  useFrame(() => {
    if (gameState !== GAME_STATES.PLAYING || !mission || mission.status !== 'active' || completing.current) return;
    const { playerPosition, inVehicle, wantedLevel } = useGameStore.getState();
    let complete = false;
    if (mission.id === 'drive') complete = inVehicle && Math.hypot(playerPosition.x - mission.target.x, playerPosition.z - mission.target.z) < 12;
    if (mission.id === 'gang') complete = gangs.every((gang) => combatSystem.get(gang.id)?.alive === false);
    if (mission.id === 'escape') complete = wantedLevel > 0 && Math.hypot(playerPosition.x - mission.target.x, playerPosition.z - mission.target.z) < 18;
    if (complete) {
      completing.current = true;
      setMission({ ...mission, status: 'complete' });
      setNotice(`JOB COMPLETE · ${mission.title}`);
      if (mission.id === 'escape') useGameStore.getState().clearWantedLevel();
      window.setTimeout(() => { setNotice(''); completing.current = false; }, 4500);
    }
  });

  return <>
    {mission?.id === 'gang' && gangs.map((gang) => <GangMember key={gang.id} {...gang} />)}
    {mission?.status === 'active' && <group position={[mission.target.x, 0, mission.target.z]}>
      <mesh position={[0, 7, 0]}><cylinderGeometry args={[0.18, 1.4, 14, 12, 1, true]} /><meshBasicMaterial color="#f3bf45" transparent opacity={0.24} side={THREE.DoubleSide} depthWrite={false} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}><ringGeometry args={[4.2, 5.4, 40]} /><meshBasicMaterial color="#ffd257" transparent opacity={0.95} side={THREE.DoubleSide} /></mesh>
      <pointLight position={[0, 5, 0]} color="#ffd257" intensity={10} distance={22} />
    </group>}
  </>;
}
