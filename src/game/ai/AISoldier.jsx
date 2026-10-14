// Shadow Strike: Last Stand - React wrapper around a SoldierBrain.
import React, { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import CharacterModel from '../CharacterModel';
import { SoldierBrain, getBrains } from './SoldierBrain';
import { combatSystem } from '../../systems/combatSystem';
import { audioManager } from '../../systems/audioManager';
import { loadSoldier } from '../soldierAssets';
import { useGameStore, GAME_STATES } from '../../store/gameStore';

export default function AISoldier({ config, onKilled }) {
  const groupRef = useRef();
  const modelRef = useRef();
  const brainRef = useRef(null);
  if (!brainRef.current) brainRef.current = new SoldierBrain(config);
  const onKilledRef = useRef(onKilled);
  onKilledRef.current = onKilled;

  useEffect(() => {
    const brain = brainRef.current;
    loadSoldier().then((asset) => { brain.grip = asset.grip; }).catch(() => {});
    const entry = combatSystem.register(config.id, {
      team: config.team,
      x: brain.pos.x, z: brain.pos.z,
      health: config.stats.health,
      name: config.stats.name,
      onDamage: (amount, info) => brain.onDamage(amount, info, performance.now() / 1000),
    });
    brain.onKilled = (info) => {
      entry.alive = false;
      entry.health = 0;
      onKilledRef.current?.(brain, info);
    };
    brain.onAlert = (position) => {
      // Radio call-out to nearby team-mates.
      const now = performance.now() / 1000;
      for (const other of getBrains().values()) {
        if (other !== brain && other.team === brain.team && other.pos.distanceTo(brain.pos) < 32) other.receiveCallout(position, now);
      }
    };
    const offNoise = combatSystem.onNoise((noise) => brain.hearNoise(noise, performance.now() / 1000));
    return () => { offNoise(); combatSystem.unregister(config.id); brain.dispose(); };
  }, [config]);

  useFrame((_, delta) => {
    if (useGameStore.getState().gameState !== GAME_STATES.PLAYING) return;
    const brain = brainRef.current;
    const handle = modelRef.current;
    const entry = combatSystem.get(config.id);
    if (entry && handle && entry.handle !== handle) entry.handle = handle;
    brain.update(Math.min(delta, 0.05), performance.now() / 1000, handle);
    if (entry) {
      entry.position.copy(brain.pos);
      entry.crouching = brain.crouch;
      entry.health = brain.health;
    }
    if (groupRef.current) {
      groupRef.current.position.copy(brain.pos);
      groupRef.current.rotation.y = brain.bodyYaw + Math.PI;
    }
  });

  return (
    <group ref={groupRef} position={[config.spawn.x, 0, config.spawn.z]}>
      <CharacterModel
        ref={modelRef}
        team={config.boss ? 'boss' : config.team}
        weapon={config.weapon.model}
        onStep={(speed) => audioManager.footstep(brainRef.current.pos, { speed })}
      />
    </group>
  );
}
