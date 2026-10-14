// Shadow Strike: Last Stand - soldier and weapon asset loading.
// The soldier GLB is baked by scripts/bake-soldier.cjs and contains the mesh,
// the Mixamo skeleton and every gameplay clip, all facing +Z.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

export const SOLDIER_PATH = '/assets/soldier/soldier.glb';

// Model-space measurements of each weapon: where the right hand grips it, where
// the muzzle is, which model axis the barrel points along, and the scale that
// gives it real-world length.
export const WEAPON_MODELS = {
  assault_rifle: { path: '/assets/weapons/m4.glb', axis: '-z', scale: 0.19, grip: [0, -0.3, 0.64], muzzle: [0, 0.07, -2.31] },
  enemy_rifle: { path: '/assets/weapons/ak47.glb', axis: '-z', scale: 0.19, grip: [0, -0.29, 1.3], muzzle: [0, 0.06, -1.98] },
  shotgun: { path: '/assets/weapons/shotgun.glb', axis: '+x', scale: 0.173, grip: [0.33, -0.15, 0], muzzle: [4.35, 0.22, 0] },
  sniper: { path: '/assets/props/ph/bolt_action_rifle_7_62/bolt_action_rifle_7_62_1k.gltf', axis: '+x', scale: 1, grip: [-0.3, -0.04, 0], muzzle: [0.59, 0.05, 0] },
};

const TEAM_TINT = {
  player: null,
  friendly: new THREE.Color('#a9b48c'),
  enemy: new THREE.Color('#5f5d58'),
  boss: new THREE.Color('#47484d'),
};

const loader = new GLTFLoader();
const requests = new Map();

function load(path) {
  if (!requests.has(path)) {
    const request = loader.loadAsync(path).catch((cause) => {
      requests.delete(path);
      const error = new Error(`Unable to load ${path}`, { cause });
      error.assetPath = path;
      throw error;
    });
    requests.set(path, request);
  }
  return requests.get(path);
}

let soldierRequest = null;

/** Loads the soldier once and derives the weapon grip from the aiming pose. */
export function loadSoldier() {
  if (!soldierRequest) {
    soldierRequest = load(SOLDIER_PATH).then((gltf) => {
      const clips = Object.fromEntries(gltf.animations.map((clip) => [clip.name, clip]));
      const info = gltf.scene.userData.clipInfo || {};
      const grip = computeHandGrip(gltf.scene, clips.idle);
      return { gltf, clips, info, grip, materials: new Map() };
    }).catch((error) => { soldierRequest = null; throw error; });
  }
  return soldierRequest;
}

export function findBones(root) {
  const bones = {};
  root.traverse((node) => { if (node.isBone) bones[node.name.replace('mixamorig', '')] = node; });
  return bones;
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

function palm(bones, side) {
  return bones[`${side}Hand`].getWorldPosition(_a).clone()
    .lerp(bones[`${side}HandMiddle1`].getWorldPosition(_b), 0.6);
}

/**
 * Poses a temporary skeleton in the rifle-aiming idle and solves where a weapon
 * (origin at its grip, barrel along +Z) sits: grip in the right palm, barrel
 * running through the left hand. The result is stored in right-hand bone space,
 * so every animation carries the weapon with the hand.
 */
function computeHandGrip(scene, idleClip) {
  const temp = cloneSkinned(scene);
  const mixer = new THREE.AnimationMixer(temp);
  if (idleClip) { mixer.clipAction(idleClip).play(); mixer.update(idleClip.duration * 0.5); }
  temp.updateMatrixWorld(true);
  const bones = findBones(temp);
  const right = palm(bones, 'Right');
  const left = palm(bones, 'Left');
  const towardSupport = left.clone().sub(right).normalize();
  const side = new THREE.Vector3().crossVectors(towardSupport, new THREE.Vector3(0, 1, 0)).normalize();
  // The support hand sits a few centimetres above the grip, so tilt the bore down.
  const forward = towardSupport.clone().applyAxisAngle(side, -0.13).normalize();
  const up = new THREE.Vector3().crossVectors(side, forward).normalize();
  const xAxis = new THREE.Vector3().crossVectors(up, forward).normalize();
  const world = new THREE.Matrix4().makeBasis(xAxis, up, forward).setPosition(right);
  const local = bones.RightHand.matrixWorld.clone().invert().multiply(world);
  const position = new THREE.Vector3(); const quaternion = new THREE.Quaternion(); const scale = new THREE.Vector3();
  local.decompose(position, quaternion, scale);
  // Barrel direction relative to the body in the aiming pose (body faces +Z).
  const aimYaw = Math.atan2(forward.x, forward.z);
  const aimPitch = Math.asin(THREE.MathUtils.clamp(forward.y, -1, 1));
  mixer.stopAllAction();
  return { position, quaternion, scale, aimYaw, aimPitch, shoulderHeight: right.y };
}

const weaponTemplates = new Map();

function tuneWeaponMaterials(object) {
  object.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach((material) => {
      if (!material || material.map) return;
      const hsl = {}; material.color?.getHSL(hsl);
      if (hsl.l !== undefined && hsl.l < 0.22) { material.metalness = 0.55; material.roughness = 0.42; } else { material.roughness = Math.min(material.roughness ?? 0.8, 0.72); }
    });
  });
}

