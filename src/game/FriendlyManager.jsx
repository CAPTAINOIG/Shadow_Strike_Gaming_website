// Shadow Strike: Last Stand - friendly fire team following the player.
import React, { useMemo } from 'react';
import AISoldier from './ai/AISoldier';
import { useGameStore, GAME_STATES } from '../store/gameStore';
import { FRIENDLY_SPAWN_OFFSETS } from '../data/enemies';
import { DEFAULT_FRIENDLY_WEAPON } from '../data/weapons';
import { PLAYER_SPAWN } from '../data/battlefieldLayout';

const SQUAD_NAMES = ['SGT. REYES', 'CPL. HALE', 'PFC. OKAFOR'];
const SQUAD_STATS = { health: 240, speed: 3.6, detectionRange: 60, attackRange: 50, accuracy: 0.5, reaction: 0.7, burst: [3, 5], aggression: 0 };

export default function FriendlyManager() {
  const gameState = useGameStore((s) => s.gameState);
  const runId = useGameStore((s) => s.runId);

  const squad = useMemo(() => FRIENDLY_SPAWN_OFFSETS.map((offset, i) => ({
    id: `friendly_${runId}_${i}`,
    team: 'friendly',
    stats: { ...SQUAD_STATS, name: SQUAD_NAMES[i] },
    spawn: { x: PLAYER_SPAWN.x + offset.x, z: PLAYER_SPAWN.z + offset.z, yaw: 0 },
    followSlot: [offset.x, offset.z],
    weapon: { ...DEFAULT_FRIENDLY_WEAPON, model: 'assault_rifle', sound: 'rifle', reloadTime: 2.4 },
  })), [runId]);

  const onKilled = useMemo(() => () => useGameStore.getState().friendlyDied(), []);

  if (gameState !== GAME_STATES.PLAYING && gameState !== GAME_STATES.PAUSED && gameState !== GAME_STATES.GAME_OVER) return null;
  return <group>{squad.map((config) => <AISoldier key={config.id} config={config} onKilled={onKilled} />)}</group>;
}
