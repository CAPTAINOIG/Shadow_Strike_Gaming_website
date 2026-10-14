// Shadow Strike: Last Stand - Player controller and third-person camera.
import React, { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import CharacterModel from './CharacterModel';
import { useGameStore, GAME_STATES } from '../store/gameStore';
import { combatSystem } from '../systems/combatSystem';
import { collisionWorld } from '../systems/collisionWorld';
import { audioManager } from '../systems/audioManager';
import { fireRound, onNearMiss } from '../systems/ballistics';
import { fx } from '../systems/fx';
import { loadSoldier } from './soldierAssets';
import { PLAYER_SPAWN } from '../data/battlefieldLayout';

const RADIUS = 0.32;
const STAND_HEIGHT = 1.75;
const CROUCH_HEIGHT = 1.2;
const GRAVITY = 17;
const SPEED = { run: 3.7, sprint: 5.9, aim: 1.9, crouch: 1.45, crouchAim: 1.15 };
const CAMERA = {
  normal: { distance: 2.75, shoulder: 0.62, height: 0.1, fov: 66 },
  aim: { distance: 1.35, shoulder: 0.5, height: 0.06, fov: 50 },
  sprint: { distance: 3.05, shoulder: 0.55, height: 0.08, fov: 72 },
  scope: { distance: 0.9, shoulder: 0.42, height: 0.04, fov: 20 },
};

const yawOf = (x, z) => Math.atan2(-x, -z);
const angleDelta = (a, b) => THREE.MathUtils.euclideanModulo(b - a + Math.PI, Math.PI * 2) - Math.PI;

function createState() {
  return {
    pos: new THREE.Vector3(PLAYER_SPAWN.x, 0, PLAYER_SPAWN.z),
    vel: new THREE.Vector3(),
    vy: 0,
    grounded: true,
    yaw: PLAYER_SPAWN.yaw,
    pitch: -0.05,
    bodyYaw: PLAYER_SPAWN.yaw,
    crouch: false,
    sprint: false,
    aimHeld: false,
    fireHeld: false,
    firePressed: false,
    lastShot: -10,
    lastCombat: -10,
    recoilAccum: 0,
    bloom: 0,
    shoulder: 1,
    pivot: new THREE.Vector3(PLAYER_SPAWN.x, 1.6, PLAYER_SPAWN.z),
    camDistance: CAMERA.normal.distance,
    fov: CAMERA.normal.fov,
    shake: 0,
    shotsFired: 0,
    dead: false,
    deathTime: 0,
    lastPublish: 0,
    lastHitSeen: 0,
    hitFlinch: 0,
    lastSpread: -1,
    aimPoint: new THREE.Vector3(),
  };
}

export default function Player() {
  const modelRef = useRef();
  const groupRef = useRef();
  const stateRef = useRef(null);
  if (!stateRef.current) stateRef.current = createState();
  const keys = useRef({ w: false, a: false, s: false, d: false, shift: false });
  const mouse = useRef({ dx: 0, dy: 0, dragging: false });
  const touchMove = useRef({ x: 0, y: 0 });
  const gripRef = useRef(null);

  const { camera, gl } = useThree();
  const gameState = useGameStore((s) => s.gameState);
  const runId = useGameStore((s) => s.runId);
  const weaponModel = useGameStore((s) => s.playerWeapon.model);
  const active = gameState === GAME_STATES.PLAYING || gameState === GAME_STATES.PAUSED;

  useEffect(() => { loadSoldier().then((asset) => { gripRef.current = asset.grip; }).catch(() => {}); }, []);

  // Reset for each new run and register with the combat system.
  useEffect(() => {
    if (!runId) return undefined;
    stateRef.current = createState();
    if (import.meta.env.DEV && window.__game) window.__game.player = stateRef.current;
    const entry = combatSystem.register('player', {
      team: 'player', x: PLAYER_SPAWN.x, y: 0, z: PLAYER_SPAWN.z, health: 100, name: 'YOU',
      onDamage: (amount, info) => {
        useGameStore.getState().damagePlayer(amount, info.from);
        return useGameStore.getState().playerHealth <= 0;
      },
    });
    entry.handle = modelRef.current || null;
    const off = onNearMiss(() => { stateRef.current.shake = Math.max(stateRef.current.shake, 0.35); });
    return () => { off(); combatSystem.unregister('player'); };
  }, [runId]);

  // Keyboard
  useEffect(() => {
    const down = (event) => {
      const store = useGameStore.getState();
      const key = event.key.toLowerCase();
      if (key === 'escape') { store.togglePause(); return; }
      if (store.gameState !== GAME_STATES.PLAYING) return;
      const s = stateRef.current;
      if (key === 'w' || key === 'arrowup') keys.current.w = true;
      if (key === 'a' || key === 'arrowleft') keys.current.a = true;
      if (key === 's' || key === 'arrowdown') keys.current.s = true;
      if (key === 'd' || key === 'arrowright') keys.current.d = true;
      if (key === 'shift') keys.current.shift = true;
      if (event.repeat) return;
      if (key === 'c' || key === 'control') { s.crouch = !s.crouch; store.setCrouching(s.crouch); }
      if (key === ' ' && s.grounded && !s.dead) {
        if (s.crouch) { s.crouch = false; store.setCrouching(false); } else { s.vy = 5.3; s.grounded = false; }
      }
      if (key === 'r') reload();
      if (key === 'q') s.shoulder *= -1;
      if (key === '1') store.selectWeapon('assault_rifle');
      if (key === '2') store.selectWeapon('shotgun');
      if (key === '3') store.selectWeapon('sniper');
    };
    const up = (event) => {
      const key = event.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') keys.current.w = false;
      if (key === 'a' || key === 'arrowleft') keys.current.a = false;
      if (key === 's' || key === 'arrowdown') keys.current.s = false;
      if (key === 'd' || key === 'arrowright') keys.current.d = false;
      if (key === 'shift') keys.current.shift = false;
    };
    const blur = () => { Object.keys(keys.current).forEach((k) => { keys.current[k] = false; }); stateRef.current.fireHeld = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, []);

  // Mouse, pointer lock and touch controls.
  useEffect(() => {
    const canvas = gl.domElement;
    const move = (event) => {
      if (document.pointerLockElement === canvas || mouse.current.dragging) {
        mouse.current.dx += event.movementX;
        mouse.current.dy += event.movementY;
      }
    };
    const downHandler = (event) => {
      const store = useGameStore.getState();
      if (store.gameState !== GAME_STATES.PLAYING) return;
      if (event.target !== canvas && document.pointerLockElement !== canvas) return;
      if (document.pointerLockElement !== canvas) {
        try { canvas.requestPointerLock?.()?.catch?.(() => {}); } catch { /* drag-to-aim fallback */ }
      }
      mouse.current.dragging = true;
      if (event.button === 0) { stateRef.current.fireHeld = true; stateRef.current.firePressed = true; }
      if (event.button === 2) { stateRef.current.aimHeld = true; store.setAiming(true); }
    };
    const upHandler = (event) => {
      if (event.button === 0) stateRef.current.fireHeld = false;
      if (event.button === 2) { stateRef.current.aimHeld = false; useGameStore.getState().setAiming(false); }
      if (event.buttons === 0) mouse.current.dragging = false;
    };
    const wheel = (event) => {
      const store = useGameStore.getState();
      if (store.gameState === GAME_STATES.PLAYING && Math.abs(event.deltaY) > 20) store.cycleWeapon();
    };
    const contextMenu = (event) => event.preventDefault();
    const touchAim = (event) => { mouse.current.dx += event.detail.dx; mouse.current.dy += event.detail.dy; };
    const touchMoveHandler = (event) => { touchMove.current = event.detail; };
    const touchShoot = (event) => { stateRef.current.fireHeld = event.detail.active; if (event.detail.active) stateRef.current.firePressed = true; };
    const action = (event) => {
      const store = useGameStore.getState();
      const s = stateRef.current;
      const { type } = event.detail;
      if (type === 'reload') reload();
      if (type === 'aim') { s.aimHeld = !s.aimHeld; store.setAiming(s.aimHeld); }
      if (type === 'cover' || type === 'crouch') { s.crouch = !s.crouch; store.setCrouching(s.crouch); }
      if (type === 'jump' && s.grounded) { s.vy = 5.3; s.grounded = false; }
      if (type === 'weapon') store.cycleWeapon();
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mousedown', downHandler);
    window.addEventListener('mouseup', upHandler);
    window.addEventListener('wheel', wheel, { passive: true });
    window.addEventListener('contextmenu', contextMenu);
    window.addEventListener('game:aim', touchAim);
    window.addEventListener('game:move', touchMoveHandler);
    window.addEventListener('game:shoot', touchShoot);
    window.addEventListener('game:action', action);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mousedown', downHandler);
      window.removeEventListener('mouseup', upHandler);
      window.removeEventListener('wheel', wheel);
      window.removeEventListener('contextmenu', contextMenu);
      window.removeEventListener('game:aim', touchAim);
      window.removeEventListener('game:move', touchMoveHandler);
      window.removeEventListener('game:shoot', touchShoot);
      window.removeEventListener('game:action', action);
    };
  }, [gl]);

  function reload() {
    const store = useGameStore.getState();
    if (stateRef.current.dead) return;
    if (store.startReload()) audioManager.reload(store.playerWeapon.reloadTime, null, store.playerWeapon.id === 'shotgun' ? 'shotgun' : 'rifle');
  }

  function shoot(s, now, store, muzzle, aimPoint) {
    const weapon = store.playerWeapon;
    if (store.isReloading) return;
    if (now - s.lastShot < weapon.fireRate) return;
    if (!weapon.auto && !s.firePressed) return;
    s.firePressed = false;
    if (store.playerAmmo <= 0) {
      if (s.lastShot !== -1) { audioManager.dryFire(); s.lastShot = now; }
      if (store.playerReserveAmmo > 0) reload();
      return;
    }
    if (!store.consumeAmmo()) return;
    s.lastShot = now;
    s.lastCombat = now;
    s.shotsFired += 1;

    // The round leaves the real muzzle. If the barrel is poking through a wall,
    // it starts at the shoulder instead so it cannot pass through geometry.
    const shoulder = _shoulder.copy(s.pivot).addScaledVector(_right.set(Math.cos(s.yaw), 0, -Math.sin(s.yaw)), 0.18 * s.shoulder);
    shoulder.y -= 0.2;
    const toMuzzle = _tmp.subVectors(muzzle, shoulder);
    const muzzleDistance = toMuzzle.length();
    const blocked = collisionWorld.raycast(shoulder, toMuzzle.normalize(), muzzleDistance, (c) => c.bullets);
    const origin = blocked ? shoulder : muzzle;
    const direction = _dir.subVectors(aimPoint, origin).normalize();

    const moving = Math.hypot(s.vel.x, s.vel.z);
    const baseSpread = s.aimHeld ? weapon.aimSpread : weapon.spread;
    const spread = (baseSpread + s.bloom) * (1 + moving * 0.22) * (s.crouch ? 0.75 : 1) * (s.grounded ? 1 : 2.5);
    const { hits } = fireRound({ shooterId: 'player', origin, direction, weapon, spread, tracer: s.shotsFired % 2 === 1 || weapon.pellets, noiseRadius: 90 });
    s.bloom = Math.min(s.bloom + (weapon.auto ? 0.0035 : 0.01), weapon.auto ? 0.03 : 0.05);

    // Recoil: immediate kick, mostly recovered over the next few frames.
    const kick = weapon.recoil * (s.aimHeld ? 0.75 : 1) * (s.crouch ? 0.8 : 1);
    s.pitch += kick;
    s.recoilAccum += kick * 0.75;
    s.yaw += (Math.random() - 0.4) * weapon.recoilYaw;
    s.shake = Math.max(s.shake, weapon.pellets || weapon.id === 'sniper' ? 0.5 : 0.18);
    const animator = modelRef.current?.animator;
    if (animator) animator.params.recoil = Math.min(1.6, animator.params.recoil + (weapon.pellets ? 1.4 : weapon.id === 'sniper' ? 1.6 : 0.6));

    fx.muzzleFlash(muzzle, direction, weapon.pellets ? 1.4 : weapon.id === 'sniper' ? 1.5 : 1);
    if (!weapon.pellets) {
      const eject = _tmp.copy(muzzle).addScaledVector(direction, -0.42);
      const side = _right.set(-direction.z, 0, direction.x).normalize();
      fx.shell(eject, side.multiplyScalar(1.6 + Math.random()).add(_up.set(0, 1.6 + Math.random(), 0)));
    }
    audioManager.gunshot(weapon.sound, muzzle, { isPlayer: true });
    if (weapon.id === 'sniper') audioManager.bolt();

    if (hits.length) {
      const kill = hits.some((h) => h.killed);
      const headshot = hits.some((h) => h.headshot);
      store.triggerHitMarker({ kill, headshot });
      audioManager.hitmarker(kill);
    }
  }

  useFrame((_, delta) => {
    const store = useGameStore.getState();
    if (store.gameState !== GAME_STATES.PLAYING && store.gameState !== GAME_STATES.GAME_OVER) return;
    const s = stateRef.current;
    const dt = Math.min(delta, 0.05);
    const now = performance.now() / 1000;
    const handle = modelRef.current;
    const entry = combatSystem.get('player');
    if (entry && handle && entry.handle !== handle) entry.handle = handle;
    const weapon = store.playerWeapon;
    const grip = gripRef.current;

    // --- Death
    if (store.playerHealth <= 0 && !s.dead) {
      s.dead = true; s.deathTime = now; s.fireHeld = false;
      if (entry) entry.alive = false;
      audioManager.bodyFall(s.pos);
      if (document.pointerLockElement) document.exitPointerLock();
    }

    // --- Look
    const zoomed = s.aimHeld && weapon.zoomFov;
    const sensitivity = 0.0021 * (0.35 + store.mouseSensitivity * 1.3) * (s.aimHeld ? (zoomed ? 0.32 : 0.62) : 1);
    if (!s.dead) {
      s.yaw -= mouse.current.dx * sensitivity;
      s.pitch -= mouse.current.dy * sensitivity;
    }
    mouse.current.dx = 0; mouse.current.dy = 0;
    const recover = Math.min(s.recoilAccum, s.recoilAccum * 9 * dt + 0.0005);
    s.pitch -= recover; s.recoilAccum -= recover;
    s.pitch = THREE.MathUtils.clamp(s.pitch, -1.15, 1.05);
    s.bloom = Math.max(0, s.bloom - dt * (s.fireHeld ? 0.02 : 0.08));

    // --- Movement intent
    const k = keys.current;
    let ix = (k.d ? 1 : 0) - (k.a ? 1 : 0) + touchMove.current.x;
    let iz = (k.w ? 1 : 0) - (k.s ? 1 : 0) + touchMove.current.y;
    const inputLength = Math.hypot(ix, iz);
    if (inputLength > 1) { ix /= inputLength; iz /= inputLength; }
    if (s.dead) { ix = 0; iz = 0; }
    const fwdX = -Math.sin(s.yaw); const fwdZ = -Math.cos(s.yaw);
    const rightX = Math.cos(s.yaw); const rightZ = -Math.sin(s.yaw);
    const wishX = fwdX * iz + rightX * ix; const wishZ = fwdZ * iz + rightZ * ix;
    const moving = Math.hypot(wishX, wishZ) > 0.1;
    const combatMode = s.aimHeld || s.fireHeld || now - s.lastShot < 1.1 || store.isReloading || s.crouch;
    s.sprint = k.shift && moving && !s.aimHeld && !s.fireHeld && !s.crouch && s.grounded && iz > -0.2;
    if (s.sprint && store.isReloading) s.sprint = false;
    const targetSpeed = !moving ? 0 : s.sprint ? SPEED.sprint : s.crouch ? (s.aimHeld ? SPEED.crouchAim : SPEED.crouch) : s.aimHeld ? SPEED.aim : SPEED.run;
    const accel = s.grounded ? (targetSpeed > Math.hypot(s.vel.x, s.vel.z) ? 11 : 13) : 2;
    const scale = Math.min(1, Math.hypot(ix, iz));
    s.vel.x = THREE.MathUtils.damp(s.vel.x, moving ? wishX / Math.hypot(wishX, wishZ) * targetSpeed * scale : 0, accel, dt);
    s.vel.z = THREE.MathUtils.damp(s.vel.z, moving ? wishZ / Math.hypot(wishX, wishZ) * targetSpeed * scale : 0, accel, dt);

    // --- Integrate with collision (walls slide, steps and stairs climb).
    const height = s.crouch ? CROUCH_HEIGHT : STAND_HEIGHT;
    const before = _before.copy(s.pos);
    s.pos.x += s.vel.x * dt; s.pos.z += s.vel.z * dt;
    collisionWorld.resolveCircle(s.pos, RADIUS, s.pos.y, height, 0.45);
    s.vel.x = (s.pos.x - before.x) / Math.max(dt, 1e-4);
    s.vel.z = (s.pos.z - before.z) / Math.max(dt, 1e-4);
    const support = collisionWorld.supportHeight(s.pos.x, s.pos.z, RADIUS, s.pos.y, 0.45);
    if (s.grounded) {
      if (support < s.pos.y - 0.06) { s.grounded = false; s.vy = 0; } else s.pos.y = support > s.pos.y ? THREE.MathUtils.damp(s.pos.y, support, 22, dt) : support;
    }
    if (!s.grounded) {
      s.vy -= GRAVITY * dt;
      s.pos.y += s.vy * dt;
      const ceiling = collisionWorld.ceilingHeight(s.pos.x, s.pos.z, s.pos.y + 0.5);
      if (s.pos.y + height > ceiling) { s.pos.y = ceiling - height; s.vy = Math.min(s.vy, 0); }
      if (s.pos.y <= support) {
        if (s.vy < -6) { s.shake = Math.max(s.shake, 0.3); audioManager.footstep(s.pos, { isPlayer: true, speed: 6 }); }
        s.pos.y = support; s.vy = 0; s.grounded = true;
      }
    }

    // --- Camera pivot (vertically smoothed so stairs do not jolt the view).
    const eye = s.crouch ? 1.22 : 1.6;
    s.pivot.x = s.pos.x; s.pivot.z = s.pos.z;
    s.pivot.y = THREE.MathUtils.damp(s.pivot.y, s.pos.y + eye, 14, dt);
    const camDir = _camDir.set(-Math.sin(s.yaw) * Math.cos(s.pitch), Math.sin(s.pitch), -Math.cos(s.yaw) * Math.cos(s.pitch));

    // --- Aim point: what is under the crosshair (traced past the player).
    const camPos = camera.position;
    const skip = Math.max(0, _tmp.subVectors(s.pivot, camPos).dot(camDir)) + 0.3;
    const rayOrigin = _rayOrigin.copy(camPos).addScaledVector(camDir, skip);
    const hit = combatSystem.traceBullet(rayOrigin, camDir, 400, 'player');
    s.aimPoint.copy(hit ? hit.point : _tmp.copy(rayOrigin).addScaledVector(camDir, 400));

    // --- Body facing
    const shoulderY = s.pos.y + (grip?.shoulderHeight || 1.4) * (s.crouch ? 0.7 : 1);
    const toAimX = s.aimPoint.x - s.pos.x; const toAimZ = s.aimPoint.z - s.pos.z;
    const aimYaw = Math.hypot(toAimX, toAimZ) > 1.2 ? yawOf(toAimX, toAimZ) : s.yaw;
    const animator = handle?.animator;
    const aimBlend = animator ? animator.aimBlend : 0;
    let targetBody = s.bodyYaw;
    if (combatMode || !moving) {
      // Rifle on target: compensate the barrel's angle in the aiming pose.
      if (combatMode || Math.abs(angleDelta(s.bodyYaw, s.yaw)) > 1.6) targetBody = aimYaw - (grip?.aimYaw || 0) * aimBlend;
    } else {
      targetBody = yawOf(s.vel.x, s.vel.z);
    }
    if (!s.dead) {
      const turn = angleDelta(s.bodyYaw, targetBody);
      const rate = combatMode ? 16 : s.sprint ? 7 : 10;
      const step = turn * (1 - Math.exp(-rate * dt));
      s.bodyYaw += step;
      if (animator) animator.params.turnRate = moving ? 0 : step / Math.max(dt, 1e-4);
    }

    // --- Animator parameters
    if (animator) {
      const p = animator.params;
      const fwd = _bodyFwd.set(-Math.sin(s.bodyYaw), 0, -Math.cos(s.bodyYaw));
      const left = _bodyLeft.set(-Math.cos(s.bodyYaw), 0, Math.sin(s.bodyYaw));
      const speed = Math.hypot(s.vel.x, s.vel.z);
      p.speed = speed;
      if (speed > 0.05) { p.dirZ = (s.vel.x * fwd.x + s.vel.z * fwd.z) / speed; p.dirX = (s.vel.x * left.x + s.vel.z * left.z) / speed; }
      p.aim = combatMode ? 1 : 0;
      p.sprint = s.sprint;
      p.crouch = s.crouch;
      p.airborne = !s.grounded && (s.vy > 0.5 || s.pos.y > support + 0.35);
      p.dead = s.dead;
      p.reloading = store.isReloading;
      p.reload = store.isReloading ? (performance.now() - store.reloadStartedAt) / (weapon.reloadTime * 1000) : 0;
      p.pitch = Math.atan2(s.aimPoint.y - shoulderY, Math.max(0.5, Math.hypot(toAimX, toAimZ)));
      p.recoil = Math.max(0, p.recoil - dt * 9);
      if (store.lastHitTime !== s.lastHitSeen) { s.lastHitSeen = store.lastHitTime; s.hitFlinch = 1; s.shake = Math.max(s.shake, 0.45); }
      s.hitFlinch = Math.max(0, s.hitFlinch - dt * 2.5);
      p.hit = s.hitFlinch;
    }

    // --- Firing (sprinting stops when the trigger is pulled)
    if (s.fireHeld && !s.dead && handle?.weapon) {
      if (s.sprint) s.sprint = false;
      shoot(s, now, store, handle.getMuzzle(_muzzle), s.aimPoint);
    }

    // --- Place the soldier
    if (groupRef.current) {
      groupRef.current.position.copy(s.pos);
      groupRef.current.rotation.y = s.bodyYaw + Math.PI;
    }
    if (entry) { entry.position.copy(s.pos); entry.crouching = s.crouch; entry.yaw = s.yaw; entry.speed = Math.hypot(s.vel.x, s.vel.z); }

    // --- Camera: rotation follows the mouse directly; position is collision-checked.
    const mode = zoomed ? CAMERA.scope : s.aimHeld ? CAMERA.aim : s.sprint ? CAMERA.sprint : CAMERA.normal;
    const deathOrbit = s.dead ? Math.min(1, (now - s.deathTime) / 2) : 0;
    const right = _right.set(Math.cos(s.yaw), 0, -Math.sin(s.yaw));
    const shoulderOffset = mode.shoulder * s.shoulder;
    const wantDistance = mode.distance + deathOrbit * 2.5;
    const anchor = _anchor.copy(s.pivot).addScaledVector(right, shoulderOffset * 0.5);
    anchor.y += mode.height + deathOrbit * 1.2;
    const desired = _desired.copy(anchor).addScaledVector(right, shoulderOffset * 0.5).addScaledVector(camDir, -wantDistance);
    const toCam = _tmp.subVectors(desired, anchor);
    const camLen = toCam.length();
    toCam.divideScalar(camLen);
    const block = collisionWorld.raycast(anchor, toCam, camLen + 0.25, (c) => c.sight && c.solid);
    const allowed = block ? Math.max(0.35, block.distance - 0.25) : camLen;
    s.camDistance = allowed < s.camDistance ? allowed : THREE.MathUtils.damp(s.camDistance, allowed, 7, dt);
    camera.position.copy(anchor).addScaledVector(toCam, s.camDistance);
    // Keep the lens above the ground.
    camera.position.y = Math.max(camera.position.y, collisionWorld.groundHeight + 0.25);
    camera.rotation.set(s.pitch, s.yaw, 0, 'YXZ');
    // Footstep bob while sprinting and recoil/impact shake.
    const speedNow = Math.hypot(s.vel.x, s.vel.z);
    if (s.sprint && s.grounded) camera.position.y += Math.sin(now * 11) * 0.025 * Math.min(1, speedNow / 5);
    if (s.shake > 0.01) {
      camera.rotation.x += (Math.random() - 0.5) * s.shake * 0.012;
      camera.rotation.y += (Math.random() - 0.5) * s.shake * 0.012;
      s.shake = Math.max(0, s.shake - dt * 3);
    }
    const targetFov = s.dead ? 60 : mode.fov;
    s.fov = THREE.MathUtils.damp(s.fov, targetFov, zoomed ? 14 : 9, dt);
    if (Math.abs(camera.fov - s.fov) > 0.01) { camera.fov = s.fov; camera.updateProjectionMatrix(); }
    if (handle?.root) handle.root.visible = s.camDistance > 0.55 && !zoomed;
    audioManager.updateListener(camera);

    // --- Regeneration: armour after 5 s out of damage, health slowly after 8 s.
    const sinceHit = (Date.now() - store.lastHitTime) / 1000;
    if (!s.dead && store.lastHitTime && sinceHit > 5 && store.playerArmor < store.playerMaxArmor) store.regenerateArmor(dt * 12);
    if (!s.dead && sinceHit > 8 && store.playerHealth < store.playerMaxHealth) useGameStore.setState({ playerHealth: Math.min(store.playerMaxHealth, store.playerHealth + dt * 4) });

    // --- HUD data at a lower rate.
    if (now - s.lastPublish > 0.1) {
      s.lastPublish = now;
      store.setPlayerPosition({ x: s.pos.x, y: s.pos.y, z: s.pos.z });
      store.setPlayerRotation(s.yaw);
      const baseSpread = s.aimHeld ? weapon.aimSpread : weapon.spread;
      const spread = Math.round(((baseSpread + s.bloom) * (1 + speedNow * 0.22) * (s.crouch ? 0.75 : 1) * (s.grounded ? 1 : 2.5)) * 2000);
      if (spread !== s.lastSpread) { s.lastSpread = spread; store.setCrosshairSpread(spread); }
    }
  });

  if (!active && gameState !== GAME_STATES.GAME_OVER) return null;

  return (
    <group ref={groupRef} position={[PLAYER_SPAWN.x, 0, PLAYER_SPAWN.z]}>
      <CharacterModel
        key={runId}
        ref={modelRef}
        team="player"
        weapon={weaponModel}
        onStep={(speed) => audioManager.footstep(stateRef.current.pos, { isPlayer: true, speed })}
      />
    </group>
  );
}

const _shoulder = new THREE.Vector3();
const _right = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _up = new THREE.Vector3();
const _before = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();
const _bodyFwd = new THREE.Vector3();
const _bodyLeft = new THREE.Vector3();
const _muzzle = new THREE.Vector3();
const _anchor = new THREE.Vector3();
const _desired = new THREE.Vector3();
