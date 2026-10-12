// Shadow Strike: Last Stand - Enemy Manager
import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import CharacterModel, { CharacterHealthBar } from './CharacterModel';
import { useGameStore, GAME_STATES } from '../store/gameStore';
import { combatSystem } from '../systems/combatSystem';
import { audioManager } from '../systems/audioManager';
import { ENEMY_TYPES, ENEMY_SPAWN_POSITIONS } from '../data/enemies';
import { DEFAULT_ENEMY_WEAPON } from '../data/weapons';
import { findNavPath } from '../systems/navMeshSystem';
import { findCoverSnap } from '../systems/coverSystem';

// Individual Enemy AI Component
function EnemySoldier({ id, spawnPos, enemyType }) {
  const groupRef = useRef();
  const posRef = useRef(new THREE.Vector3(spawnPos.x, 0, spawnPos.z));
  const rotRef = useRef(Math.PI + (Math.random() - 0.5) * 1); // face roughly toward player start
  const stateRef = useRef('patrol'); // patrol, chase, attack, dead
  const healthRef = useRef(enemyType.health);
  const walkCycleRef = useRef(Math.random() * 10);
  const lastShotRef = useRef(Date.now() + 1200);
  const hitUntilRef = useRef(0);
  const targetRef = useRef(null);
  const patrolTargetRef = useRef(null);
  const detectionTimerRef = useRef(0);
  const navRefreshRef = useRef(0);
  const navPathRef = useRef([]);
  const navPointIndexRef = useRef(0);
  const scene = useThree((state) => state.scene);

  const [visualState, setVisualState] = useState('idle');
  const [showFlash, setShowFlash] = useState(false);
  const [currentHealth, setCurrentHealth] = useState(enemyType.health);
  const [alive, setAlive] = useState(true);

  const gameState = useGameStore((s) => s.gameState);
  const addEffect = useGameStore((s) => s.addEffect);
  const damagePlayer = useGameStore((s) => s.damagePlayer);
  const selectedLevel = useGameStore((s) => s.selectedLevel);

  // Register in combat system
  useEffect(() => {
    combatSystem.register(id, {
      team: 'enemy',
      x: spawnPos.x, y: 0, z: spawnPos.z,
      health: enemyType.health,
    });
    return () => combatSystem.unregister(id);
  }, [id, spawnPos, enemyType]);

  // Pick random patrol point near spawn
  const pickPatrolTarget = useCallback(() => {
    patrolTargetRef.current = new THREE.Vector3(
      spawnPos.x + (Math.random() - 0.5) * 12,
      0,
      spawnPos.z + (Math.random() - 0.5) * 12
    );
  }, [spawnPos]);

  useEffect(() => {
    pickPatrolTarget();
  }, [pickPatrolTarget]);

  useFrame((_, delta) => {
    if (gameState !== GAME_STATES.PLAYING) return;
    if (!groupRef.current) return;
    if (!alive) return;

    const dt = Math.min(delta, 0.05);
    const pos = posRef.current;

    // Check health from combat system (in case player shot us)
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
        return;
      }
      if (self.health < enemyType.health * 0.3) stateRef.current = 'retreat';
    }

    // Detection check every 0.3s
    detectionTimerRef.current += dt;
    if (detectionTimerRef.current > 0.3) {
      detectionTimerRef.current = 0;
      const target = combatSystem.getNearestEnemy(pos, 'enemy', enemyType.detectionRange);
      if (target) {
        targetRef.current = target.soldier;
        if (target.distance <= enemyType.attackRange) {
          stateRef.current = 'attack';
        } else {
          stateRef.current = 'chase';
        }
      } else {
        targetRef.current = null;
        if (stateRef.current !== 'patrol') {
          stateRef.current = 'patrol';
          pickPatrolTarget();
        }
      }
    }

    const currentState = stateRef.current;

    if (currentState === 'patrol') {
      // Move toward patrol target
      if (patrolTargetRef.current) {
        const toTarget = new THREE.Vector3().subVectors(patrolTargetRef.current, pos);
        toTarget.y = 0;
        const dist = toTarget.length();
        if (dist < 1) {
          pickPatrolTarget();
        } else {
          toTarget.normalize();
          pos.add(toTarget.multiplyScalar(enemyType.speed * 0.4 * dt));
          rotRef.current = Math.atan2(-toTarget.x, -toTarget.z);
          walkCycleRef.current += dt * 2;
          setVisualState('walking');
        }
      }
    } else if (currentState === 'chase') {
      // Follow a navmesh path around ruins rather than walking through walls.
      if (targetRef.current && targetRef.current.alive) {
        const toTarget = new THREE.Vector3().subVectors(targetRef.current.position, pos);
        toTarget.y = 0;
        const dist = toTarget.length();
        if (dist <= enemyType.attackRange) {
          stateRef.current = 'attack';
        } else {
          navRefreshRef.current -= dt;
          if (navRefreshRef.current <= 0) {
            navPathRef.current = findNavPath(selectedLevel, pos, targetRef.current.position) || [];
            navPointIndexRef.current = navPathRef.current.length > 1 ? 1 : 0;
            navRefreshRef.current = 0.8;
          }
          const waypoint = navPathRef.current[navPointIndexRef.current];
          if (waypoint) {
            toTarget.copy(waypoint).sub(pos);
            toTarget.y = 0;
            if (toTarget.length() < 1.2 && navPointIndexRef.current < navPathRef.current.length - 1) {
              navPointIndexRef.current += 1;
              toTarget.copy(navPathRef.current[navPointIndexRef.current]).sub(pos);
              toTarget.y = 0;
            }
            toTarget.normalize();
            pos.add(toTarget.multiplyScalar(enemyType.speed * dt));
            rotRef.current = Math.atan2(-toTarget.x, -toTarget.z);
            walkCycleRef.current += dt * enemyType.speed;
            setVisualState('walking');
          } else {
            setVisualState('aiming');
          }
        }
      }
    } else if (currentState === 'retreat') {
      const cover = findCoverSnap(scene, pos, 16);
      if (cover && cover.distance > 1.1) {
        const towardCover = cover.position.clone().sub(pos).setY(0).normalize();
        pos.add(towardCover.multiplyScalar(enemyType.speed * 1.35 * dt));
        rotRef.current = Math.atan2(-towardCover.x, -towardCover.z);
        setVisualState('running');
      } else {
        stateRef.current = 'attack';
      }
    } else if (currentState === 'attack') {
      // Face target and shoot
      if (targetRef.current && targetRef.current.alive) {
        const toTarget = new THREE.Vector3().subVectors(targetRef.current.position, pos);
        toTarget.y = 0;
        const dist = toTarget.length();

        // Rotate to face target
        const targetYaw = Math.atan2(-toTarget.x, -toTarget.z);
        rotRef.current = THREE.MathUtils.lerp(rotRef.current, targetYaw, 0.1);

        // Check if target moved out of range
        if (dist > enemyType.attackRange * 1.2) {
          stateRef.current = 'chase';
          return;
        }

        // Fire weapon
        const now = Date.now();
        if (now - lastShotRef.current >= DEFAULT_ENEMY_WEAPON.fireRate * 7 * 1000) {
          lastShotRef.current = now;
          audioManager.playGunshot(0.2, pos, 'assault_rifle');
          setShowFlash(true);
          setTimeout(() => setShowFlash(false), 60);

          // Hit check
          if (combatSystem.checkHit(enemyType.accuracy, dist, enemyType.attackRange)) {
            const target = targetRef.current;
            if (target.team === 'player') {
              damagePlayer(DEFAULT_ENEMY_WEAPON.damage * 0.5);
            } else {
              // Damage friendly
              const newHp = target.health - DEFAULT_ENEMY_WEAPON.damage * 0.6;
              combatSystem.update(target.id, { health: newHp });
              if (newHp <= 0) {
                combatSystem.update(target.id, { alive: false });
              }
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
          setVisualState('aiming');
        }
      } else {
        stateRef.current = 'patrol';
        pickPatrolTarget();
      }
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
    <group ref={groupRef} position={[spawnPos.x, 0, spawnPos.z]}>
      <CharacterModel
        team="enemy"
        state={visualState}
        showWeaponFlash={showFlash}
      />
      <CharacterHealthBar
        health={currentHealth}
        maxHealth={enemyType.health}
        team="enemy"
        visible={alive}
      />
    </group>
  );
}

export default function EnemyManager() {
  const gameState = useGameStore((s) => s.gameState);
  const bossUnlocked = useGameStore((s) => s.bossUnlocked);
  const activateBoss = useGameStore((s) => s.activateBoss);
  const registeredAllRef = useRef(false);

  const enemies = useMemo(() => {
    return ENEMY_SPAWN_POSITIONS.map((spawn, i) => ({
      id: `enemy_${i}`,
      spawnPos: spawn,
      type: ENEMY_TYPES[spawn.type] || ENEMY_TYPES.GRUNT,
    }));
  }, []);

  useEffect(() => {
    if (gameState !== GAME_STATES.PLAYING) registeredAllRef.current = false;
  }, [gameState]);

  useFrame(() => {
    const remaining = combatSystem.getEnemyCount();
    if (remaining >= enemies.length) registeredAllRef.current = true;
    if (gameState === GAME_STATES.PLAYING && registeredAllRef.current && !bossUnlocked && remaining === 0) {
      activateBoss();
    }
  });

  const encounter = bossUnlocked
    ? [...enemies, { id: 'boss_wraith', spawnPos: { x: 0, z: -78, type: 'BOSS' }, type: ENEMY_TYPES.BOSS }]
    : enemies;

  if (gameState !== GAME_STATES.PLAYING && gameState !== GAME_STATES.PAUSED) return null;

  return (
    <group>
      {encounter.map((e) => (
        <EnemySoldier
          key={e.id}
          id={e.id}
          spawnPos={e.spawnPos}
          enemyType={e.type}
        />
      ))}
    </group>
  );
}
