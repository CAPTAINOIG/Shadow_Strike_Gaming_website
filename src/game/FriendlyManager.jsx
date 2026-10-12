// Shadow Strike: Last Stand - Friendly Squad Manager
import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import CharacterModel, { CharacterHealthBar } from './CharacterModel';
import { useGameStore, GAME_STATES } from '../store/gameStore';
import { combatSystem } from '../systems/combatSystem';
import { audioManager } from '../systems/audioManager';
import { FRIENDLY_SPAWN_OFFSETS } from '../data/enemies';
import { DEFAULT_FRIENDLY_WEAPON } from '../data/weapons';

const FOLLOW_DISTANCE = 5;
const MAX_FOLLOW_DISTANCE = 15;
const FRIENDLY_HEALTH = 240;

// Individual Friendly AI
function FriendlySoldier({ id, offsetX, offsetZ, index }) {
  const groupRef = useRef();
  const posRef = useRef(new THREE.Vector3(offsetX, 0, 5 + offsetZ));
  const rotRef = useRef(0);
  const stateRef = useRef('follow'); // follow, attack, dead
  const healthRef = useRef(FRIENDLY_HEALTH);
  const walkCycleRef = useRef(Math.random() * 10);
  const lastShotRef = useRef(0);
  const hitUntilRef = useRef(0);
  const targetRef = useRef(null);
  const detectionTimerRef = useRef(index * 0.1); // stagger detection

  const [visualState, setVisualState] = useState('idle');
  const [showFlash, setShowFlash] = useState(false);
  const [currentHealth, setCurrentHealth] = useState(FRIENDLY_HEALTH);
  const [alive, setAlive] = useState(true);

  const gameState = useGameStore((s) => s.gameState);
  const addEffect = useGameStore((s) => s.addEffect);
  const friendlyDied = useGameStore((s) => s.friendlyDied);
  const addKill = useGameStore((s) => s.addKill);

  // Register in combat system
  useEffect(() => {
    combatSystem.register(id, {
      team: 'friendly',
      x: offsetX, y: 0, z: 5 + offsetZ,
      health: FRIENDLY_HEALTH,
    });
    return () => combatSystem.unregister(id);
  }, [id, offsetX, offsetZ]);

  useFrame((_, delta) => {
    if (gameState !== GAME_STATES.PLAYING) return;
    if (!groupRef.current) return;
    if (!alive) return;

    const dt = Math.min(delta, 0.05);
    const pos = posRef.current;

    // Check health from combat system (in case enemies shot us)
    const self = combatSystem.get(id);
    if (self && self.health !== healthRef.current) {
      if (self.health < healthRef.current) hitUntilRef.current = Date.now() + 320;
      healthRef.current = self.health;
      setCurrentHealth(self.health);
      if (self.health <= 0) {
        stateRef.current = 'dead';
        setAlive(false);
        setVisualState('dead');
        combatSystem.update(id, { alive: false });
        friendlyDied();
        audioManager.playDeath(0.2);
        return;
      }
    }

    // Get player position
    const player = combatSystem.get('player');
    const playerPos = player ? player.position : new THREE.Vector3(0, 0, 5);

    // Detection check
    detectionTimerRef.current += dt;
    if (detectionTimerRef.current > 0.35) {
      detectionTimerRef.current = 0;
      const target = combatSystem.getNearestEnemy(pos, 'friendly', 40);
      if (target) {
        targetRef.current = target.soldier;
        if (target.distance <= 35) {
          stateRef.current = 'attack';
        }
      } else {
        targetRef.current = null;
        stateRef.current = 'follow';
      }
    }

    const currentState = stateRef.current;

    if (currentState === 'follow') {
      // Follow player with offset
      const followOffset = new THREE.Vector3(
        offsetX * 1.5,
        0,
        offsetZ * 1.5 + FOLLOW_DISTANCE
      );
      // Rotate offset by player direction
      const followTarget = playerPos.clone().add(followOffset);
      const toTarget = new THREE.Vector3().subVectors(followTarget, pos);
      toTarget.y = 0;
      const dist = toTarget.length();

      if (dist > 2) {
        toTarget.normalize();
        const moveSpeed = dist > MAX_FOLLOW_DISTANCE ? 8 : 4.5;
        pos.add(toTarget.multiplyScalar(moveSpeed * dt));
        rotRef.current = Math.atan2(-toTarget.x, -toTarget.z);
        walkCycleRef.current += dt * moveSpeed * 0.5;
        setVisualState('walking');
      } else {
        // Face same direction as player roughly
        setVisualState('idle');
      }
    } else if (currentState === 'attack') {
      if (targetRef.current && targetRef.current.alive) {
        const toTarget = new THREE.Vector3().subVectors(targetRef.current.position, pos);
        toTarget.y = 0;
        const dist = toTarget.length();

        // Rotate to face target
        const targetYaw = Math.atan2(-toTarget.x, -toTarget.z);
        rotRef.current = THREE.MathUtils.lerp(rotRef.current, targetYaw, 0.12);

        // Move closer if too far, but stop at comfortable attack range
        if (dist > 25) {
          const moveDir = toTarget.clone().normalize();
          pos.add(moveDir.multiplyScalar(4 * dt));
          walkCycleRef.current += dt * 4;
          setVisualState('walking');
        }

        // Fire weapon
        const now = Date.now();
        if (now - lastShotRef.current >= DEFAULT_FRIENDLY_WEAPON.fireRate * 4 * 1000) {
          lastShotRef.current = now;
          audioManager.playGunshot(0.15, pos, 'assault_rifle');
          setShowFlash(true);
          setTimeout(() => setShowFlash(false), 60);

          // Hit check
          if (combatSystem.checkHit(0.6, dist, 40)) {
            const target = targetRef.current;
            const newHp = target.health - DEFAULT_FRIENDLY_WEAPON.damage;
            combatSystem.update(target.id, { health: newHp });
            if (newHp <= 0) {
              combatSystem.update(target.id, { alive: false });
              addKill('SQUAD');
              audioManager.playDeath(0.15);
            }
          }

          // Tracer effect
          const muzzlePos = pos.clone();
          muzzlePos.y = 0.95;
          const forward = new THREE.Vector3(-Math.sin(rotRef.current), 0, -Math.cos(rotRef.current));
          muzzlePos.add(forward.clone().multiplyScalar(0.6));
          addEffect({
            type: 'tracer',
            from: muzzlePos,
            to: targetRef.current.position.clone().setY(1),
            lifetime: 80,
          });
          setVisualState('shooting');
        } else {
          if (dist <= 25) setVisualState('aiming');
        }

        // If target died, go back to follow
        if (!targetRef.current.alive) {
          stateRef.current = 'follow';
          targetRef.current = null;
        }
      } else {
        stateRef.current = 'follow';
        targetRef.current = null;
      }
    }

    // Stay near player (don't wander too far)
    const distToPlayer = pos.distanceTo(playerPos);
    if (distToPlayer > MAX_FOLLOW_DISTANCE && currentState !== 'attack') {
      stateRef.current = 'follow';
    }

    // Clamp to play area
    pos.x = THREE.MathUtils.clamp(pos.x, -45, 45);
    pos.z = THREE.MathUtils.clamp(pos.z, -85, 15);
    pos.y = 0;

    // Update position
    combatSystem.update(id, { position: pos });
    groupRef.current.position.copy(pos);
    groupRef.current.rotation.y = rotRef.current;
    if (Date.now() < hitUntilRef.current) setVisualState('hit');
  });

  if (gameState !== GAME_STATES.PLAYING && gameState !== GAME_STATES.PAUSED) return null;

  return (
    <group ref={groupRef} position={[offsetX, 0, 5 + offsetZ]}>
      <CharacterModel
        team="friendly"
        state={visualState}
        gender="male"
        walkCycle={walkCycleRef.current}
        showWeaponFlash={showFlash}
      />
      <CharacterHealthBar
        health={currentHealth}
        maxHealth={FRIENDLY_HEALTH}
        team="friendly"
        visible={alive}
      />
    </group>
  );
}

export default function FriendlyManager() {
  const gameState = useGameStore((s) => s.gameState);

  const friendlies = useMemo(() => {
    return FRIENDLY_SPAWN_OFFSETS.map((offset, i) => ({
      id: `friendly_${i}`,
      offsetX: offset.x,
      offsetZ: offset.z,
      index: i,
    }));
  }, []);

  if (gameState !== GAME_STATES.PLAYING && gameState !== GAME_STATES.PAUSED) return null;

  return (
    <group>
      {friendlies.map((f) => (
        <FriendlySoldier
          key={f.id}
          id={f.id}
          offsetX={f.offsetX}
          offsetZ={f.offsetZ}
          index={f.index}
        />
      ))}
    </group>
  );
}
