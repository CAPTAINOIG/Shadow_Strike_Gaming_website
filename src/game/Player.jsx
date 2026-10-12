// Shadow Strike: Last Stand - Player Controller
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import CharacterModel from './CharacterModel';
import { useGameStore, GAME_STATES } from '../store/gameStore';
import { combatSystem } from '../systems/combatSystem';
import { audioManager } from '../systems/audioManager';
import { findCoverSnap } from '../systems/coverSystem';

const MOVE_SPEED = 6;
const SPRINT_SPEED = 10;
const MOUSE_SENSITIVITY = 0.002;
const CAMERA_DISTANCE = 4.6;
const CAMERA_HEIGHT = 2.05;
const CAMERA_SHOULDER = 0.85;

export default function Player() {
  const groupRef = useRef();
  const playerRef = useRef();
  const cameraTargetRef = useRef(new THREE.Vector3());
  const positionRef = useRef(new THREE.Vector3(0, 0, 5));
  const yawRef = useRef(0);
  const bodyYawRef = useRef(0);
  const pitchRef = useRef(-0.02);
  const walkCycleRef = useRef(0);
  const cameraRaycasterRef = useRef();
  if (!cameraRaycasterRef.current) cameraRaycasterRef.current = new THREE.Raycaster();
  const cameraTargetObjectRef = useRef(new THREE.Vector3());
  const cameraRightRef = useRef(new THREE.Vector3());
  const cameraForwardRef = useRef(new THREE.Vector3());
  const cameraOriginRef = useRef(new THREE.Vector3());
  const cameraOffsetRef = useRef(new THREE.Vector3());
  const cameraDirectionRef = useRef(new THREE.Vector3());
  const cameraObstacleMeshesRef = useRef([]);
  const cameraObstacleScanRef = useRef(0);

  const keysRef = useRef({ w: false, a: false, s: false, d: false, shift: false });
  const mouseRef = useRef({ dx: 0, dy: 0, locked: false });
  const touchMoveRef = useRef({ x: 0, y: 0 });
  const jumpVelocityRef = useRef(0);
  const grenadeUntilRef = useRef(0);
  const shootingRef = useRef(false);
  const coverRef = useRef(false);
  const lastShotTime = useRef(0);
  const publishedYawRef = useRef(0);

  const { camera, gl, scene } = useThree();
  const gameState = useGameStore((s) => s.gameState);
  const inVehicle = useGameStore((s) => s.inVehicle);
  const playerShoot = useGameStore((s) => s.playerShoot);
  const startReload = useGameStore((s) => s.startReload);
  const togglePause = useGameStore((s) => s.togglePause);
  const playerWeapon = useGameStore((s) => s.playerWeapon);
  const isReloading = useGameStore((s) => s.isReloading);
  const isShooting = useGameStore((s) => s.isShooting);
  const triggerHitMarker = useGameStore((s) => s.triggerHitMarker);
  const addEffect = useGameStore((s) => s.addEffect);
  const addKill = useGameStore((s) => s.addKill);
  const raiseWantedLevel = useGameStore((s) => s.raiseWantedLevel);
  const cameraShake = useGameStore((s) => s.cameraShake);
  const setCameraShake = useGameStore((s) => s.setCameraShake);
  const isAiming = useGameStore((s) => s.isAiming);
  const setAiming = useGameStore((s) => s.setAiming);
  const setInCover = useGameStore((s) => s.setInCover);
  const selectWeapon = useGameStore((s) => s.selectWeapon);
  const cycleWeapon = useGameStore((s) => s.cycleWeapon);
  const mouseSensitivity = useGameStore((s) => s.mouseSensitivity);
  const regenerateShield = useGameStore((s) => s.regenerateShield);

  useEffect(() => {
    const timer = setInterval(() => {
      const current = useGameStore.getState();
      if (current.gameState === GAME_STATES.PLAYING
        && Date.now() - current.lastShieldHitTime > 3600
        && current.playerShield < current.playerMaxShield) regenerateShield(4);
    }, 250);
    return () => clearInterval(timer);
  }, [regenerateShield]);

  const [soldierState, setSoldierState] = useState('idle');
  const [showFlash, setShowFlash] = useState(false);

  // Register player in combat system
  useEffect(() => {
    if (gameState !== GAME_STATES.PLAYING) return undefined;
    combatSystem.register('player', {
      team: 'player',
      x: 0, y: 0, z: 5,
      health: 100,
    });
    return () => combatSystem.unregister('player');
  }, [gameState]);

  useEffect(() => {
    if (gameState !== GAME_STATES.PLAYING) return;
    positionRef.current.set(0, 0, 5);
    yawRef.current = 0;
    bodyYawRef.current = 0;
    pitchRef.current = -0.02;
    mouseRef.current.dx = 0;
    mouseRef.current.dy = 0;
  }, [gameState]);

  useEffect(() => {
    if (inVehicle) return;
    const current = useGameStore.getState();
    positionRef.current.set(current.playerPosition.x, current.playerPosition.y, current.playerPosition.z);
    yawRef.current = current.playerRotation;
    bodyYawRef.current = current.playerRotation;
  }, [inVehicle]);

  // Keep health synced
  const playerHealth = useGameStore((s) => s.playerHealth);
  const lastHitTime = useGameStore((s) => s.lastHitTime);
  useEffect(() => {
    combatSystem.update('player', { health: playerHealth, alive: playerHealth > 0 });
  }, [playerHealth]);

  // Keyboard listeners
  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') keysRef.current.w = true;
      if (key === 'a' || key === 'arrowleft') keysRef.current.a = true;
      if (key === 's' || key === 'arrowdown') keysRef.current.s = true;
      if (key === 'd' || key === 'arrowright') keysRef.current.d = true;
      if (key === 'shift') keysRef.current.shift = true;
      if (key === '1') selectWeapon('assault_rifle');
      if (key === '2') selectWeapon('shotgun');
      if (key === '3') selectWeapon('sniper');
      if (key === 'c' || key === 'control') {
        coverRef.current = !coverRef.current;
        setInCover(coverRef.current);
      }
      if (key === ' ' && positionRef.current.y <= 0.001) jumpVelocityRef.current = 5.2;
      if (key === 'g' && gameState === GAME_STATES.PLAYING) grenadeUntilRef.current = Date.now() + 900;
      if (key === 'r' && gameState === GAME_STATES.PLAYING) {
        startReload();
        audioManager.playReload(0.3);
      }
      if (key === 'escape') {
        if (document.pointerLockElement) {
          document.exitPointerLock();
        }
        togglePause();
      }
    };
    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') keysRef.current.w = false;
      if (key === 'a' || key === 'arrowleft') keysRef.current.a = false;
      if (key === 's' || key === 'arrowdown') keysRef.current.s = false;
      if (key === 'd' || key === 'arrowright') keysRef.current.d = false;
      if (key === 'shift') keysRef.current.shift = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState, startReload, togglePause, selectWeapon, setInCover]);

  // Mouse movement listener
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (document.pointerLockElement || mouseRef.current.dragging) {
        mouseRef.current.dx += e.movementX;
        mouseRef.current.dy += e.movementY;
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    const handleTouchAim = (event) => {
      mouseRef.current.dx += event.detail.dx;
      mouseRef.current.dy += event.detail.dy;
    };
    const handleTouchMove = (event) => { touchMoveRef.current = event.detail; };
    const handleTouchShoot = (event) => { shootingRef.current = event.detail.active; };
    const handleAction = (event) => {
      const { type } = event.detail;
      if (type === 'reload') startReload();
      if (type === 'aim') setAiming(!useGameStore.getState().isAiming);
      if (type === 'cover') {
        coverRef.current = !coverRef.current;
        setInCover(coverRef.current);
      }
      if (type === 'jump' && positionRef.current.y <= 0.001) jumpVelocityRef.current = 5.2;
      if (type === 'weapon') cycleWeapon();
    };
    window.addEventListener('game:aim', handleTouchAim);
    window.addEventListener('game:move', handleTouchMove);
    window.addEventListener('game:shoot', handleTouchShoot);
    window.addEventListener('game:action', handleAction);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('game:aim', handleTouchAim);
      window.removeEventListener('game:move', handleTouchMove);
      window.removeEventListener('game:shoot', handleTouchShoot);
      window.removeEventListener('game:action', handleAction);
    };
  }, [startReload, setAiming, setInCover, cycleWeapon]);

  // Click to shoot + pointer lock
  useEffect(() => {
    const handleMouseDown = (e) => {
      if (e.button === 2) {
        e.preventDefault();
        mouseRef.current.dragging = true;
        setAiming(true);
        return;
      }
      if (e.button !== 0) return;
      if (gameState !== GAME_STATES.PLAYING) return;

      // Pointer lock supports continuous aim; mouse dragging remains available
      // when the browser or embedded preview refuses pointer lock.
      if (!document.pointerLockElement) {
        try {
          const lockRequest = gl.domElement.requestPointerLock?.();
          lockRequest?.catch?.(() => {});
        } catch { /* drag aiming remains active */ }
      }
      mouseRef.current.dragging = true;
      shootingRef.current = true;
    };

    const handleMouseUp = (e) => {
      if (e.button === 0) { shootingRef.current = false; mouseRef.current.dragging = false; }
      if (e.button === 2) { mouseRef.current.dragging = false; setAiming(false); }
    };
    const handleContextMenu = (event) => event.preventDefault();

    const shootLoop = setInterval(() => {
      if (shootingRef.current && gameState === GAME_STATES.PLAYING && !isReloading) {
        const now = Date.now();
        if (now - lastShotTime.current >= playerWeapon.fireRate * 1000) {
          const didShoot = playerShoot();
          if (didShoot) {
            lastShotTime.current = now;
            audioManager.playGunshot(0.4, positionRef.current, playerWeapon.id);
            setShowFlash(true);
            setTimeout(() => setShowFlash(false), 60);

            // Raycast for hit detection
            performShot();
          }
        }
      }
    }, 50);

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('contextmenu', handleContextMenu);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('contextmenu', handleContextMenu);
      clearInterval(shootLoop);
    };
  }, [gameState, isReloading, playerWeapon, playerShoot, setAiming]);

  // Perform a shot - check if we hit an enemy
  const performShot = useCallback(() => {
    const pos = positionRef.current;
    const yaw = yawRef.current;
    const pitch = pitchRef.current;
    const forward = new THREE.Vector3(
      -Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch)
    );

    // Check all enemies for hit
    const enemies = combatSystem.getEnemiesOf('player');
    let bestHit = null;
    let bestDist = playerWeapon.range;

    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      const toEnemy = new THREE.Vector3().subVectors(enemy.position, pos);
      toEnemy.y = 1;
      const dist = toEnemy.length();
      if (dist > playerWeapon.range) continue;

      // Check angle (within a cone)
      toEnemy.normalize();
      const dot = forward.dot(toEnemy);
      const angleTolerance = 0.15 + (playerWeapon.spread * 2);
      if (dot > (1 - angleTolerance) && dist < bestDist) {
        bestDist = dist;
        bestHit = enemy;
      }
    }

    if (bestHit) {
      // Accuracy roll
      if (combatSystem.checkHit(0.75, bestDist, playerWeapon.range)) {
        // Hit!
        const newHealth = bestHit.health - playerWeapon.damage;
        if (bestHit.team === 'civilian' || bestHit.team === 'police') raiseWantedLevel(1);
        combatSystem.update(bestHit.id, { health: newHealth });
        if (newHealth <= 0) {
          combatSystem.update(bestHit.id, { alive: false });
          if (bestHit.team !== 'civilian' && bestHit.team !== 'police') addKill();
          audioManager.playDeath(0.3);
        } else {
          audioManager.playImpact(0.2);
        }
        triggerHitMarker();
        // Impact effect
        addEffect({
          type: 'impact',
          position: bestHit.position.clone(),
          lifetime: 300,
        });
      }
    }

    // Muzzle flash effect at player position
    const muzzlePos = pos.clone().add(forward.clone().multiplyScalar(1.2));
    muzzlePos.y += 0.95;
    addEffect({
      type: 'tracer',
      from: muzzlePos,
      to: bestHit ? bestHit.position.clone().setY(1) : muzzlePos.clone().add(forward.multiplyScalar(50)),
      lifetime: 100,
    });
  }, [playerWeapon, addKill, raiseWantedLevel, triggerHitMarker, addEffect]);

  // Main game loop
  useFrame((_, delta) => {
    if (gameState !== GAME_STATES.PLAYING || inVehicle) return;
    if (!groupRef.current) return;

    const dt = Math.min(delta, 0.05); // cap delta

    // Mouse rotation
    const dx = mouseRef.current.dx;
    const dy = mouseRef.current.dy;
    mouseRef.current.dx = 0;
    mouseRef.current.dy = 0;
    yawRef.current -= dx * MOUSE_SENSITIVITY * (mouseSensitivity * 1.8);
    pitchRef.current = THREE.MathUtils.clamp(
      pitchRef.current - dy * MOUSE_SENSITIVITY * (mouseSensitivity * 1.8),
      -0.42,
      0.38
    );

    // Movement
    const keys = keysRef.current;
    const speed = keys.shift && !coverRef.current ? SPRINT_SPEED : coverRef.current ? MOVE_SPEED * 0.48 : MOVE_SPEED;
    const moveDir = new THREE.Vector3();

    moveDir.z = (keys.s ? 1 : 0) - (keys.w ? 1 : 0) - touchMoveRef.current.y;
    moveDir.x = (keys.d ? 1 : 0) - (keys.a ? 1 : 0) + touchMoveRef.current.x;

    const isMoving = moveDir.length() > 0;
    const worldDir = new THREE.Vector3();
    if (isMoving) {
      moveDir.normalize();
      // Rotate movement direction by yaw
      const cos = Math.cos(yawRef.current);
      const sin = Math.sin(yawRef.current);
      worldDir.set(
        moveDir.x * cos - moveDir.z * sin,
        0,
        moveDir.x * sin + moveDir.z * cos
      );
      positionRef.current.add(worldDir.multiplyScalar(speed * dt));
      walkCycleRef.current += dt * speed * 0.5;
    }
    if (jumpVelocityRef.current !== 0 || positionRef.current.y > 0) {
      positionRef.current.y = Math.max(0, positionRef.current.y + jumpVelocityRef.current * dt);
      jumpVelocityRef.current = positionRef.current.y === 0 ? 0 : jumpVelocityRef.current - 12 * dt;
    }
    if (coverRef.current) {
      const cover = findCoverSnap(scene, positionRef.current, 3.2);
      if (cover) {
        positionRef.current.lerp(cover.position, Math.min(1, dt * 12));
        yawRef.current = THREE.MathUtils.damp(yawRef.current, Math.atan2(-cover.normal.x, -cover.normal.z), 10, dt);
      } else {
        coverRef.current = false;
        setInCover(false);
      }
    }

    // Keep body facing aligned to the mouse-controlled heading. Walking back
    // stays a real backpedal; the player can turn fully around with mouse drag.
    const targetBodyYaw = yawRef.current;
    const turnDifference = THREE.MathUtils.euclideanModulo(targetBodyYaw - bodyYawRef.current + Math.PI, Math.PI * 2) - Math.PI;
    bodyYawRef.current += turnDifference * (1 - Math.exp(-12 * dt));
    bodyYawRef.current = THREE.MathUtils.euclideanModulo(bodyYawRef.current + Math.PI, Math.PI * 2) - Math.PI;

    // Update soldier model
    const wasHit = lastHitTime > 0 && Date.now() - lastHitTime < 350;
    const state = playerHealth <= 0
      ? 'dead'
      : positionRef.current.y > 0.015
      ? 'jump'
      : wasHit
        ? 'hit'
        : Date.now() < grenadeUntilRef.current
          ? 'grenade'
          : isReloading
            ? 'reloading'
            : isShooting
              ? 'shooting'
              : isMoving
                ? (keys.shift
                  ? (moveDir.z > 0.45 ? 'run_back' : 'running')
                  : moveDir.z > 0.45
                    ? 'backward'
                    : Math.abs(moveDir.x) > 0.45
                      ? (moveDir.x < 0 ? 'strafe_left' : 'strafe_right')
                      : keys.shift ? 'running' : 'walking')
                : coverRef.current
                  ? 'cover'
                  : Math.abs(turnDifference) > 0.06
                    ? (turnDifference > 0 ? 'turn_left' : 'turn_right')
                    : isAiming ? 'aiming' : 'idle';
    if (state !== soldierState) setSoldierState(state);

    // Position the group
    groupRef.current.position.copy(positionRef.current);
    groupRef.current.rotation.y = bodyYawRef.current;
    if (Math.abs(THREE.MathUtils.euclideanModulo(bodyYawRef.current - publishedYawRef.current + Math.PI, Math.PI * 2) - Math.PI) > 0.035) {
      publishedYawRef.current = bodyYawRef.current;
      useGameStore.getState().setPlayerRotation(bodyYawRef.current);
    }

    // Update combat system
    combatSystem.update('player', { position: positionRef.current });
    useGameStore.getState().setPlayerPosition({
      x: positionRef.current.x,
      y: positionRef.current.y,
      z: positionRef.current.z,
    });

    // Offset the camera over the right shoulder while keeping the player in frame.
    const camYaw = isAiming || isReloading || shootingRef.current ? yawRef.current : bodyYawRef.current;
    const camPitch = pitchRef.current;
    const forward = new THREE.Vector3(
      -Math.sin(camYaw) * Math.cos(camPitch),
      Math.sin(camPitch),
      -Math.cos(camYaw) * Math.cos(camPitch)
    );
    const right = cameraRightRef.current.set(Math.cos(camYaw), 0, -Math.sin(camYaw));
    const cameraDistance = isAiming ? CAMERA_DISTANCE * 0.68 : CAMERA_DISTANCE;
    const cameraShoulder = isAiming ? CAMERA_SHOULDER * 0.38 : CAMERA_SHOULDER;
    const camOffset = cameraOffsetRef.current.set(
      Math.sin(camYaw) * cameraDistance + right.x * cameraShoulder,
      CAMERA_HEIGHT,
      Math.cos(camYaw) * cameraDistance + right.z * cameraShoulder
    );
    const targetCamPos = positionRef.current.clone().add(camOffset);

    const cameraOrigin = cameraOriginRef.current.copy(positionRef.current);
    cameraOrigin.y += 1.35;
    const cameraRay = cameraRaycasterRef.current;
    const cameraDelta = cameraDirectionRef.current.copy(targetCamPos).sub(cameraOrigin);
    const desiredDistance = cameraDelta.length();
    cameraRay.set(cameraOrigin, cameraDelta.normalize());
    cameraRay.far = desiredDistance;
    if (cameraObstacleScanRef.current <= 0) {
      cameraObstacleMeshesRef.current.length = 0;
      scene.traverse((object) => {
        if (object.userData.cameraObstacle && object.isMesh && object.visible) {
          cameraObstacleMeshesRef.current.push(object);
        }
      });
      cameraObstacleScanRef.current = 0.5;
    }
    cameraObstacleScanRef.current -= dt;
    const obstruction = cameraRay.intersectObjects(cameraObstacleMeshesRef.current, false)
      .find((hit) => hit.distance > 0.55 && hit.distance < desiredDistance);
    if (obstruction) {
      targetCamPos.copy(cameraOrigin).addScaledVector(
        cameraRay.ray.direction,
        Math.max(0.8, obstruction.distance - 0.3)
      );
    }

    camera.position.lerp(targetCamPos, 0.12);

    // Keep the target close enough that the third-person soldier stays clearly
    // inside the lower-middle of the frame while still looking toward combat.
    const lookTarget = cameraTargetObjectRef.current.copy(positionRef.current)
      .addScaledVector(cameraForwardRef.current.copy(forward), isAiming ? 9 : 5.5);
    lookTarget.y += 1.22;

    cameraTargetRef.current.lerp(lookTarget, 0.12);
    camera.lookAt(cameraTargetRef.current);
    if (camera.isPerspectiveCamera) {
      const targetFov = isAiming ? 43 : 60;
      const nextFov = THREE.MathUtils.damp(camera.fov, targetFov, 7, dt);
      if (Math.abs(nextFov - camera.fov) > 0.01) {
        camera.fov = nextFov;
        camera.updateProjectionMatrix();
      }
    }

    // Camera shake
    if (cameraShake > 0.01) {
      camera.position.x += (Math.random() - 0.5) * cameraShake * 0.3;
      camera.position.y += (Math.random() - 0.5) * cameraShake * 0.2;
      setCameraShake(cameraShake * 0.85);
    }
  });

  if ((gameState !== GAME_STATES.PLAYING && gameState !== GAME_STATES.PAUSED) || inVehicle) return null;

  return (
    <group ref={groupRef} userData={{ isCharacter: true }}>
      <group ref={playerRef}>
        <CharacterModel
          team="player"
          state={soldierState}
          gender="male"
          walkCycle={walkCycleRef.current}
          showWeaponFlash={showFlash}
        />
      </group>
    </group>
  );
}
