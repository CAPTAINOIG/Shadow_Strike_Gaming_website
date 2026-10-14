// Shadow Strike: Last Stand - tactical soldier AI shared by enemies and squad.
// Perception is limited to field of view, distance and real line of sight
// (walls and cover block it) plus hearing gunfire. Combat uses cover found
// by testing sight lines from the threat, peek-and-fire bursts, reloads,
// suppression and flanking. Navigation uses the grid built from the colliders.
import * as THREE from 'three';
import { collisionWorld } from '../../systems/collisionWorld';
import { navGrid } from '../../systems/navGrid';
import { combatSystem } from '../../systems/combatSystem';
import { fireRound } from '../../systems/ballistics';
import { audioManager } from '../../systems/audioManager';
import { fx } from '../../systems/fx';

const RADIUS = 0.34;
const yawOf = (x, z) => Math.atan2(-x, -z);
const angleDelta = (a, b) => THREE.MathUtils.euclideanModulo(b - a + Math.PI, Math.PI * 2) - Math.PI;
const rand = (a, b) => a + Math.random() * (b - a);

const brains = new Map();
export const getBrains = () => brains;

export class SoldierBrain {
  constructor({ id, team, stats, spawn, patrol = [], weapon, boss = false, followSlot = null }) {
    this.id = id;
    this.team = team;
    this.stats = stats;
    this.weapon = weapon;
    this.boss = boss;
    this.followSlot = followSlot;
    this.pos = new THREE.Vector3(spawn.x, 0, spawn.z);
    // Defenders hold their sector: they only leave it to fight a target they can see.
    this.home = new THREE.Vector3(spawn.x, 0, spawn.z);
    this.leash = followSlot ? Infinity : boss ? 14 : 26;
    this.vel = new THREE.Vector3();
    this.yaw = spawn.yaw ?? (team === 'enemy' ? Math.PI : 0);
    this.bodyYaw = this.yaw;
    this.patrol = patrol.map(([x, z]) => new THREE.Vector3(x, 0, z));
    this.patrolIndex = 0;
    this.waitUntil = 0;
    this.state = followSlot ? 'follow' : 'patrol';
    this.health = stats.health;
    this.alive = true;
    this.awareness = 0;
    this.target = null;
    this.lastKnown = new THREE.Vector3();
    this.hasLastKnown = false;
    this.lastSeen = -100;
    this.visibleTarget = false;
    this.path = [];
    this.pathIndex = 0;
    this.pathGoal = new THREE.Vector3();
    this.repathAt = 0;
    this.moveGoal = null;
    this.moveSpeed = 0;
    this.crouch = false;
    this.aiming = false;
    this.cover = null;
    this.coverSince = 0;
    this.decideAt = 0;
    this.peekUntil = 0;
    this.hideUntil = 0;
    this.mag = weapon.magSize;
    this.reloadUntil = 0;
    this.reloadStart = 0;
    this.burstLeft = 0;
    this.nextShot = 0;
    this.burstReadyAt = 0;
    this.reactionUntil = 0;
    this.suppression = 0;
    this.hitFlinch = 0;
    this.perceiveAt = Math.random() * 0.2;
    this.searchUntil = 0;
    this.lookYaw = this.yaw;
    this.lookAroundAt = 0;
    this.flankTried = 0;
    this.shotsAtTarget = 0;
    this.eye = new THREE.Vector3();
    this.aimPoint = new THREE.Vector3();
    this.onKilled = null;
    this.onAlert = null;
    brains.set(id, this);
  }

  dispose() { brains.delete(this.id); }

  // ------------------------------------------------------------------ senses

  eyePosition(out = this.eye) {
    return out.set(this.pos.x, this.pos.y + (this.crouch ? 1.12 : 1.58), this.pos.z);
  }

  targetPoint(soldier, out, part = 'chest') {
    const crouched = soldier.crouching;
    const y = part === 'head' ? (crouched ? 1.18 : 1.62) : (crouched ? 0.85 : 1.25);
    return out.set(soldier.position.x, soldier.position.y + y, soldier.position.z);
  }

