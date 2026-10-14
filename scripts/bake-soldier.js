// Offline bake: combines the Mixamo soldier mesh with the project's Mixamo rifle
// clips and a few Quaternius UAL clips (retargeted) into one GLB.
// Run with `node scripts/bake-soldier.cjs` while `npm run dev` is serving.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

const SOLDIER = '/asset-src/Soldier.glb';
const UAL = '/src/assets/character/Universal Animation Library[Standard]/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb';
const MIXAMO_DIR = '/assets/Basic Shooter Pack/';
const FPS = 30;

// Output clip name -> Mixamo FBX file. `loop` clips have their root travel removed.
const MIXAMO_CLIPS = {
  idle: { file: 'rifle aiming idle', loop: true },
  walk: { file: 'walking', loop: true },
  walk_back: { file: 'walking backwards', loop: true },
  run: { file: 'rifle run', loop: true },
  run_back: { file: 'run backwards', loop: true },
  strafe_left: { file: 'strafe left', loop: true },
  strafe_right: { file: 'strafe right', loop: true },
  strafe_a: { file: 'strafe', loop: true },
  strafe_b: { file: 'strafe (2)', loop: true },
  fire: { file: 'firing rifle', loop: false },
  reload: { file: 'reloading', loop: false },
  hit: { file: 'hit reaction', loop: false },
  jump: { file: 'rifle jump', loop: false },
  grenade: { file: 'toss grenade', loop: false },
  turn_left: { file: 'turn left', loop: false },
  turn_right: { file: 'turning right 45 degrees', loop: false },
};

// Output clip name -> UAL clip (UE-mannequin skeleton, retargeted in world space).
const UAL_CLIPS = {
  death: { clip: 'Death01', loop: false },
  sprint: { clip: 'Sprint_Loop', loop: true },
  crouch_idle: { clip: 'Crouch_Idle_Loop', loop: true },
  crouch_walk: { clip: 'Crouch_Fwd_Loop', loop: true },
  hit_head: { clip: 'Hit_Head', loop: false },
};

const UE_TO_MIXAMO = {
  pelvis: 'Hips', spine_01: 'Spine', spine_02: 'Spine1', spine_03: 'Spine2', neck_01: 'Neck', Head: 'Head',
  clavicle_l: 'LeftShoulder', upperarm_l: 'LeftArm', lowerarm_l: 'LeftForeArm', hand_l: 'LeftHand',
  clavicle_r: 'RightShoulder', upperarm_r: 'RightArm', lowerarm_r: 'RightForeArm', hand_r: 'RightHand',
  thigh_l: 'LeftUpLeg', calf_l: 'LeftLeg', foot_l: 'LeftFoot', ball_l: 'LeftToeBase',
  thigh_r: 'RightUpLeg', calf_r: 'RightLeg', foot_r: 'RightFoot', ball_r: 'RightToeBase',
};
for (const side of ['l', 'r']) {
  const S = side === 'l' ? 'Left' : 'Right';
  for (const [ue, mx] of [['thumb', 'Thumb'], ['index', 'Index'], ['middle', 'Middle'], ['ring', 'Ring'], ['pinky', 'Pinky']]) {
    for (let i = 1; i <= 3; i += 1) UE_TO_MIXAMO[`${ue}_0${i}_${side}`] = `${S}Hand${mx}${i}`;
  }
}

const log = [];
const v = () => new THREE.Vector3();
const q = () => new THREE.Quaternion();

function bonesByName(root, prefix = '') {
  const map = new Map();
  root.traverse((node) => { if (node.isBone) map.set(node.name.replace(prefix, ''), node); });
  return map;
}

// Direction the rig faces in world space, from the hip line (left x up).
function facingAngle(bones, leftName, rightName) {
  const left = bones.get(leftName).getWorldPosition(v()).sub(bones.get(rightName).getWorldPosition(v()));
  const forward = left.cross(new THREE.Vector3(0, 1, 0)).setY(0).normalize();
  return Math.atan2(forward.x, forward.z);
}

function sampleTimes(duration) {
  const count = Math.max(2, Math.round(duration * FPS) + 1);
  return Array.from({ length: count }, (_, i) => (i / (count - 1)) * duration);
}

function stripRootTravel(values, times, keepY = true) {
  const n = times.length;
  const x0 = values[0]; const z0 = values[2];
  const x1 = values[(n - 1) * 3]; const z1 = values[(n - 1) * 3 + 2];
  const duration = times[n - 1] || 1;
  for (let i = 0; i < n; i += 1) {
    const a = times[i] / duration;
    values[i * 3] -= x0 + (x1 - x0) * a;
    values[i * 3 + 2] -= z0 + (z1 - z0) * a;
    if (!keepY) values[i * 3 + 1] = values[1];
  }
  return { dx: x1 - x0, dz: z1 - z0 };
}

