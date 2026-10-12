import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { clone as cloneSkinnedModel } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { useGameStore } from '../store/gameStore';

const CHARACTER_MODEL = {
  male: '/assets/model/Superhero_Male_FullBody.gltf',
  female: '/assets/model/Superhero_Female_FullBody.gltf',
};
const COMBAT_ANIMATIONS = '/assets/model/CombatAnimations.glb';

/** Legacy Bot rig (FBX 7700). Paladin.fbx is FBX 6100 and is not supported by Three.js FBXLoader. */
const FBX_FALLBACK_MODEL = '/assets/characters/player.fbx';
const FBX_ANIMATION_FILES = {
  idle: '/assets/animations/idle.fbx',
  walk: '/assets/animations/walk.fbx',
  walk_back: '/assets/animations/walk_back.fbx',
  run: '/assets/animations/run.fbx',
  run_back: '/assets/animations/run_back.fbx',
  strafe_left: '/assets/animations/strafe_left.fbx',
  strafe_right: '/assets/animations/strafe_right.fbx',
  jump: '/assets/animations/jump.fbx',
  shoot: '/assets/animations/shoot.fbx',
  reload: '/assets/animations/reload.fbx',
  hit: '/assets/animations/hit.fbx',
  grenade: '/assets/animations/grenade.fbx',
  turn_left: '/assets/animations/turn_left.fbx',
  turn_right: '/assets/animations/turn_right.fbx',
};

const ANIMATION_BY_STATE = {
  idle: 'idle', walking: 'walk', walk: 'walk', running: 'run', run: 'run',
  backward: 'walk_back', run_back: 'run_back', strafe: 'strafe_right',
  strafe_left: 'strafe_left', strafe_right: 'strafe_right', jump: 'jump',
  shooting: 'shoot', shoot: 'shoot', reloading: 'reload', reload: 'reload',
  hit: 'hit', grenade: 'grenade', cover: 'idle', aiming: 'idle', dead: 'hit',
  turn_left: 'turn_left', turn_right: 'turn_right',
};

const GLTF_CLIP_BY_STATE = {
  idle: 'Idle_Loop',
  walking: 'Walk_Loop',
  walk: 'Walk_Loop',
  running: 'Walk_Loop',
  run: 'Walk_Loop',
  backward: 'Walk_Loop',
  run_back: 'Walk_Loop',
  strafe_left: 'Walk_Loop',
  strafe_right: 'Walk_Loop',
  jump: 'Idle_Loop',
  shooting: 'Pistol_Shoot',
  shoot: 'Pistol_Shoot',
  reloading: 'Pistol_Reload',
  reload: 'Pistol_Reload',
  hit: 'Hit_Chest',
  grenade: 'Idle_Loop',
  cover: 'Pistol_Aim_Neutral',
  aiming: 'Pistol_Aim_Neutral',
  dead: 'Death01',
  turn_left: 'Idle_Loop',
  turn_right: 'Idle_Loop',
};

const RUN_STATES = new Set(['running', 'run', 'run_back']);
const WALK_STATES = new Set(['walking', 'walk', 'backward', 'strafe_left', 'strafe_right']);

const TEAM_COLORS = {
  player:   { body: '#3a5a3a', accent: '#4a7a4a', marker: '#70dcff' },
  friendly: { body: '#2a3a6a', accent: '#3a5a9a', marker: '#78efc2' },
  enemy:    { body: '#6a2a2a', accent: '#9a3a3a', marker: '#ff5d69' },
  civilian: { body: '#5a5a4a', accent: '#7a7a5a', marker: '#e6d992' },
  police:   { body: '#1a2a4a', accent: '#2a4a7a', marker: '#68aaff' },
};

const gltfCache = new Map();
const fbxCache = new Map();

