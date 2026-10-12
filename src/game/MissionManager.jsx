// Shadow Strike: Last Stand - Mission Manager
// Tracks mission objectives state (runs as a silent component)
import { useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore, GAME_STATES } from '../store/gameStore';
import { combatSystem } from '../systems/combatSystem';

export default function MissionManager() {
  const gameState = useGameStore((s) => s.gameState);

  useFrame(() => {
    if (gameState !== GAME_STATES.PLAYING) return;

    // Sync counts from combat system periodically
    const store = useGameStore.getState();
    const enemyCount = combatSystem.getEnemyCount();
    const friendlyCount = combatSystem.getFriendlyCount();

    if (enemyCount !== store.enemiesAlive) {
      useGameStore.setState({ enemiesAlive: enemyCount });
    }
    if (friendlyCount !== store.friendliesAlive) {
      useGameStore.setState({ friendliesAlive: friendlyCount });
    }
  });

  return null;
}
