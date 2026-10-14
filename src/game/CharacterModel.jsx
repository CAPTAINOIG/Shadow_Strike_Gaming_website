// Shadow Strike: Last Stand - rigged soldier with layered animation and a held weapon.
// Controllers drive it through the imperative handle (animator params, muzzle,
// hitboxes) so per-frame animation never re-renders React.
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore, GAME_STATES } from '../store/gameStore';
import { createSoldierInstance, findBones, loadSoldier, loadWeapon, SOLDIER_PATH } from './soldierAssets';
import { SoldierAnimator } from './soldierAnimator';

const HITBOX_LAYOUT = [
  { part: 'head', from: 'Head', radius: 0.13, multiplier: 'head' },
  { part: 'torso', from: 'Hips', to: 'Neck', radius: 0.21, multiplier: 1 },
  { part: 'leg', from: 'LeftUpLeg', to: 'LeftFoot', radius: 0.11, multiplier: 0.75 },
  { part: 'leg', from: 'RightUpLeg', to: 'RightFoot', radius: 0.11, multiplier: 0.75 },
  { part: 'arm', from: 'LeftArm', to: 'LeftHand', radius: 0.075, multiplier: 0.7 },
  { part: 'arm', from: 'RightArm', to: 'RightHand', radius: 0.075, multiplier: 0.7 },
];

function createHandle() {
  const hitboxes = HITBOX_LAYOUT.map((entry) => ({ ...entry, a: new THREE.Vector3(), b: new THREE.Vector3() }));
  const handle = {
    ready: false,
    animator: null,
    bones: null,
    root: null,
    weapon: null,
    hitboxes,
    hitboxFrame: -1,
    /** World-space muzzle position (falls back to chest height when no weapon). */
    getMuzzle(target = new THREE.Vector3()) {
      if (handle.weapon) return handle.weapon.localToWorld(target.copy(handle.weapon.userData.muzzle));
      return handle.root ? handle.root.localToWorld(target.set(0, 1.4, 0.6)) : target.set(0, 1.4, 0);
    },
    getHead(target = new THREE.Vector3()) {
      return handle.bones?.Head ? handle.bones.Head.getWorldPosition(target).add(_up) : target.set(0, 1.7, 0);
    },
    /** Updates hitbox shapes from the current pose (at most once per frame). */
    updateHitboxes(frame) {
      if (!handle.bones || handle.hitboxFrame === frame) return handle.hitboxes;
      handle.hitboxFrame = frame;
      for (const box of handle.hitboxes) {
        handle.bones[box.from].getWorldPosition(box.a);
        if (box.to) handle.bones[box.to].getWorldPosition(box.b);
        else box.b.copy(box.a).add(_headTop);
        if (box.part === 'head') box.a.add(_headBase);
      }
      return handle.hitboxes;
    },
  };
  return handle;
}

const _up = new THREE.Vector3(0, 0.1, 0);
const _world = new THREE.Vector3();
const _headBase = new THREE.Vector3(0, 0.06, 0);
const _headTop = new THREE.Vector3(0, 0.16, 0);

const CharacterModel = forwardRef(function CharacterModel({ team = 'player', weapon = 'assault_rifle', onStep }, ref) {
  const groupRef = useRef();
  const handleRef = useRef(null);
  if (!handleRef.current) handleRef.current = createHandle();
  const [error, setError] = useState(null);
  const reportAssetError = useGameStore((store) => store.reportAssetError);
  const onStepRef = useRef(onStep);
  onStepRef.current = onStep;

  useImperativeHandle(ref, () => handleRef.current, []);

  useEffect(() => {
    let cancelled = false;
    let root = null;
    let animator = null;
    const handle = handleRef.current;
    loadSoldier().then((asset) => {
      if (cancelled || !groupRef.current) return;
      root = createSoldierInstance(asset, team);
      const bones = findBones(root);
      animator = new SoldierAnimator(root, bones, asset);
      animator.stepCallback = (speed) => onStepRef.current?.(speed);
      groupRef.current.add(root);
      Object.assign(handle, { root, bones, animator, ready: true });
      // Static pose for the first frame so nothing renders in bind pose.
      animator.update(0);
    }).catch((loadError) => {
      if (cancelled) return;
      reportAssetError(loadError.assetPath || SOLDIER_PATH);
      setError(loadError.message);
    });
    return () => {
      cancelled = true;
      if (root) root.removeFromParent();
      animator?.dispose();
      Object.assign(handle, { root: null, bones: null, animator: null, ready: false });
    };
  }, [team, reportAssetError]);

  // Weapon attaches to the right hand at the grip solved from the aiming pose.
  useEffect(() => {
    let cancelled = false;
    let model = null;
    const handle = handleRef.current;
    const attach = () => {
      if (cancelled) return;
      if (!handle.bones) { requestAnimationFrame(attach); return; }
      loadWeapon(weapon).then((instance) => {
        if (cancelled || !handle.bones) return;
        loadSoldier().then(({ grip }) => {
          if (cancelled || !handle.bones) return;
          instance.position.copy(grip.position);
          instance.quaternion.copy(grip.quaternion);
          instance.scale.copy(grip.scale);
          handle.bones.RightHand.add(instance);
          model = instance;
          handle.weapon = instance;
        });
      }).catch((loadError) => {
        if (!cancelled) reportAssetError(loadError.assetPath || weapon);
      });
    };
    attach();
    return () => {
      cancelled = true;
      if (model) model.removeFromParent();
      if (handle.weapon === model) handle.weapon = null;
    };
  }, [weapon, reportAssetError]);

  // Distant soldiers animate at half rate and stop casting shadows.
  const lod = useRef({ skip: 0, pending: 0, shadows: true });
  useFrame(({ camera }, delta) => {
    const handle = handleRef.current;
    const animator = handle.animator;
    if (!animator) return;
    if (useGameStore.getState().gameState === GAME_STATES.PAUSED) return;
    const distance = groupRef.current.getWorldPosition(_world).distanceTo(camera.position);
    // Never let another soldier fill the lens.
    if (team !== 'player') handle.root.visible = _world.setY(_world.y + 1.2).distanceTo(camera.position) > 1.1;
    const shadows = distance < 38;
    if (shadows !== lod.current.shadows) {
      lod.current.shadows = shadows;
      handle.root.traverse((node) => { if (node.isMesh) node.castShadow = shadows; });
    }
    lod.current.pending += delta;
    if (distance > 45 && (lod.current.skip = (lod.current.skip + 1) % 2) === 1) return;
    animator.update(Math.min(lod.current.pending, 0.1));
    lod.current.pending = 0;
  });

  return (
    <group ref={groupRef} userData={{ isCharacter: true }}>
      {error && (
        <Html position={[0, 2.1, 0]} center distanceFactor={12} style={{ pointerEvents: 'none' }}>
          <div role="alert" className="asset-inline-error">{error}</div>
        </Html>
      )}
    </group>
  );
});

export default CharacterModel;