async function main() {
  const gltf = await new GLTFLoader().loadAsync(SOLDIER);
  const soldier = gltf.scene;
  soldier.updateMatrixWorld(true);
  const tBones = bonesByName(soldier, 'mixamorig');
  const tHips = tBones.get('Hips');
  const tParentQ = tHips.parent.getWorldQuaternion(q());
  const tParentScale = tHips.parent.getWorldScale(v()).x;
  const tHipHeight = tHips.getWorldPosition(v()).y;
  const tFacing = facingAngle(tBones, 'LeftUpLeg', 'RightUpLeg');
  log.push(`target hip height ${tHipHeight.toFixed(3)} facing ${(tFacing * 57.3).toFixed(1)}deg`);

  const clips = [];
  const info = {};

  // --- Mixamo -> Mixamo: identical local bone frames, only the hip frame differs.
  const fbx = new FBXLoader();
  for (const [name, spec] of Object.entries(MIXAMO_CLIPS)) {
    const source = await fbx.loadAsync(`${MIXAMO_DIR}${spec.file}.fbx`);
    source.updateMatrixWorld(true);
    const sBones = bonesByName(source, 'mixamorig');
    const sHips = sBones.get('Hips');
    const sParentQ = sHips.parent.getWorldQuaternion(q());
    const sHipHeight = sHips.getWorldPosition(v()).y;
    // Every baked clip faces +Z so all of them share one forward axis.
    const align = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -facingAngle(sBones, 'LeftUpLeg', 'RightUpLeg'));
    const scale = tHipHeight / sHipHeight; // source world units -> metres on this soldier
    const clip = source.animations[0].clone();
    clip.name = name;
    const toTarget = tParentQ.clone().invert().multiply(align).multiply(sParentQ);
    let travel = { dx: 0, dz: 0 };
    clip.tracks = clip.tracks.filter((track) => {
      if (track.name.endsWith('.scale')) return false;
      if (track.name.endsWith('.position') && !track.name.startsWith('mixamorigHips.')) return false;
      return true;
    });
    for (const track of clip.tracks) {
      if (track.name === 'mixamorigHips.quaternion') {
        const value = q();
        for (let i = 0; i < track.values.length; i += 4) {
          value.fromArray(track.values, i).premultiply(toTarget).toArray(track.values, i);
        }
      } else if (track.name === 'mixamorigHips.position') {
        const values = track.values;
        // World-space, metres.
        const world = v();
        for (let i = 0; i < values.length; i += 3) {
          world.fromArray(values, i).applyQuaternion(sParentQ).applyQuaternion(align).multiplyScalar(sHips.parent.getWorldScale(v()).x * scale);
          world.toArray(values, i);
        }
        if (spec.loop) travel = stripRootTravel(values, track.times);
        else {
          // One-shots keep their vertical motion but stay anchored horizontally.
          const x0 = values[0]; const z0 = values[2];
          for (let i = 0; i < values.length; i += 3) { values[i] -= x0; values[i + 2] -= z0; }
        }
        for (let i = 0; i < values.length; i += 3) {
          world.fromArray(values, i).applyQuaternion(tParentQ.clone().invert()).divideScalar(tParentScale);
          world.toArray(values, i);
        }
      }
    }
    const speed = Math.hypot(travel.dx, travel.dz) / clip.duration;
    info[name] = { duration: +clip.duration.toFixed(3), speed: +speed.toFixed(3), dir: [+(travel.dx / (clip.duration || 1)).toFixed(3), +(travel.dz / (clip.duration || 1)).toFixed(3)], loop: spec.loop };
    clips.push(clip);
  }

  // --- UAL (UE mannequin) -> Mixamo, world-space rotation deltas from a shared T-pose.
  const ualGltf = await new GLTFLoader().loadAsync(UAL);
  const ual = ualGltf.scene;
  const sBones = bonesByName(ual);
  const sMixer = new THREE.AnimationMixer(ual);
  const tpose = ualGltf.animations.find((clip) => clip.name === 'A_TPose');
  const tposeAction = sMixer.clipAction(tpose); tposeAction.play(); sMixer.setTime(0);
  ual.updateMatrixWorld(true);
  const sFacing = facingAngle(sBones, 'thigh_l', 'thigh_r');
  const sRef = new Map();
  for (const ueName of Object.keys(UE_TO_MIXAMO)) sRef.set(ueName, sBones.get(ueName).getWorldQuaternion(q()));
  const sRefHips = sBones.get('pelvis').getWorldPosition(v());
  const ualScale = tHipHeight / sRefHips.y;
  tposeAction.stop();
  log.push(`UAL facing ${(sFacing * 57.3).toFixed(1)}deg hip ${sRefHips.y.toFixed(3)}`);

  const alignSource = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -sFacing);
  const alignTarget = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -tFacing);
  const work = cloneSkinned(soldier);
  work.updateMatrixWorld(true);
  const wBones = bonesByName(work, 'mixamorig');
  const tRef = new Map();
  for (const [name, bone] of wBones) tRef.set(name, alignTarget.clone().multiply(bone.getWorldQuaternion(q())));
  const restLocal = new Map([...wBones].map(([name, bone]) => [name, { q: bone.quaternion.clone(), p: bone.position.clone() }]));
  const mixamoOrder = [];
  work.traverse((node) => { if (node.isBone) mixamoOrder.push(node.name.replace('mixamorig', '')); });
  const ueByMixamo = Object.fromEntries(Object.entries(UE_TO_MIXAMO).map(([ue, mx]) => [mx, ue]));

  for (const [name, spec] of Object.entries(UAL_CLIPS)) {
    const sourceClip = ualGltf.animations.find((clip) => clip.name === spec.clip);
    const action = sMixer.clipAction(sourceClip); action.play();
    const times = sampleTimes(sourceClip.duration);
    const rotationValues = new Map(mixamoOrder.map((bone) => [bone, new Float32Array(times.length * 4)]));
    const hipValues = new Float32Array(times.length * 3);
    times.forEach((time, frame) => {
      sMixer.setTime(time);
      ual.updateMatrixWorld(true);
      for (const [boneName, bone] of wBones) { bone.quaternion.copy(restLocal.get(boneName).q); bone.position.copy(restLocal.get(boneName).p); }
      work.updateMatrixWorld(true);
      for (const boneName of mixamoOrder) {
        const bone = wBones.get(boneName);
        const ueName = ueByMixamo[boneName];
        if (ueName) {
          const current = alignSource.clone().multiply(sBones.get(ueName).getWorldQuaternion(q()));
          const reference = alignSource.clone().multiply(sRef.get(ueName));
          const desired = current.multiply(reference.invert()).multiply(tRef.get(boneName));
          const parentWorld = bone.parent.getWorldQuaternion(q());
          bone.quaternion.copy(parentWorld.invert().multiply(desired));
          bone.updateMatrixWorld(true);
        }
        bone.quaternion.toArray(rotationValues.get(boneName), frame * 4);
      }
      // World space (Y up) for now; converted to the armature's local space below.
      const hips = sBones.get('pelvis').getWorldPosition(v()).sub(sRefHips).applyQuaternion(alignSource).multiplyScalar(ualScale);
      hips.y += tHipHeight;
      hips.toArray(hipValues, frame * 3);
    });
    action.stop();
    const tracks = [];
    for (const boneName of mixamoOrder) {
      if (!ueByMixamo[boneName]) continue;
      tracks.push(new THREE.QuaternionKeyframeTrack(`mixamorig${boneName}.quaternion`, times, rotationValues.get(boneName)));
    }
    if (spec.loop) stripRootTravel(hipValues, times);
    const toLocal = tParentQ.clone().invert();
    for (let i = 0; i < hipValues.length; i += 3) {
      v().fromArray(hipValues, i).applyQuaternion(toLocal).divideScalar(tParentScale).toArray(hipValues, i);
    }
    tracks.push(new THREE.VectorKeyframeTrack('mixamorigHips.position', times, hipValues));
    const clip = new THREE.AnimationClip(name, sourceClip.duration, tracks);
    clip.optimize();
    info[name] = { duration: +clip.duration.toFixed(3), speed: 0, loop: spec.loop };
    clips.push(clip);
  }

  soldier.userData.clipInfo = info;
  const exporter = new GLTFExporter();
  const glb = await exporter.parseAsync(soldier, { binary: true, animations: clips, onlyVisible: false });
  const bytes = new Uint8Array(glb);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  window.__bake = { base64: btoa(binary), info, log };
  document.title = 'BAKED';
}

main().catch((error) => { window.__bake = { error: `${error.message}\n${error.stack}` }; document.title = 'BAKED'; });
