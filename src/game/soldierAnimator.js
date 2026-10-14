// Shadow Strike: Last Stand - layered soldier animation.
// Legs and torso are separate layers. Locomotion clips are blended by
// direction and speed and play at the rate that matches ground speed (no foot
// sliding). The torso can aim, reload or flinch independently of the legs.
// All clip times are driven here; the mixer only evaluates and blends.
import * as THREE from 'three';

const boneOf = (track) => track.name.split('.')[0].replace('mixamorig', '');
const isLowerBone = (bone) => bone === 'Hips' || /(UpLeg|Leg|Foot|ToeBase|Toe_End)$/.test(bone);

// Gait reference speeds (m/s) for in-place clips that carry no root travel.
const SPRINT_SPEED = 5.6;
const CROUCH_SPEED = 1.1;

const DIRECTIONAL = {
  walk: { forward: 'walk', back: 'walk_back', left: 'strafe_left', right: 'strafe_right' },
  run: { forward: 'run', back: 'run_back', left: 'strafe_b', right: 'strafe_a' },
};

function filterClip(clip, keep, suffix) {
  const filtered = new THREE.AnimationClip(`${clip.name}_${suffix}`, clip.duration, clip.tracks.filter((track) => keep(boneOf(track))));
  return filtered;
}

export class SoldierAnimator {
  /** @param asset result of loadSoldier(): { clips, info, grip } (layer data is cached on it) */
  constructor(root, bones, asset) {
    this.root = root;
    this.bones = bones;
    this.info = asset.info;
    this.grip = asset.grip;
    this.mixer = new THREE.AnimationMixer(root);
    this.lower = {};
    this.upper = {};
    this.weights = new Map();
    this.durations = {};
    if (!asset.layerClips) {
      asset.layerClips = Object.fromEntries(Object.entries(asset.clips).map(([name, clip]) => [name, {
        lower: filterClip(clip, isLowerBone, 'lower'),
        upper: filterClip(clip, (bone) => !isLowerBone(bone), 'upper'),
      }]));
    }
    for (const [name, layers] of Object.entries(asset.layerClips)) {
      this.durations[name] = asset.clips[name].duration;
      this.lower[name] = this.makeAction(layers.lower);
      this.upper[name] = this.makeAction(layers.upper);
    }
    if (!asset.phaseOffsets) asset.phaseOffsets = this.measurePhaseOffsets(asset.clips);
    this.phaseOffset = asset.phaseOffsets;
    this.phase = { walk: 0, run: 0, sprint: 0, crouch: 0 };
    this.time = { idle: 0, crouch_idle: 0 };
    this.params = {
      speed: 0, dirX: 0, dirZ: 1, aim: 0, sprint: false, crouch: false, airborne: false,
      dead: false, reload: 0, reloading: false, hit: 0, pitch: 0, turnRate: 0, recoil: 0,
    };
    this.aimBlend = 0;
    this.deathTime = 0;
    this.airTime = 0;
    this.stepCallback = null;
    this.lastStepPhase = 0;
    this.spineBones = [bones.Spine, bones.Spine1, bones.Spine2].filter(Boolean);
  }

  makeAction(clip) {
    const action = this.mixer.clipAction(clip);
    action.play();
    action.timeScale = 0;
    action.enabled = false;
    action.setEffectiveWeight(0);
    this.weights.set(action, { current: 0, target: 0 });
    return action;
  }

  // Align locomotion cycles so blended clips plant the same foot together.
  measurePhaseOffsets(clips) {
    const offsets = {};
    const temp = new THREE.AnimationMixer(this.root);
    const left = this.bones.LeftFoot; const right = this.bones.RightFoot;
    const a = new THREE.Vector3(); const b = new THREE.Vector3();
    const names = ['walk', 'walk_back', 'strafe_left', 'strafe_right', 'run', 'run_back', 'strafe_a', 'strafe_b', 'sprint', 'crouch_walk'];
    for (const name of names) {
      const clip = clips[name];
      if (!clip) continue;
      const action = temp.clipAction(clip); action.play();
      let best = 0; let bestValue = -Infinity;
      for (let i = 0; i < 32; i += 1) {
        const t = (i / 32) * clip.duration;
        temp.setTime(t);
        this.root.updateMatrixWorld(true);
        const value = right.getWorldPosition(a).y - left.getWorldPosition(b).y;
        if (value > bestValue) { bestValue = value; best = i / 32; }
      }
      offsets[name] = best;
      action.stop();
      temp.uncacheClip(clip);
    }
    temp.stopAllAction();
    return offsets;
  }