  /** Unaware soldiers notice much less than alert ones. */
  sightRange() {
    return this.state === 'combat' || this.state === 'alert' ? this.stats.detectionRange : this.stats.detectionRange * 0.5;
  }

  canSee(soldier, now) {
    const eye = this.eyePosition(_eye);
    const dx = soldier.position.x - this.pos.x; const dz = soldier.position.z - this.pos.z;
    const distance = Math.hypot(dx, dz);
    if (distance > this.sightRange() * (soldier.crouching ? 0.7 : 1)) return false;
    const facing = this.state === 'combat' && now - this.lastSeen < 4 ? Math.PI : Math.PI * 0.4;
    if (distance > 4 && Math.abs(angleDelta(this.bodyYaw, yawOf(dx, dz))) > facing) return false;
    if (collisionWorld.hasLineOfSight(eye, this.targetPoint(soldier, _tp, 'head'))) return true;
    return collisionWorld.hasLineOfSight(eye, this.targetPoint(soldier, _tp, 'chest'));
  }

  perceive(now, dt) {
    let best = null; let bestScore = 0;
    for (const soldier of combatSystem.getEnemiesOf(this.team)) {
      if (!this.canSee(soldier, now)) continue;
      const distance = soldier.position.distanceTo(this.pos);
      const score = Math.max(0.05, 1 - distance / this.sightRange()) * (soldier.crouching ? 0.55 : 1) + (soldier === this.target ? 0.3 : 0);
      if (score > bestScore) { bestScore = score; best = soldier; }
    }
    this.visibleTarget = Boolean(best);
    if (best) {
      if (best !== this.target && this.state === 'combat' && this.target?.alive && now - this.lastSeen < 1) {
        // Keep the current target unless the new one is much closer.
        if (best.position.distanceTo(this.pos) > this.target.position.distanceTo(this.pos) * 0.6) best = this.target;
      }
      this.target = best;
      // Awareness builds over time: a distant glimpse takes seconds, close contact is instant.
      const gain = (0.15 + bestScore * bestScore * 4) * (this.state === 'combat' || this.state === 'alert' ? 3 : 1);
      this.awareness = Math.min(1.2, this.awareness + gain * dt);
      this.lastKnown.copy(best.position); this.hasLastKnown = true;
      this.lastSeen = now;
      if (this.awareness >= 1 && this.state !== 'combat') this.enterCombat(now);
      else if (this.awareness > 0.35 && (this.state === 'patrol' || this.state === 'search')) this.investigate(best.position, now, false);
    } else if (this.state !== 'combat') {
      this.awareness = Math.max(0, this.awareness - dt * 0.08);
    }
  }

  hearNoise({ position, radius, sourceId, team }, now) {
    if (!this.alive || sourceId === this.id) return;
    const distance = position.distanceTo(this.pos);
    if (distance > radius) return;
    // Walls muffle sound: occluded shots are only heard at 60% range.
    if (distance > radius * 0.6 && !collisionWorld.hasLineOfSight(this.eyePosition(_eye), _tp.copy(position))) return;
    if (team && combatSystem.isHostile(this.team, team)) {
      if (this.state === 'combat') { if (now - this.lastSeen > 3) { this.lastKnown.copy(position); this.hasLastKnown = true; } return; }
      this.awareness = Math.max(this.awareness, 0.6);
      this.investigate(position, now, true);
    } else if (team === this.team && this.state !== 'combat' && this.state !== 'follow') {
      // Friendly gunfire: move up to support.
      this.investigate(position, now, true, 6);
    }
  }

  /** Radio call-out from a squad-mate who has spotted a hostile. */
  receiveCallout(position, now) {
    if (!this.alive || this.state === 'combat') return;
    this.awareness = Math.max(this.awareness, 0.75);
    this.investigate(position, now, true, 4);
  }