/** Weapon wrapper: origin at the grip, barrel along +Z, metres. */
export function loadWeapon(id) {
  const spec = WEAPON_MODELS[id] || WEAPON_MODELS.assault_rifle;
  if (!weaponTemplates.has(spec.path)) {
    weaponTemplates.set(spec.path, load(spec.path).then((gltf) => {
      const model = gltf.scene;
      tuneWeaponMaterials(model);
      const yaw = spec.axis === '-z' ? Math.PI : spec.axis === '+x' ? -Math.PI / 2 : spec.axis === '-x' ? Math.PI / 2 : 0;
      const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      const grip = new THREE.Vector3(...spec.grip).applyQuaternion(rotation).multiplyScalar(spec.scale);
      const muzzle = new THREE.Vector3(...spec.muzzle).applyQuaternion(rotation).multiplyScalar(spec.scale).sub(grip);
      const wrapper = new THREE.Group();
      wrapper.name = `weapon_${id}`;
      model.quaternion.copy(rotation);
      model.scale.setScalar(spec.scale);
      model.position.copy(grip).negate();
      wrapper.add(model);
      wrapper.userData.muzzle = muzzle;
      return wrapper;
    }).catch((error) => { weaponTemplates.delete(spec.path); throw error; }));
  }
  return weaponTemplates.get(spec.path).then((template) => {
    const instance = template.clone(true);
    instance.userData.muzzle = template.userData.muzzle.clone();
    return instance;
  });
}

/** A new skinned soldier with team-specific (shared) materials. */
export function createSoldierInstance(asset, team = 'player') {
  const root = cloneSkinned(asset.gltf.scene);
  const tint = TEAM_TINT[team] || null;
  const key = team in TEAM_TINT ? team : 'player';
  root.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    // Cull off-screen soldiers: bind-pose bounds, enlarged to cover any animation.
    if (node.isSkinnedMesh) {
      if (!node.geometry.boundingSphere) node.geometry.computeBoundingSphere();
      node.boundingSphere = node.geometry.boundingSphere.clone();
      node.boundingSphere.radius *= 1.8;
    }
    const cacheKey = `${key}:${node.material.uuid}`;
    if (!asset.materials.has(cacheKey)) {
      const material = node.material.clone();
      if (material.map) material.map.anisotropy = 4;
      const isVisor = /visor/i.test(material.name);
      material.roughness = isVisor ? 0.25 : 0.82;
      material.metalness = isVisor ? 0.6 : 0.08;
      if (tint && !isVisor) material.color.copy(tint);
      asset.materials.set(cacheKey, material);
    }
    node.material = asset.materials.get(cacheKey);
  });
  return root;
}