  setTarget(layer, name, weight) {
    const action = layer[name];
    if (action) this.weights.get(action).target += weight;
  }

  setLoopTime(layer, name, phase) {
    const action = layer[name];
    if (!action) return;
    const offset = this.phaseOffset[name] || 0;
    action.time = THREE.MathUtils.euclideanModulo(phase + offset, 1) * this.durations[name];
  }

  directionalWeights(dirX, dirZ) {
    const forward = Math.max(0, dirZ); const back = Math.max(0, -dirZ);
    const left = Math.max(0, dirX); const right = Math.max(0, -dirX);
    const sum = forward + back + left + right || 1;
    return { forward: forward / sum, back: back / sum, left: left / sum, right: right / sum };
  }

  /** Adds the weights of one directional gait and advances its synced phase. */
  driveGait(set, gait, weight, speed, dirW, dt) {
    if (weight <= 0.0001) return;
    let refSpeed = 0; let duration = 0;
    for (const [dir, w] of Object.entries(dirW)) {
      if (w <= 0) continue;
      const name = set[dir];
      refSpeed += w * (this.info[name]?.speed || 1.2);
      duration += w * this.durations[name];
    }
    const rate = THREE.MathUtils.clamp(speed / Math.max(refSpeed, 0.1), 0.65, 1.7);
    this.phase[gait] = (this.phase[gait] + (dt * rate) / Math.max(duration, 0.1)) % 1;
    for (const [dir, w] of Object.entries(dirW)) {
      if (w <= 0) continue;
      const name = set[dir];
      this.setLoopTime(this.lower, name, this.phase[gait]);
      this.setLoopTime(this.upper, name, this.phase[gait]);
      this.setTarget(this.lower, name, weight * w);
      this.locomotionUpper.push([name, weight * w]);
    }
  }