  onDamage(amount, info, now) {
    if (!this.alive) return false;
    this.health -= amount;
    this.hitFlinch = 1;
    this.suppression = Math.min(1, this.suppression + 0.5);
    if (this.health <= 0) { this.die(info); return true; }
    const shooter = combatSystem.get(info.shooterId);
    if (shooter && combatSystem.isHostile(this.team, shooter.team)) {
      this.target = shooter;
      this.lastKnown.copy(shooter.position); this.hasLastKnown = true;
      this.lastSeen = Math.max(this.lastSeen, now - 0.5);
      this.awareness = 1.2;
      if (this.state !== 'combat') this.enterCombat(now);
      // Taking fire in the open forces a move to cover.
      if (!this.crouch || !this.cover) this.decideAt = 0;
    }
    return false;
  }

  die(info) {
    this.alive = false;
    this.state = 'dead';
    this.health = 0;
    this.vel.set(0, 0, 0);
    audioManager.bodyFall(this.pos);
    this.onKilled?.(info);
  }

  // ------------------------------------------------------------------ states

  enterCombat(now) {
    this.state = 'combat';
    this.awareness = Math.max(this.awareness, 1);
    this.reactionUntil = now + this.stats.reaction * rand(0.8, 1.4);
    this.decideAt = 0;
    this.burstReadyAt = this.reactionUntil;
    this.onAlert?.(this.lastKnown);
  }

  investigate(position, now, run, scatter = 2.5) {
    if (this.state === 'follow' && this.followSlot) return;
    this.state = 'alert';
    this.searchUntil = now + rand(9, 14);
    _tmp.set(position.x + rand(-scatter, scatter), 0, position.z + rand(-scatter, scatter));
    const fromHome = _tmp.distanceTo(this.home);
    if (fromHome > this.leash) _tmp.sub(this.home).multiplyScalar(this.leash / fromHome).add(this.home);
    this.setGoal(_tmp, run ? this.stats.speed * 0.85 : 1.6, now);
    this.aiming = true;
  }

  setGoal(point, speed, now) {
    this.moveSpeed = speed;
    if (this.moveGoal && this.moveGoal.distanceTo(point) < 0.6 && this.path.length) return;
    this.moveGoal = (this.moveGoal || new THREE.Vector3()).copy(point);
    this.path = navGrid.findPath(this.pos, point) || [];
    this.pathIndex = 0;
    this.repathAt = now + 2.5;
  }

  clearGoal() { this.moveGoal = null; this.path = []; this.moveSpeed = 0; }

  /** Picks a nearby cell that hides us (crouched) from the threat yet lets us fire standing. */
  findCover(threat, now, { nearTo = null, maxRadius = 14, preferredRange = [10, 32] } = {}) {
    if (!navGrid.ready) return null;
    const center = nearTo || this.pos;
    const threatEye = _te.set(threat.x, threat.y + 1.5, threat.z);
    let best = null; let bestScore = Infinity;
    for (let i = 0; i < 70; i += 1) {
      const a = Math.random() * Math.PI * 2; const r = Math.sqrt(Math.random()) * maxRadius;
      const index = navGrid.index(center.x + Math.cos(a) * r, center.z + Math.sin(a) * r);
      if (!navGrid.walkable(index) || navGrid.cover[index] < 85) continue;
      const cell = navGrid.center(index, _cell);
      const range = Math.hypot(cell.x - threat.x, cell.z - threat.z);
      if (range < 6 || range > this.stats.attackRange) continue;
      if (collisionWorld.hasLineOfSight(threatEye, _low.set(cell.x, 0.95, cell.z))) continue; // not hidden when crouched
      const canPeek = collisionWorld.hasLineOfSight(_high.set(cell.x, 1.55, cell.z), _tp.set(threat.x, threat.y + 1.2, threat.z));
      let score = Math.hypot(cell.x - this.pos.x, cell.z - this.pos.z) * 1.2;
      if (!canPeek) score += 14;
      if (range < preferredRange[0]) score += (preferredRange[0] - range) * 2;
      if (range > preferredRange[1]) score += (range - preferredRange[1]) * 0.8;
      for (const other of brains.values()) {
        if (other !== this && other.alive && other.cover && other.cover.distanceTo(cell) < 2.2) score += 20;
      }
      if (score < bestScore) { bestScore = score; best = cell.clone(); best.canPeek = canPeek; }
    }
    return best;
  }