function loadGLTF(path) {
  if (!gltfCache.has(path)) {
    const request = new Promise((resolve, reject) => {
      new GLTFLoader().load(path, resolve, undefined, (cause) => {
        const error = new Error(`Unable to load GLTF: ${path}`, { cause });
        error.assetPath = path;
        reject(error);
      });
    });
    gltfCache.set(path, request);
    request.catch(() => { if (gltfCache.get(path) === request) gltfCache.delete(path); });
  }
  return gltfCache.get(path);
}

function loadFBX(path) {
  if (!fbxCache.has(path)) {
    const request = new Promise((resolve, reject) => {
      new FBXLoader().load(path, resolve, undefined, (cause) => {
        const error = new Error(`Unable to load FBX: ${path}`, { cause });
        error.assetPath = path;
        reject(error);
      });
    });
    fbxCache.set(path, request);
    request.catch(() => { if (fbxCache.get(path) === request) fbxCache.delete(path); });
  }
  return fbxCache.get(path);
}

function findBone(root, name) {
  let found = null;
  root.traverse((node) => {
    if (!found && node.isBone && node.name === name) found = node;
  });
  return found;
}

function normalizeCharacterScale(character, targetHeight = 1.82) {
  character.scale.setScalar(1);
  character.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(character);
  const height = bounds.getSize(new THREE.Vector3()).y;
  if (height > 0 && Math.abs(height - targetHeight) > 0.05) {
    character.scale.multiplyScalar(targetHeight / height);
  }
  character.updateMatrixWorld(true);
  const ground = new THREE.Box3().setFromObject(character);
  character.position.y -= ground.min.y;
  character.rotation.y = Math.PI;
}

function buildRifle() {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.4, metalness: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.6, metalness: 0.5 });
  const wood = new THREE.MeshStandardMaterial({ color: '#3a2a1a', roughness: 0.7 });

  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.5), metal);
  group.add(receiver);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 8), dark);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.01, 0.5);
  group.add(barrel);

  const handguard = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.3, 8), metal);
  handguard.rotation.x = Math.PI / 2;
  handguard.position.set(0, 0, 0.35);
  group.add(handguard);

  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.25), wood);
  stock.position.set(0, -0.01, -0.3);
  group.add(stock);

  const magazine = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.08), dark);
  magazine.position.set(0, -0.12, 0.05);
  magazine.rotation.x = -0.1;
  group.add(magazine);

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.05), dark);
  grip.position.set(0, -0.08, 0.08);
  grip.rotation.x = 0.3;
  group.add(grip);

  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 8), dark);
  scope.rotation.x = Math.PI / 2;
  scope.position.set(0, 0.08, 0.05);
  group.add(scope);

  group.traverse((n) => { if (n.isMesh) n.castShadow = true; });
  return group;
}

function buildTacticalKit(colors) {
  const kit = new THREE.Group();
  const vestMat = new THREE.MeshStandardMaterial({ color: colors.body, roughness: 0.88, metalness: 0.05 });
  const accentMat = new THREE.MeshStandardMaterial({ color: colors.accent, roughness: 0.82, metalness: 0.08 });
  const beltMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.9 });

  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.34, 0.24), vestMat);
  vest.position.set(0, 0.04, 0.06);
  kit.add(vest);

  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.2), accentMat);
  collar.position.set(0, 0.22, 0.04);
  kit.add(collar);

  const pouchL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.08), accentMat);
  pouchL.position.set(-0.16, -0.02, 0.14);
  kit.add(pouchL);

  const pouchR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.08), accentMat);
  pouchR.position.set(0.16, -0.02, 0.14);
  kit.add(pouchR);

  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.07, 0.2), beltMat);
  belt.position.set(0, -0.2, 0.02);
  kit.add(belt);

  kit.traverse((n) => { if (n.isMesh) n.castShadow = true; });
  return kit;
}