  update(dt) {
    const p = this.params;
    for (const entry of this.weights.values()) entry.target = 0;
    this.locomotionUpper = [];
    const footPhaseBefore = this.phase.walk + this.phase.run + this.phase.sprint + this.phase.crouch;

    if (p.dead) {
      this.deathTime = Math.min(this.deathTime + dt, this.durations.death || 2);
      this.lower.death.time = this.deathTime; this.upper.death.time = this.deathTime;
      this.setTarget(this.lower, 'death', 1); this.setTarget(this.upper, 'death', 1);
    } else {
      this.deathTime = 0;
      let speed = p.speed; let dirX = p.dirX; let dirZ = p.dirZ;
      // Step the feet while turning on the spot instead of spinning on them.
      if (speed < 0.25 && Math.abs(p.turnRate) > 1.2 && !p.crouch && !p.airborne) {
        speed = Math.min(1.1, Math.abs(p.turnRate) * 0.35);
        dirX = p.turnRate > 0 ? 1 : -1; dirZ = 0;
      }
      if (p.airborne) {
        this.airTime += dt;
        const jumpTime = THREE.MathUtils.clamp(0.16 + this.airTime * 0.55, 0, (this.durations.jump || 0.6) * 0.8);
        this.lower.jump.time = jumpTime; this.upper.jump.time = jumpTime;
        this.setTarget(this.lower, 'jump', 1);
        this.locomotionUpper.push(['jump', 1]);
      } else if (p.crouch) {
        this.airTime = 0;
        const moving = THREE.MathUtils.clamp(speed / 0.6, 0, 1);
        this.time.crouch_idle = (this.time.crouch_idle + dt) % this.durations.crouch_idle;
        this.lower.crouch_idle.time = this.time.crouch_idle;
        this.setTarget(this.lower, 'crouch_idle', 1 - moving);
        if (moving > 0) {
          const back = dirZ < -0.3 ? -1 : 1;
          this.phase.crouch = THREE.MathUtils.euclideanModulo(this.phase.crouch + back * dt * THREE.MathUtils.clamp(speed / CROUCH_SPEED, 0.6, 1.6) / this.durations.crouch_walk, 1);
          this.setLoopTime(this.lower, 'crouch_walk', this.phase.crouch);
          this.setTarget(this.lower, 'crouch_walk', moving);
        }
        this.locomotionUpper.push(['idle', 1]);
      } else if (p.sprint && speed > 2) {
        this.airTime = 0;
        this.phase.sprint = (this.phase.sprint + dt * THREE.MathUtils.clamp(speed / SPRINT_SPEED, 0.7, 1.5) / this.durations.sprint) % 1;
        this.setLoopTime(this.lower, 'sprint', this.phase.sprint);
        this.setTarget(this.lower, 'sprint', 1);
        // Arms keep the rifle-carry of the run cycle, synced to the sprint stride.
        this.setLoopTime(this.upper, 'run', this.phase.sprint);
        this.locomotionUpper.push(['run', 1]);
      } else {
        this.airTime = 0;
        const dirW = this.directionalWeights(dirX, dirZ);
        const toWalk = THREE.MathUtils.clamp(speed / 0.9, 0, 1);
        const toRun = THREE.MathUtils.clamp((speed - 1.7) / 1.3, 0, 1);
        const idleW = 1 - toWalk;
        if (idleW > 0) {
          this.time.idle = (this.time.idle + dt) % this.durations.idle;
          this.lower.idle.time = this.time.idle; this.upper.idle.time = this.time.idle;
          this.setTarget(this.lower, 'idle', idleW);
          this.locomotionUpper.push(['idle', idleW]);
        }
        this.driveGait(DIRECTIONAL.walk, 'walk', toWalk * (1 - toRun), speed, dirW, dt);
        this.driveGait(DIRECTIONAL.run, 'run', toWalk * toRun, speed, dirW, dt);
      }

      // Torso: locomotion arms, blended toward the shouldered-rifle pose when aiming.
      const aimTarget = p.sprint && speed > 2 ? 0 : p.crouch ? 1 : p.aim;
      this.aimBlend = THREE.MathUtils.damp(this.aimBlend, aimTarget, 14, dt);
      const reloadW = p.reloading ? 1 : 0;
      const hitW = Math.max(0, p.hit) * 0.65;
      const free = (1 - reloadW) * (1 - hitW);
      for (const [name, w] of this.locomotionUpper) this.setTarget(this.upper, name, w * (1 - this.aimBlend) * free);
      if (this.aimBlend > 0) {
        this.upper.idle.time = this.time.idle;
        this.setTarget(this.upper, 'idle', this.aimBlend * free);
      }
      if (reloadW) {
        this.upper.reload.time = THREE.MathUtils.clamp(p.reload, 0, 0.999) * this.durations.reload;
        this.setTarget(this.upper, 'reload', 1);
      }
      if (hitW > 0) {
        this.upper.hit.time = (1 - p.hit) * this.durations.hit;
        this.setTarget(this.upper, 'hit', hitW * (1 - reloadW));
      }
    }

    // Cross-fade every action toward its target weight.
    const fade = p.dead ? 8 : 12;
    for (const [action, entry] of this.weights) {
      entry.current = THREE.MathUtils.damp(entry.current, entry.target, fade, dt);
      if (entry.target === 0 && entry.current < 0.002) entry.current = 0;
      action.enabled = entry.current > 0;
      action.setEffectiveWeight(entry.current);
    }
    this.mixer.update(0);
    this.applyProcedural(dt);

    if (this.stepCallback && !p.dead && !p.airborne) {
      const footPhase = this.phase.walk + this.phase.run + this.phase.sprint + this.phase.crouch;
      // Two footfalls per cycle.
      if (Math.floor(footPhase * 2) !== Math.floor(footPhaseBefore * 2) && p.speed > 0.4) this.stepCallback(p.speed);
    }
  }

  // Aim pitch and recoil are added on top of the blended pose.
  applyProcedural() {
    const p = this.params;
    if (p.dead || !this.spineBones.length) return;
    const influence = THREE.MathUtils.lerp(0.45, 1, this.aimBlend) * (p.reloading ? 0.5 : 1);
    const pitch = THREE.MathUtils.clamp((p.pitch - this.grip.aimPitch) * influence + p.recoil * 0.06, -1.1, 1.1);
    if (Math.abs(pitch) < 0.0005) return;
    this.root.updateMatrixWorld(true);
    _axis.set(-1, 0, 0).transformDirection(this.root.matrixWorld);
    const shares = [0.3, 0.3, 0.4];
    this.spineBones.forEach((bone, index) => {
      bone.parent.getWorldQuaternion(_parentQ);
      _delta.setFromAxisAngle(_axis, pitch * shares[index]);
      _local.copy(_parentQ).invert().multiply(_delta).multiply(_parentQ);
      bone.quaternion.premultiply(_local);
      bone.updateMatrixWorld(true);
    });
  }

  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
  }
}

const _axis = new THREE.Vector3();
const _parentQ = new THREE.Quaternion();
const _delta = new THREE.Quaternion();
const _local = new THREE.Quaternion();
