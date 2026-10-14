// Shadow Strike: Last Stand - drives the pooled effects system each frame.
import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { fx } from '../systems/fx';
import { combatSystem } from '../systems/combatSystem';
import { useGameStore, GAME_STATES } from '../store/gameStore';

export default function Effects() {
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    fx.init(scene);
    return () => fx.dispose();
  }, [scene]);

  // Runs before the controllers so hitboxes are refreshed once per frame.
  useFrame(() => combatSystem.beginFrame(), -1);

  useFrame(({ camera }, delta) => {
    if (useGameStore.getState().gameState === GAME_STATES.PAUSED) return;
    // Point-sprite size: pixels per world unit at distance 1.
    fx.setViewportHeight(gl.domElement.height / Math.tan(THREE_DEG * camera.fov * 0.5));
    fx.update(Math.min(delta, 0.05), camera);
  });
  return null;
}

const THREE_DEG = Math.PI / 180;
