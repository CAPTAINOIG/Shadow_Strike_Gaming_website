// Shadow Strike: Last Stand - shared firing logic for the player and the AI.
// Each round is a hitscan trace from the muzzle against the static world and
// per-bone hitboxes; cover stops bullets, damage depends on the body part hit.
import * as THREE from 'three';
import { combatSystem } from './combatSystem';
import { fx } from './fx';
import { audioManager } from './audioManager';

const _dir = new THREE.Vector3();
const _perpA = new THREE.Vector3();
const _perpB = new THREE.Vector3();
const _end = new THREE.Vector3();
const _closest = new THREE.Vector3();
const _seg = new THREE.Vector3();

/** Rotates `dir` by a random angle within a cone of `spread` radians. */
export function applySpread(dir, spread, out = new THREE.Vector3()) {
  out.copy(dir);
  if (spread <= 0) return out;
  _perpA.set(0, 1, 0);
  if (Math.abs(dir.y) > 0.95) _perpA.set(1, 0, 0);
  _perpA.cross(dir).normalize();
  _perpB.crossVectors(dir, _perpA).normalize();
  // Gaussian-ish distribution: most rounds land near the centre.
  const r = spread * Math.sqrt(-2 * Math.log(Math.max(Math.random(), 1e-6))) * 0.5;
  const a = Math.random() * Math.PI * 2;
  out.addScaledVector(_perpA, Math.cos(a) * Math.min(r, spread * 1.6))
    .addScaledVector(_perpB, Math.sin(a) * Math.min(r, spread * 1.6))
    .normalize();
  return out;
}

/**
 * Fires one trigger pull. Returns { hits: [{ soldier, killed, headshot, damage }] }.
 * options: shooterId, origin (muzzle), direction, weapon, spread, tracer (bool),
 * listenerPosition (for near-miss cracks), noiseRadius.
 */
export function fireRound({ shooterId, origin, direction, weapon, spread = 0, tracer = true, noiseRadius = 70 }) {
  const pellets = weapon.pellets || 1;
  const hits = [];
  const shooterTeam = combatSystem.get(shooterId)?.team;
  for (let i = 0; i < pellets; i += 1) {
    applySpread(direction, spread, _dir);
    const result = combatSystem.traceBullet(origin, _dir, weapon.range, shooterId);
    const end = result ? result.point : _end.copy(origin).addScaledVector(_dir, weapon.range);
    if (tracer && (i === 0 || pellets > 1 && i % 3 === 0)) fx.tracer(origin, end);
    if (result) {
      fx.impact(result.point, result.normal, result.surface);
      if (i < 2) audioManager.impact(result.surface, result.point);
      // Allies stop each other's rounds but take no damage from them.
      if (result.soldier && (!shooterTeam || combatSystem.isHostile(shooterTeam, result.soldier.team))) {
        const headshot = result.box.multiplier === 'head';
        const multiplier = headshot ? (weapon.headshotMultiplier || 2) : result.box.multiplier;
        // Shotgun pellets and long shots lose energy.
        const falloff = weapon.pellets ? THREE.MathUtils.clamp(1.4 - result.distance / 22, 0.25, 1) : THREE.MathUtils.clamp(1.15 - result.distance / (weapon.range * 1.4), 0.6, 1);
        const damage = weapon.damage * multiplier * falloff;
        const killed = combatSystem.applyDamage(result.soldier.id, damage, { from: origin, direction: _dir.clone(), part: result.box.part, headshot, shooterId });
        hits.push({ soldier: result.soldier, killed, headshot, damage });
      }
    }
    nearMiss(origin, end, shooterId);
  }
  combatSystem.emitNoise(origin, noiseRadius, shooterId);
  return { hits };
}

// A bullet passing close to the player's head gives the supersonic crack.
function nearMiss(from, to, shooterId) {
  const listener = audioManager.listenerPosition;
  const player = combatSystem.get('player');
  if (!listener || !player || shooterId === 'player' || !player.alive) return;
  _seg.subVectors(to, from);
  const length = _seg.length();
  if (length < 1) return;
  _seg.divideScalar(length);
  const t = THREE.MathUtils.clamp(_closest.subVectors(listener, from).dot(_seg), 0, length);
  _closest.copy(from).addScaledVector(_seg, t);
  if (_closest.distanceTo(listener) < 2.6 && t < length - 0.5) {
    audioManager.whiz(_closest);
    nearMissListeners.forEach((listenerFn) => listenerFn(_closest));
  }
}

const nearMissListeners = new Set();
export function onNearMiss(listenerFn) {
  nearMissListeners.add(listenerFn);
  return () => nearMissListeners.delete(listenerFn);
}
