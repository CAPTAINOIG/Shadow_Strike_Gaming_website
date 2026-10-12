import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { clone as cloneSkinnedModel } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { loadGLTF } from './assetLoader';
import { LEVEL_ASSETS } from './assetManifest';
import { useGameStore } from '../store/gameStore';

const PLACEMENTS = {
  swamp: [
    { path: LEVEL_ASSETS.swamp[0], position: [0, -0.2, -28], scale: [90, 1, 130] },
    { path: LEVEL_ASSETS.swamp[1], position: [-9, 0, -23], rotation: [0, 0.12, 0] },
    { path: LEVEL_ASSETS.swamp[1], position: [12, 0, -47], rotation: [0, -0.28, 0], scale: 0.8 },
    { path: LEVEL_ASSETS.swamp[2], position: [-5, 0, -17], scale: 1.4 },
    { path: LEVEL_ASSETS.swamp[2], position: [8, 0, -36], scale: 1.6 },
    { path: LEVEL_ASSETS.swamp[3], position: [-18, 0, -42], scale: 2 },
    { path: LEVEL_ASSETS.swamp[3], position: [18, 0, -27], scale: 2 },
    { path: LEVEL_ASSETS.swamp[4], position: [0, -0.1, -32], scale: [70, 1, 90] },
    { path: '/assets/models/props/cover_wall.glb', position: [-3, 0, -20], rotation: [0, 0.4, 0] },
    { path: '/assets/models/props/sci_fi_crate.glb', position: [4, 0, -30] },
  ],
  snow: [
    { path: LEVEL_ASSETS.snow[0], position: [0, -0.2, -28], scale: [90, 1, 130] },
    { path: LEVEL_ASSETS.snow[1], position: [-11, 0, -27], rotation: [0, 0.1, 0] },
    { path: LEVEL_ASSETS.snow[1], position: [13, 0, -50], rotation: [0, -0.2, 0], scale: 0.85 },
    { path: LEVEL_ASSETS.snow[2], position: [7, 0, -38], rotation: [0, -0.45, 0] },
    { path: LEVEL_ASSETS.snow[3], position: [-8, 0, -24], scale: 1.5 },
    { path: LEVEL_ASSETS.snow[3], position: [9, 0, -58], scale: 1.7 },
    { path: LEVEL_ASSETS.snow[4], position: [0, 0, -36] },
    { path: '/assets/models/props/cover_wall.glb', position: [-3, 0, -20], rotation: [0, 0.4, 0] },
    { path: '/assets/models/props/sci_fi_crate.glb', position: [4, 0, -30] },
  ],
};

function LevelAsset({ path, position, rotation = [0, 0, 0], scale = 1 }) {
  const renderer = useThree((state) => state.gl);
  const [object, setObject] = useState(null);
  const reportAssetError = useGameStore((state) => state.reportAssetError);
  useEffect(() => {
    let cancelled = false;
    loadGLTF(path, renderer).then((gltf) => {
      if (cancelled) return;
      const clone = cloneSkinnedModel(gltf.scene);
      clone.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
          node.frustumCulled = true;
          const isOpenSurface = /ground|grass|foliage|water|mud|fog|snow_piles/i.test(path);
          node.userData.cameraObstacle = !isOpenSurface;
          node.userData.coverSurface = /cover_wall|ruins|wrecked_armored_vehicle/i.test(path);
        }
      });
      setObject(clone);
    }).catch((error) => {
      if (cancelled) return;
      reportAssetError(error.assetPath || path);
    });
    return () => { cancelled = true; };
  }, [path, renderer, reportAssetError]);
  return object ? <primitive object={object} position={position} rotation={rotation} scale={scale} /> : null;
}

function LevelSky({ level }) {
  const scene = useThree((state) => state.scene);
  const path = level === 'snow' ? '/assets/hdr/snow_city.hdr' : '/assets/hdr/swamp.hdr';
  const reportAssetError = useGameStore((state) => state.reportAssetError);
  useEffect(() => {
    let cancelled = false;
    const loader = new RGBELoader();
    loader.load(path, (texture) => {
      if (cancelled) return texture.dispose();
      texture.mapping = THREE.EquirectangularReflectionMapping;
      scene.background = texture;
      scene.environment = texture;
    }, undefined, () => {
      if (!cancelled) reportAssetError(path);
    });
    return () => {
      cancelled = true;
      scene.background = null;
      scene.environment = null;
    };
  }, [level, path, scene, reportAssetError]);
  return null;
}

function WeatherParticles({ level }) {
  const pointsRef = useRef();
  const playerPosition = useGameStore((state) => state.playerPosition);
  const quality = useGameStore((state) => state.graphicsQuality);
  const count = quality === 'low' ? 140 : quality === 'medium' ? 340 : 720;
  const geometry = useMemo(() => {
    const result = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = (Math.random() - 0.5) * 72;
      positions[index * 3 + 1] = Math.random() * 24;
      positions[index * 3 + 2] = (Math.random() - 0.5) * 90;
    }
    result.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return result;
  }, [count]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    pointsRef.current.position.set(playerPosition.x, 0, playerPosition.z);
    const positions = geometry.attributes.position.array;
    const snow = level === 'snow';
    for (let index = 0; index < count; index += 1) {
      const offset = index * 3;
      positions[offset] += Math.sin(index + performance.now() * 0.00018) * delta * (snow ? 0.35 : 0.7);
      positions[offset + 1] -= delta * (snow ? 3.8 : 0.36);
      positions[offset + 2] += delta * (snow ? 1.3 : 0.9);
      if (positions[offset + 1] < 0) {
        positions[offset + 1] = snow ? 22 : 7 + Math.random() * 8;
        positions[offset] = (Math.random() - 0.5) * 72;
        positions[offset + 2] = (Math.random() - 0.5) * 90;
      }
    }
    geometry.attributes.position.needsUpdate = true;
  });

  return <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
    <pointsMaterial color={level === 'snow' ? '#d9efff' : '#a3c3a4'} size={level === 'snow' ? 0.075 : 0.055} transparent opacity={level === 'snow' ? 0.72 : 0.35} depthWrite={false} sizeAttenuation />
  </points>;
}

export default function Environment() {
  const selectedLevel = useGameStore((state) => state.selectedLevel);
  const level = selectedLevel === 'snow' ? 'snow' : 'swamp';
  const fogColor = level === 'snow' ? '#a9c4d3' : '#71817c';
  const assets = useMemo(() => PLACEMENTS[level], [level]);
  return (
    <>
      {/* Temporary player visibility helpers; remove after validating the FBX rig. */}
      <gridHelper args={[160, 80, '#55d9d0', '#48636a']} position={[0, 0.015, 0]} />
      <pointLight position={[0, 7, 4]} color="#dff8ff" intensity={18} distance={34} decay={2} />
      <ambientLight intensity={0.7} color="#d9e6ee" />
      <LevelSky level={level} />
      <WeatherParticles level={level} />
      <fog attach="fog" args={[fogColor, 34, 125]} />
      <ambientLight intensity={0.62} color={level === 'snow' ? '#c6d9ef' : '#a3baa7'} />
      <hemisphereLight args={['#b8d0e1', '#46524b', 0.8]} />
      <directionalLight
        position={[-24, 38, 22]}
        intensity={level === 'snow' ? 2.2 : 1.8}
        color={level === 'snow' ? '#dcecff' : '#d6e6cd'}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
      />
      {assets.map((asset, index) => <LevelAsset key={`${level}_${asset.path}_${index}`} {...asset} />)}
    </>
  );
}
