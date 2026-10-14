// Shadow Strike: Last Stand - hostile forces.
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import AISoldier from './ai/AISoldier';
import { getBrains } from './ai/SoldierBrain';
import { useGameStore, GAME_STATES } from '../store/gameStore';
import { ENEMY_TYPES, ENEMY_SPAWN_POSITIONS, BOSS_SPAWN } from '../data/enemies';
import { WEAPONS } from '../data/weapons';

export default function EnemyManager() {
  const gameState = useGameStore((s) => s.gameState);
  const runId = useGameStore((s) => s.runId);
  const lastAlertCheck = useRef(0);

  const enemies = useMemo(() => {
    const list = ENEMY_SPAWN_POSITIONS.map((spawn, i) => ({
      id: `enemy_${runId}_${i}`,
      team: 'enemy',
      stats: ENEMY_TYPES[spawn.type] || ENEMY_TYPES.GRUNT,
      spawn: { x: spawn.x, z: spawn.z, yaw: Math.PI * 0.1 * (i % 3 - 1) },
      patrol: spawn.patrol,
      weapon: WEAPONS.ENEMY_RIFLE,
    }));
    list.push({
      id: `enemy_${runId}_boss`, team: 'enemy', boss: true, stats: ENEMY_TYPES.BOSS,
      spawn: { x: BOSS_SPAWN.x, z: BOSS_SPAWN.z, yaw: 0 }, patrol: BOSS_SPAWN.patrol,
      weapon: { ...WEAPONS.ENEMY_RIFLE, damage: 11 },
    });
    return list;
  }, [runId]);

  const onKilled = useMemo(() => (brain, info = {}) => {
    const source = info.shooterId === 'player' ? 'YOU' : 'SQUAD';
    useGameStore.getState().addKill({ source, victim: brain.stats.name.toUpperCase(), headshot: Boolean(info.headshot), boss: brain.boss });
  }, []);

  // HUD threat level: 2 = engaged, 1 = enemies searching, 0 = undetected.
  useFrame(() => {
    const now = performance.now();
    if (now - lastAlertCheck.current < 250) return;
    lastAlertCheck.current = now;
    let level = 0;
    for (const brain of getBrains().values()) {
      if (brain.team !== 'enemy' || !brain.alive) continue;
      if (brain.state === 'combat') { level = 2; break; }
      if (brain.state === 'alert' || brain.state === 'search') level = 1;
    }
    useGameStore.getState().setAlertLevel(level);
  });

  if (gameState !== GAME_STATES.PLAYING && gameState !== GAME_STATES.PAUSED && gameState !== GAME_STATES.GAME_OVER) return null;
  return <group>{enemies.map((config) => <AISoldier key={config.id} config={config} onKilled={onKilled} />)}</group>;
}