function applyTeamMaterials(character, colors) {
  const tint = new THREE.Color(colors.body);
  character.traverse((node) => {
    if (!node.isMesh) return;
    node.visible = true;
    node.castShadow = true;
    node.receiveShadow = true;
    if (node.isSkinnedMesh) node.frustumCulled = false;

    const materials = Array.isArray(node.material) ? node.material : [node.material];
    const updated = materials.map((source) => {
      if (!source) return source;
      const mat = source.clone();
      if (mat.map) {
        mat.color.lerp(tint, node.name.toLowerCase().includes('hair') ? 0 : 0.42);
      } else {
        mat.color.copy(tint);
      }
      mat.metalness = Math.min(mat.metalness ?? 0.1, 0.35);
      mat.roughness = Math.max(mat.roughness ?? 0.75, 0.55);
      mat.needsUpdate = true;
      return mat;
    });
    node.material = Array.isArray(node.material) ? updated : updated[0];
  });
}

function attachSoldierGear(character, colors) {
  const rifle = buildRifle();
  rifle.scale.setScalar(0.92);
  rifle.rotation.set(0, Math.PI / 2, 0);

  const hand = findBone(character, 'hand_r');
  if (hand) {
    rifle.position.set(0.04, 0.02, 0.08);
    rifle.rotation.set(-Math.PI / 2, 0, 0);
    hand.add(rifle);
  } else {
    rifle.position.set(0.22, 1.05, 0.12);
    character.add(rifle);
  }

  const kit = buildTacticalKit(colors);
  const spine = findBone(character, 'spine_03') || findBone(character, 'spine_02');
  if (spine) {
    kit.position.set(0, 0.08, 0.02);
    spine.add(kit);
  } else {
    kit.position.set(0, 1.25, 0.05);
    character.add(kit);
  }
  return rifle;
}

function prepareFBXCharacter(raw, colors) {
  const character = cloneSkinnedModel(raw);
  character.scale.setScalar(0.01);
  normalizeCharacterScale(character, 1.8);
  character.traverse((node) => {
    if (!node.isMesh) return;
    node.visible = true;
    node.castShadow = true;
    node.receiveShadow = true;
    if (node.isSkinnedMesh) node.frustumCulled = false;
    const applyTint = (mat) => {
      if (!mat) return mat;
      const m = mat.clone();
      m.color = new THREE.Color(colors.body);
      m.needsUpdate = true;
      return m;
    };
    if (Array.isArray(node.material)) node.material = node.material.map(applyTint);
    else node.material = applyTint(node.material);
  });
  attachSoldierGear(character, colors);
  return character;
}

function HumanoidFallback({ team }) {
  const colors = TEAM_COLORS[team] || TEAM_COLORS.player;
  const skin = new THREE.MeshStandardMaterial({ color: '#c4956a', roughness: 0.8 });
  const uniform = new THREE.MeshStandardMaterial({ color: colors.body, roughness: 0.85 });
  const accent = new THREE.MeshStandardMaterial({ color: colors.accent, roughness: 0.7 });
  const rifle = useMemo(() => buildRifle(), []);

  return (
    <group>
      <mesh position={[0, 1.6, 0]} material={skin} castShadow>
        <sphereGeometry args={[0.14, 12, 10]} />
      </mesh>
      <mesh position={[0, 1.35, 0]} material={uniform} castShadow>
        <capsuleGeometry args={[0.18, 0.5, 4, 8]} />
      </mesh>
      <mesh position={[-0.18, 1.35, 0]} material={uniform} castShadow>
        <capsuleGeometry args={[0.06, 0.3, 4, 8]} />
      </mesh>
      <mesh position={[0.18, 1.35, 0]} material={uniform} castShadow>
        <capsuleGeometry args={[0.06, 0.3, 4, 8]} />
      </mesh>
      <mesh position={[-0.1, 0.7, 0]} material={uniform} castShadow>
        <capsuleGeometry args={[0.07, 0.5, 4, 8]} />
      </mesh>
      <mesh position={[0.1, 0.7, 0]} material={uniform} castShadow>
        <capsuleGeometry args={[0.07, 0.5, 4, 8]} />
      </mesh>
      <mesh position={[0, 0.95, 0.05]} material={accent} castShadow>
        <boxGeometry args={[0.35, 0.25, 0.12]} />
      </mesh>
      <primitive object={rifle} position={[0.25, 1.2, 0.15]} />
    </group>
  );
}

