import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import CharacterModel from './CharacterModel';
import { useGameStore } from '../store/gameStore';
import { combatSystem } from '../systems/combatSystem';

function Pedestrian({ id, startX, z, phase }) {
  const group = useRef();
  const isShooting = useGameStore((s) => s.isShooting);
  const [state, setState] = React.useState('walking');
  React.useEffect(() => {
    combatSystem.register(id, { team: 'civilian', x: startX, y: 0, z, health: 65 });
    return () => combatSystem.unregister(id);
  }, [id, startX, z]);
  useFrame((_, delta) => {
    if (!group.current) return;
    const civilian = combatSystem.get(id);
    if (!civilian?.alive) { if (state !== 'dead') setState('dead'); return; }
    const player = useGameStore.getState().playerPosition;
    const panic = isShooting && Math.hypot(group.current.position.x - player.x, group.current.position.z - player.z) < 65;
    const nextState = panic ? 'running' : 'walking';
    if (nextState !== state) setState(nextState);
    const direction = panic ? (group.current.position.x < player.x ? -1 : 1) : (Math.sin(phase + performance.now() * 0.00016) > 0 ? 1 : -1);
    group.current.position.x += direction * (panic ? 4.4 : 1.15) * Math.min(delta, 0.05);
    combatSystem.update(id, { position: group.current.position });
    const low = Math.floor(startX / 100) * 100 + 7;
    const high = low + 86;
    if (group.current.position.x < low) group.current.position.x = high;
    if (group.current.position.x > high) group.current.position.x = low;
    group.current.rotation.y = direction > 0 ? -Math.PI / 2 : Math.PI / 2;
  });
  return <group ref={group} position={[startX, 0, z]} userData={{ pedestrian: id }}>
    <CharacterModel team="friendly" state={state} />
  </group>;
}

export default function PedestrianAI() {
  const gameState = useGameStore((s) => s.gameState);
  const cx = useGameStore((s) => Math.floor(s.playerPosition.x / 100));
  const cz = useGameStore((s) => Math.floor(s.playerPosition.z / 100));
  const people = useMemo(() => {
    const result = [];
    for (let z = cz - 1; z <= cz + 1; z++) for (let x = cx - 1; x <= cx + 1; x++) {
      const baseX = x * 100; const baseZ = z * 100;
      result.push({ id: `ped-a-${x}-${z}`, startX: baseX + 12, z: baseZ + 38, phase: (x + z) * 0.75 });
      result.push({ id: `ped-b-${x}-${z}`, startX: baseX + 85, z: baseZ + 62, phase: (x - z) * 1.2 });
    }
    return result;
  }, [cx, cz]);
  if (gameState !== 'playing') return null;
  return <>{people.map((person) => <Pedestrian key={person.id} {...person} />)}</>;
}
