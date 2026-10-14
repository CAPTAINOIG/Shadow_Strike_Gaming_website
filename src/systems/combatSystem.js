// Shadow Strike: Last Stand - combat registry and ballistics.
// Tracks every soldier, traces bullets against the static world and per-bone
// hitboxes, routes damage, and broadcasts gunfire noise for AI hearing.
import * as THREE from 'three';
import { collisionWorld, rayCapsule } from './collisionWorld';

const HOSTILE = {
  enemy: ['player', 'friendly'],
  player: ['enemy'],
  friendly: ['enemy'],
};

class CombatSystem {
  constructor() {
    this.soldiers = new Map();
    this.noiseListeners = new Set();
    this.frame = 0;
  }

  register(id, data) {
    this.soldiers.set(id, {
      id,
      team: data.team,
      position: new THREE.Vector3(data.x || 0, data.y || 0, data.z || 0),
      health: data.health || 100,
      maxHealth: data.maxHealth || data.health || 100,
      alive: true,
      crouching: false,
      handle: data.handle || null,
      onDamage: data.onDamage || null,
      name: data.name || id,
    });
    return this.soldiers.get(id);
  }

  unregister(id) {
    this.soldiers.delete(id);
  }

  update(id, data) {
    const s = this.soldiers.get(id);
    if (!s) return;
    if (data.position) s.position.copy(data.position);
    if (data.x !== undefined) s.position.x = data.x;
    if (data.y !== undefined) s.position.y = data.y;
    if (data.z !== undefined) s.position.z = data.z;
    if (data.health !== undefined) s.health = data.health;
    if (data.alive !== undefined) s.alive = data.alive;
    if (data.crouching !== undefined) s.crouching = data.crouching;
    if (data.handle !== undefined) s.handle = data.handle;
    if (data.onDamage !== undefined) s.onDamage = data.onDamage;
  }

  get(id) {
    return this.soldiers.get(id);
  }

  isHostile(teamA, teamB) {
    return (HOSTILE[teamA] || []).includes(teamB);
  }

  getEnemiesOf(team) {
    const hostile = HOSTILE[team] || [];
    const results = [];
    for (const s of this.soldiers.values()) if (s.alive && hostile.includes(s.team)) results.push(s);
    return results;
  }

  getNearestEnemy(position, team, range) {
    let nearest = null;
    let nearestDist = range;
    for (const e of this.getEnemiesOf(team)) {
      const dist = position.distanceTo(e.position);
      if (dist < nearestDist) { nearestDist = dist; nearest = e; }
    }
    return nearest ? { soldier: nearest, distance: nearestDist } : null;
  }

  getFriendlyCount() {
    let count = 0;
    for (const s of this.soldiers.values()) if (s.alive && s.team === 'friendly') count += 1;
    return count;
  }

  getEnemyCount() {
    let count = 0;
    for (const s of this.soldiers.values()) if (s.alive && s.team === 'enemy') count += 1;
    return count;
  }

  clear() {
    this.soldiers.clear();
  }

  beginFrame() {
    this.frame += 1;
  }

  hitboxesOf(soldier) {
    if (soldier.handle?.ready) return soldier.handle.updateHitboxes(this.frame);
    // Model still loading: a simple standing capsule.
    const p = soldier.position;
    return [{ part: 'torso', a: new THREE.Vector3(p.x, p.y + 0.3, p.z), b: new THREE.Vector3(p.x, p.y + 1.6, p.z), radius: 0.28, multiplier: 1 }];
  }

  /** Nearest character hit along a ray, ignoring `ignoreId` and the dead. */
  raycastCharacters(origin, dir, maxDistance, ignoreId) {
    let best = null;
    for (const soldier of this.soldiers.values()) {
      if (!soldier.alive || soldier.id === ignoreId) continue;
      // Broad phase: distance from the ray to the soldier's vertical axis.
      _toSoldier.subVectors(soldier.position, origin);
      const along = _toSoldier.x * dir.x + _toSoldier.z * dir.z;
      const flat = Math.hypot(dir.x, dir.z) || 1;
      if (along < -1 || along / flat > maxDistance + 1) continue;
      const lateral = Math.abs(_toSoldier.x * dir.z - _toSoldier.z * dir.x) / flat;
      if (lateral > 1.4) continue;
      for (const box of this.hitboxesOf(soldier)) {
        const t = rayCapsule(origin, dir, box.a, box.b, box.radius, best ? best.distance : maxDistance);
        if (t !== null && (!best || t < best.distance)) best = { soldier, box, distance: t };
      }
    }
    return best;
  }

  /**
   * Full bullet trace: whichever comes first of world geometry or a hitbox.
   * Returns { point, normal, distance, surface, soldier?, box? } or null.
   */
  traceBullet(origin, dir, range, ignoreId) {
    const world = collisionWorld.raycast(origin, dir, range, (c) => c.bullets);
    const limit = world ? world.distance : range;
    const character = this.raycastCharacters(origin, dir, limit, ignoreId);
    if (character) {
      const point = origin.clone().addScaledVector(dir, character.distance);
      const normal = dir.clone().negate();
      return { point, normal, distance: character.distance, surface: 'flesh', soldier: character.soldier, box: character.box };
    }
    if (!world) return null;
    return { point: world.point, normal: world.normal, distance: world.distance, surface: world.surface };
  }

  /** Applies damage through the soldier's controller. Returns true if it killed. */
  applyDamage(targetId, amount, info = {}) {
    const target = this.soldiers.get(targetId);
    if (!target || !target.alive) return false;
    if (target.onDamage) return Boolean(target.onDamage(amount, info));
    target.health = Math.max(0, target.health - amount);
    if (target.health <= 0) target.alive = false;
    return !target.alive;
  }

  onNoise(listener) {
    this.noiseListeners.add(listener);
    return () => this.noiseListeners.delete(listener);
  }

  /** Gunfire, explosions and so on: heard by AI within `radius` metres. */
  emitNoise(position, radius, sourceId, kind = 'gunfire') {
    const source = this.soldiers.get(sourceId);
    for (const listener of this.noiseListeners) listener({ position, radius, sourceId, team: source?.team, kind });
  }
}

const _toSoldier = new THREE.Vector3();

export const combatSystem = new CombatSystem();
