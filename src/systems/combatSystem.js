// Shadow Strike: Last Stand - Combat System Registry
// Shared singleton tracking all soldiers for AI targeting
import * as THREE from 'three';

class CombatSystem {
  constructor() {
    this.soldiers = new Map();
  }

  register(id, data) {
    this.soldiers.set(id, {
      id,
      team: data.team,          // 'player', 'friendly', 'enemy'
      position: new THREE.Vector3(data.x || 0, data.y || 0, data.z || 0),
      health: data.health || 100,
      maxHealth: data.health || 100,
      alive: true,
      ref: data.ref || null,
    });
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
    if (data.ref !== undefined) s.ref = data.ref;
  }

  get(id) {
    return this.soldiers.get(id);
  }

  // Get all living soldiers on the opposing team(s)
  getEnemiesOf(team) {
    const results = [];
    for (const [, s] of this.soldiers) {
      if (!s.alive) continue;
      if (team === 'enemy') {
        if (s.team === 'player' || s.team === 'friendly') results.push(s);
      } else {
        // player or friendly
        if (s.team === 'enemy' || s.team === 'civilian' || s.team === 'police') results.push(s);
      }
    }
    return results;
  }

  // Get nearest living enemy within range
  getNearestEnemy(position, team, range) {
    let nearest = null;
    let nearestDist = range;
    const enemies = this.getEnemiesOf(team);
    for (const e of enemies) {
      const dist = position.distanceTo(e.position);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = e;
      }
    }
    return nearest ? { soldier: nearest, distance: nearestDist } : null;
  }

  // Get all living friendlies (for HUD counting etc.)
  getFriendlyCount() {
    let count = 0;
    for (const [, s] of this.soldiers) {
      if (s.alive && s.team === 'friendly') count++;
    }
    return count;
  }

  getEnemyCount() {
    let count = 0;
    for (const [, s] of this.soldiers) {
      if (s.alive && s.team === 'enemy') count++;
    }
    return count;
  }

  clear() {
    this.soldiers.clear();
  }

  // Simple hit check: accuracy roll + distance falloff
  checkHit(accuracy, distance, maxRange) {
    const distanceFactor = 1 - (distance / maxRange) * 0.5;
    const hitChance = accuracy * distanceFactor;
    return Math.random() < hitChance;
  }
}

export const combatSystem = new CombatSystem();