export default function CharacterModel({
  team = 'player',
  state = 'idle',
  gender = 'male',
  showWeaponFlash = false,
}) {
  const mixerRef = useRef(null);
  const actionsRef = useRef({});
  const activeActionRef = useRef(null);
  const pipelineRef = useRef('gltf');
  const [model, setModel] = useState(null);
  const [assetErrors, setAssetErrors] = useState([]);
  const reportAssetError = useGameStore((store) => store.reportAssetError);
  const colors = TEAM_COLORS[team] || TEAM_COLORS.player;

  useEffect(() => {
    let cancelled = false;
    setModel(null);
    setAssetErrors([]);
    mixerRef.current?.stopAllAction();
    mixerRef.current = null;
    actionsRef.current = {};
    activeActionRef.current = null;

    const modelPath = CHARACTER_MODEL[gender] || CHARACTER_MODEL.male;

    const loadPrimary = async () => {
      const errors = [];
      try {
        const [characterGltf, animationGltf] = await Promise.all([
          loadGLTF(modelPath),
          loadGLTF(COMBAT_ANIMATIONS),
        ]);
        if (cancelled) return;

        const character = cloneSkinnedModel(characterGltf.scene);
        normalizeCharacterScale(character, 1.82);
        applyTeamMaterials(character, colors);
        attachSoldierGear(character, colors);

        const mixer = new THREE.AnimationMixer(character);
        mixerRef.current = mixer;
        pipelineRef.current = 'gltf';

        const actions = {};
        animationGltf.animations.forEach((clip) => {
          actions[clip.name] = mixer.clipAction(clip);
        });
        actionsRef.current = actions;
        setModel(character);
        setAssetErrors(errors);
      } catch (primaryError) {
        errors.push(`${modelPath}\n${primaryError.message}`);
        reportAssetError(modelPath);

        const animationEntries = Object.entries(FBX_ANIMATION_FILES);
        const [modelResult, ...animationResults] = await Promise.allSettled([
          loadFBX(FBX_FALLBACK_MODEL),
          ...animationEntries.map(([, path]) => loadFBX(path)),
        ]);
        if (cancelled) return;

        if (modelResult.status !== 'fulfilled') {
          const reason = modelResult.reason?.cause?.message || modelResult.reason?.message || 'FBX load failed';
          errors.push(`${FBX_FALLBACK_MODEL}\n${reason}`);
          reportAssetError(FBX_FALLBACK_MODEL);
          setAssetErrors(errors);
          return;
        }

        pipelineRef.current = 'fbx';
        const character = prepareFBXCharacter(modelResult.value, colors);
        const mixer = new THREE.AnimationMixer(character);
        mixerRef.current = mixer;
        const actions = {};
        animationResults.forEach((result, index) => {
          const [name, path] = animationEntries[index];
          if (result.status !== 'fulfilled') {
            errors.push(`${path}\n${result.reason?.message || 'FBX animation load failed'}`);
            reportAssetError(path);
            return;
          }
          const clip = result.value.animations?.[0];
          if (!clip) {
            errors.push(`${path}\nNo animations[0] found in this FBX.`);
            reportAssetError(path);
            return;
          }
          actions[name] = mixer.clipAction(clip);
        });
        actionsRef.current = actions;
        setModel(character);
        setAssetErrors(errors);
      }
    };

    loadPrimary();

    return () => {
      cancelled = true;
      mixerRef.current?.stopAllAction();
      if (mixerRef.current) mixerRef.current.uncacheRoot(mixerRef.current.getRoot());
      mixerRef.current = null;
      actionsRef.current = {};
      activeActionRef.current = null;
    };
  }, [team, gender, colors.body, colors.accent, reportAssetError]);

  useEffect(() => {
    if (!model) return;
    const pipeline = pipelineRef.current;
    const actionKey = pipeline === 'gltf'
      ? (GLTF_CLIP_BY_STATE[state] || 'Idle_Loop')
      : (ANIMATION_BY_STATE[state] || 'idle');

    const next = pipeline === 'gltf'
      ? actionsRef.current[actionKey]
      : actionsRef.current[actionKey];

    if (!next || next === activeActionRef.current) return;

    const loopingClips = pipeline === 'gltf'
      ? ['Idle_Loop', 'Walk_Loop', 'Pistol_Aim_Neutral']
      : ['idle', 'walk', 'run', 'walk_back', 'run_back', 'strafe_left', 'strafe_right'];

    const clipName = pipeline === 'gltf' ? actionKey : actionKey;
    const looping = loopingClips.includes(clipName);

    next.reset();
    next.setLoop(looping ? THREE.LoopRepeat : THREE.LoopOnce, looping ? Infinity : 1);
    next.clampWhenFinished = !looping;

    if (pipeline === 'gltf') {
      if (RUN_STATES.has(state)) next.timeScale = 1.85;
      else if (WALK_STATES.has(state)) next.timeScale = state.includes('back') ? -1.05 : 1.05;
      else next.timeScale = 1;
    } else {
      next.timeScale = 1;
    }

    next.fadeIn(0.16).play();
    activeActionRef.current?.fadeOut(0.16);
    activeActionRef.current = next;
  }, [model, state]);

  useFrame((_, delta) => mixerRef.current?.update(Math.min(delta, 0.05)));

  const assetLabel = pipelineRef.current === 'gltf'
    ? CHARACTER_MODEL[gender] || CHARACTER_MODEL.male
    : FBX_FALLBACK_MODEL;

  return (
    <group userData={{ isCharacter: true, asset: assetLabel }}>
      {model ? <primitive object={model} /> : <HumanoidFallback team={team} />}
      {team !== 'player' && (
        <group position={[0, 2.15, 0]}>
          <mesh>
            <sphereGeometry args={[0.055, 8, 6]} />
            <meshBasicMaterial color={colors.marker} />
          </mesh>
        </group>
      )}
      {assetErrors.length > 0 && (
        <Html position={[0, 2.1, 0]} center distanceFactor={12} style={{ pointerEvents: 'none' }}>
          <div role="alert" style={{ padding: '7px 10px', border: '1px solid #ff5365', background: '#160b10ee', color: '#ffabb2', font: '600 10px monospace', whiteSpace: 'pre-line', maxWidth: 360 }}>{assetErrors.join('\n')}</div>
        </Html>
      )}
      {showWeaponFlash && (
        <group position={[0.35, 1.15, 0.55]}>
          <mesh>
            <sphereGeometry args={[0.11, 8, 6]} />
            <meshBasicMaterial color="#ffe3a0" />
          </mesh>
          <pointLight color="#ffad45" intensity={5} distance={4} decay={2} />
        </group>
      )}
      {team === 'player' && model && (
        <pointLight position={[0, 1.4, 0.4]} color="#ffd8a8" intensity={0.55} distance={3.2} decay={2} />
      )}
    </group>
  );
}

export function CharacterHealthBar({ health, maxHealth, team, visible = true }) {
  if (!visible || health >= maxHealth) return null;
  const pct = Math.max(0, Math.min(1, health / maxHealth));
  const color = team === 'enemy' ? '#ff5365' : '#70dcff';
  return (
    <group position={[0, 2.35, 0]}>
      <mesh>
        <planeGeometry args={[0.72, 0.1]} />
        <meshBasicMaterial color="#090d12" transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[(pct - 1) * 0.34, 0, 0.001]}>
        <planeGeometry args={[0.66 * pct, 0.06]} />
        <meshBasicMaterial color={color} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