  /** A point to the side of the threat, out of its current line of fire. */
  findFlank(threat) {
    const toUs = _tmp.subVectors(this.pos, threat).setY(0).normalize();
    const side = Math.random() < 0.5 ? 1 : -1;
    const perp = new THREE.Vector3(-toUs.z * side, 0, toUs.x * side);
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const distance = rand(12, 20);
      const p = threat.clone().addScaledVector(perp, distance).addScaledVector(toUs, rand(2, 8));
      const index = navGrid.nearestWalkable(p.x, p.z, 3);
      if (index < 0) continue;
      const cell = navGrid.center(index);
      if (collisionWorld.hasLineOfSight(_high.set(cell.x, 1.55, cell.z), _tp.set(threat.x, threat.y + 1.2, threat.z))) return cell;
    }
    return null;
  }

  // ------------------------------------------------------------------ update

  update(dt, now, handle) {
    if (!this.alive) {
      if (handle?.animator) handle.animator.params.dead = true;
      return;
    }
    this.suppression = Math.max(0, this.suppression - dt * 0.25);
    this.hitFlinch = Math.max(0, this.hitFlinch - dt * 2.5);

    this.perceiveAt -= dt;
    if (this.perceiveAt <= 0) { this.perceive(now, 0.2 - this.perceiveAt); this.perceiveAt = 0.2; }
    if (this.target && !this.target.alive) {
      this.target = null;
      if (this.state === 'combat') { this.state = 'search'; this.searchUntil = now + 8; this.clearGoal(); }
    }

    if (this.state === 'combat') this.updateCombat(dt, now);
    else if (this.state === 'alert' || this.state === 'search') this.updateSearch(dt, now);
    else if (this.state === 'follow') this.updateFollow(dt, now);
    else this.updatePatrol(dt, now);

    this.updateReload(now);
    this.move(dt, now);
    this.updateFacing(dt, now);
    this.driveAnimator(handle, dt, now);
  }

  updatePatrol(dt, now) {
    this.aiming = false; this.crouch = false;
    if (!this.patrol.length) { this.lookAround(now); return; }
    const point = this.patrol[this.patrolIndex];
    if (now < this.waitUntil) { this.clearGoal(); this.lookAround(now); return; }
    if (Math.hypot(point.x - this.pos.x, point.z - this.pos.z) < 0.9) {
      this.patrolIndex = (this.patrolIndex + 1) % this.patrol.length;
      this.waitUntil = now + rand(2, 5);
      this.clearGoal();
      return;
    }
    this.setGoal(point, 1.35, now);
  }

  lookAround(now) {
    if (now > this.lookAroundAt) {
      this.lookYaw = this.bodyYaw + rand(-1.2, 1.2);
      this.lookAroundAt = now + rand(2.5, 5);
    }
  }

  updateSearch(dt, now) {
    this.crouch = false; this.aiming = true;
    if (now > this.searchUntil) {
      this.awareness = 0;
      this.state = this.followSlot ? 'follow' : 'patrol';
      this.aiming = false;
      this.clearGoal();
      return;
    }
    if (!this.moveGoal || this.pos.distanceTo(this.moveGoal) < 1.2) { this.clearGoal(); this.lookAround(now); }
  }

  updateFollow(dt, now) {
    this.aiming = false; this.crouch = false;
    const leader = combatSystem.get('player');
    if (!leader) return;
    const leaderYaw = leader.yaw ?? 0;
    const [ox, oz] = this.followSlot;
    const c = Math.cos(leaderYaw); const s = Math.sin(leaderYaw);
    const slot = _tmp.set(leader.position.x + ox * c + oz * s, 0, leader.position.z - ox * s + oz * c);
    const distance = Math.hypot(slot.x - this.pos.x, slot.z - this.pos.z);
    if (distance > 1.6) this.setGoal(slot, distance > 9 ? 4.6 : distance > 4 ? 3.4 : 1.5, now);
    else { this.clearGoal(); this.lookYaw = leaderYaw; }
    if (leader.crouching) this.crouch = distance < 2.5;
  }

  updateCombat(dt, now) {
    this.aiming = true;
    const target = this.target;
    const sinceSeen = now - this.lastSeen;
    const threat = target && this.visibleTarget ? target.position : this.lastKnown;

    // Lost contact: advance carefully on the last known position.
    if (sinceSeen > 6 || !target) {
      this.state = 'alert';
      this.cover = null;
      this.investigate(this.lastKnown, now, false, 2);
      this.searchUntil = now + 12;
      return;
    }

    // Tactical decision: cover, reposition or flank.
    if (now > this.decideAt) {
      this.decideAt = now + rand(2.2, 4);
      const coverCompromised = this.cover && collisionWorld.hasLineOfSight(_te.set(threat.x, threat.y + 1.5, threat.z), _low.set(this.cover.x, 0.95, this.cover.z));
      const tooFar = threat.distanceTo(this.pos) > this.stats.attackRange;
      const longInCover = this.cover && now - this.coverSince > rand(7, 12);
      if (this.followSlot) {
        const leader = combatSystem.get('player');
        const anchor = leader ? leader.position : this.pos;
        if (!this.cover || coverCompromised || this.cover.distanceTo(anchor) > 14) {
          const cover = this.findCover(threat, now, { nearTo: anchor, maxRadius: 10 });
          if (cover) { this.cover = cover; this.coverSince = now; this.setGoal(cover, 3.6, now); }
        }
      } else if (longInCover && Math.random() < this.stats.aggression && now - this.flankTried > 12) {
        this.flankTried = now;
        const flank = this.findFlank(threat);
        if (flank) { this.cover = null; this.setGoal(flank, this.stats.speed, now); this.crouch = false; }
      } else if (!this.cover || coverCompromised || tooFar || longInCover) {
        const cover = this.findCover(threat, now, { maxRadius: tooFar ? 22 : 13 });
        if (cover) { this.cover = cover; this.coverSince = now; this.setGoal(cover, this.stats.speed, now); } else if (tooFar) {
          // No cover between us: close the distance anyway.
          this.setGoal(threat, this.stats.speed * 0.8, now);
        }
      }
    }

    const inCover = this.cover && Math.hypot(this.cover.x - this.pos.x, this.cover.z - this.pos.z) < 0.8;
    if (inCover) this.clearGoal();
    const reloading = now < this.reloadUntil;

    // Peek-and-fire rhythm while in cover; hide while reloading or suppressed.
    if (inCover) {
      if (reloading || now < this.hideUntil) this.crouch = true;
      else if (now > this.peekUntil) {
        if (this.crouch) { this.crouch = false; this.peekUntil = now + rand(1.6, 3.2) * (1 - this.suppression * 0.5); } else { this.crouch = true; this.hideUntil = now + rand(0.8, 2) * (1 + this.suppression); this.peekUntil = this.hideUntil; }
      }
    } else if (!this.moveGoal) {
      // In the open: crouch to fire if under heavy fire.
      this.crouch = this.suppression > 0.6;
    } else this.crouch = false;

    // Fire when the target is actually in sight.
    if (!reloading && this.visibleTarget && target && now > this.reactionUntil) this.tryFire(now, target);
  }

  tryFire(now, target) {
    if (now < this.burstReadyAt || now < this.nextShot) return;
    if (this.burstLeft <= 0) {
      const [lo, hi] = this.stats.burst;
      this.burstLeft = Math.round(rand(lo, hi));
    }
    // Must be roughly facing the target before shooting.
    const dx = target.position.x - this.pos.x; const dz = target.position.z - this.pos.z;
    if (Math.abs(angleDelta(this.bodyYaw, yawOf(dx, dz))) > 0.35) return;
    if (!this.handle?.weapon) return;
    const muzzle = this.handle.getMuzzle(_muzzle);
    const eye = this.eyePosition(_eye);
    const aimPart = Math.random() < 0.18 ? 'head' : 'chest';
    this.targetPoint(target, this.aimPoint, aimPart);
    if (!collisionWorld.hasLineOfSight(eye, this.aimPoint)) this.targetPoint(target, this.aimPoint, aimPart === 'head' ? 'chest' : 'head');
    // Inaccuracy grows with distance, target movement, suppression and the first shots of an engagement.
    const distance = Math.hypot(dx, dz);
    const targetSpeed = target.id === 'player' ? (target.speed || 0) : 0;
    const settle = THREE.MathUtils.clamp((now - this.reactionUntil) / 2.5, 0, 1);
    const errorRadius = distance * (0.02 + (1 - this.stats.accuracy) * 0.055) * (1 + targetSpeed * 0.12) * (1 + this.suppression * 0.9) * (1.6 - settle * 0.6) * (target.crouching ? 0.85 : 1) + 0.12;
    this.aimPoint.x += rand(-errorRadius, errorRadius) * 0.8;
    this.aimPoint.y += rand(-errorRadius, errorRadius) * 0.5;
    this.aimPoint.z += rand(-errorRadius, errorRadius) * 0.8;
    const direction = _dir.subVectors(this.aimPoint, muzzle).normalize();
    // Never shoot through our own cover: if the barrel is blocked, wait.
    const blocked = collisionWorld.raycast(eye, _tmp.subVectors(muzzle, eye).normalize(), eye.distanceTo(muzzle), (c) => c.bullets);
    if (blocked) { this.crouch = false; return; }
    fireRound({ shooterId: this.id, origin: muzzle, direction, weapon: this.weapon, spread: 0, tracer: true, noiseRadius: 80 });
    fx.muzzleFlash(muzzle, direction, 0.9);
    const eject = _tmp.copy(muzzle).addScaledVector(direction, -0.42);
    fx.shell(eject, new THREE.Vector3(-direction.z * 1.8, 1.6, direction.x * 1.8));
    audioManager.gunshot(this.weapon.sound, muzzle);
    if (this.handle.animator) this.handle.animator.params.recoil = Math.min(1.4, this.handle.animator.params.recoil + 0.6);
    this.mag -= 1;
    this.burstLeft -= 1;
    this.nextShot = now + this.weapon.fireRate * rand(1, 1.35);
    if (this.burstLeft <= 0) this.burstReadyAt = now + rand(0.5, 1.3) * (1 + this.suppression);
    if (this.mag <= 0) {
      this.reloadStart = now;
      this.reloadUntil = now + this.weapon.reloadTime;
      this.crouch = true;
      audioManager.reload(this.weapon.reloadTime, this.pos);
    }
  }

  updateReload(now) {
    if (this.reloadUntil && now >= this.reloadUntil) { this.reloadUntil = 0; this.mag = this.weapon.magSize; }
  }

  move(dt, now) {
    let wantX = 0; let wantZ = 0;
    if (this.moveGoal) {
      if ((!this.path.length || now > this.repathAt) && navGrid.ready) {
        this.path = navGrid.findPath(this.pos, this.moveGoal) || [];
        this.pathIndex = 0;
        this.repathAt = now + 2.5;
      }
      let waypoint = this.path[this.pathIndex];
      while (waypoint && Math.hypot(waypoint.x - this.pos.x, waypoint.z - this.pos.z) < 0.6 && this.pathIndex < this.path.length - 1) {
        this.pathIndex += 1; waypoint = this.path[this.pathIndex];
      }
      if (waypoint) {
        const dx = waypoint.x - this.pos.x; const dz = waypoint.z - this.pos.z;
        const d = Math.hypot(dx, dz);
        const last = this.pathIndex === this.path.length - 1;
        if (last && d < 0.35) this.clearGoal();
        else {
          const speed = this.crouch ? Math.min(this.moveSpeed, 1.3) : this.moveSpeed;
          const arrive = last ? Math.min(1, d / 1.2) : 1;
          wantX = (dx / d) * speed * arrive; wantZ = (dz / d) * speed * arrive;
        }
      } else this.clearGoal();
    }
    // Keep a little space between soldiers.
    for (const other of brains.values()) {
      if (other === this || !other.alive) continue;
      const dx = this.pos.x - other.pos.x; const dz = this.pos.z - other.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.01 && d < 1) { wantX += (dx / d) * (1 - d) * 2.5; wantZ += (dz / d) * (1 - d) * 2.5; }
    }
    const player = combatSystem.get('player');
    if (player?.alive) {
      const dx = this.pos.x - player.position.x; const dz = this.pos.z - player.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.01 && d < 0.9) { wantX += (dx / d) * (0.9 - d) * 4; wantZ += (dz / d) * (0.9 - d) * 4; }
    }
    this.vel.x = THREE.MathUtils.damp(this.vel.x, wantX, 8, dt);
    this.vel.z = THREE.MathUtils.damp(this.vel.z, wantZ, 8, dt);
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    collisionWorld.resolveCircle(this.pos, RADIUS, this.pos.y, 1.7, 0.45);
    this.pos.y = THREE.MathUtils.damp(this.pos.y, collisionWorld.supportHeight(this.pos.x, this.pos.z, RADIUS, this.pos.y, 0.45), 18, dt);
  }

  updateFacing(dt, now) {
    const speed = Math.hypot(this.vel.x, this.vel.z);
    let targetYaw = this.lookYaw;
    if (this.state === 'combat' && this.hasLastKnown) {
      const threat = this.visibleTarget && this.target ? this.target.position : this.lastKnown;
      targetYaw = yawOf(threat.x - this.pos.x, threat.z - this.pos.z) - (this.grip?.aimYaw || 0);
    } else if (speed > 0.4) targetYaw = yawOf(this.vel.x, this.vel.z);
    else if (this.state === 'alert' && this.moveGoal) targetYaw = yawOf(this.moveGoal.x - this.pos.x, this.moveGoal.z - this.pos.z);
    const turn = angleDelta(this.bodyYaw, targetYaw);
    const rate = this.state === 'combat' ? 7 : 4.5;
    const step = THREE.MathUtils.clamp(turn * (1 - Math.exp(-rate * dt)), -5 * dt, 5 * dt);
    this.bodyYaw += step;
    this.turnRate = step / Math.max(dt, 1e-4);
    if (this.state !== 'combat' && speed > 0.4) this.lookYaw = this.bodyYaw;
    void now;
  }

  driveAnimator(handle, dt, now) {
    this.handle = handle;
    const animator = handle?.animator;
    if (!animator) return;
    const p = animator.params;
    const speed = Math.hypot(this.vel.x, this.vel.z);
    const fwdX = -Math.sin(this.bodyYaw); const fwdZ = -Math.cos(this.bodyYaw);
    const leftX = -Math.cos(this.bodyYaw); const leftZ = Math.sin(this.bodyYaw);
    p.speed = speed;
    if (speed > 0.05) { p.dirZ = (this.vel.x * fwdX + this.vel.z * fwdZ) / speed; p.dirX = (this.vel.x * leftX + this.vel.z * leftZ) / speed; }
    p.aim = this.aiming ? 1 : 0;
    p.crouch = this.crouch;
    p.sprint = speed > 4.2;
    p.dead = !this.alive;
    p.turnRate = speed < 0.3 ? this.turnRate : 0;
    p.reloading = now < this.reloadUntil;
    p.reload = p.reloading ? (now - this.reloadStart) / this.weapon.reloadTime : 0;
    p.hit = this.hitFlinch;
    p.recoil = Math.max(0, p.recoil - dt * 8);
    // Aim pitch toward the target (or level).
    if (this.state === 'combat' && this.target) {
      const shoulder = this.pos.y + (this.crouch ? 1.0 : 1.4);
      const tp = this.targetPoint(this.target, _tp);
      p.pitch = Math.atan2(tp.y - shoulder, Math.max(1, Math.hypot(tp.x - this.pos.x, tp.z - this.pos.z)));
    } else p.pitch = THREE.MathUtils.damp(p.pitch, -0.08, 3, dt);
  }
}

const _eye = new THREE.Vector3();
const _tp = new THREE.Vector3();
const _te = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _cell = new THREE.Vector3();
const _low = new THREE.Vector3();
const _high = new THREE.Vector3();
const _muzzle = new THREE.Vector3();
const _dir = new THREE.Vector3();
