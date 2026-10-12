import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { clone as cloneModel } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { loadGLTF } from './assetLoader';
import { useGameStore } from '../store/gameStore';

const ASSETS = {
  house: ['building-a', 'building-b', 'building-c'].map((name) => `/assets/city/kenney_city-kit-industrial_2.0/Models/GLB%20format/${name}.glb`),
  shop: ['building-d', 'building-e', 'building-f'].map((name) => `/assets/city/kenney_city-kit-industrial_2.0/Models/GLB%20format/${name}.glb`),
  apartment: ['building-g', 'building-h', 'building-i', 'building-j'].map((name) => `/assets/city/kenney_city-kit-industrial_2.0/Models/GLB%20format/${name}.glb`),
  skyscraper: ['building-k', 'building-l', 'building-m', 'building-n', 'building-o'].map((name) => `/assets/city/kenney_city-kit-industrial_2.0/Models/GLB%20format/${name}.glb`),
  warehouse: ['building-p', 'building-q', 'building-r', 'building-s', 'building-t'].map((name) => `/assets/city/kenney_city-kit-industrial_2.0/Models/GLB%20format/${name}.glb`),
};
const MAT = {
  road: new THREE.MeshStandardMaterial({ color: '#252b30', roughness: 0.95 }),
  sidewalk: new THREE.MeshStandardMaterial({ color: '#85817a', roughness: 0.94 }),
  line: new THREE.MeshStandardMaterial({ color: '#e4c960', roughness: 0.75, emissive: '#30250a' }),
  glass: new THREE.MeshStandardMaterial({ color: '#1e333c', roughness: 0.25, metalness: 0.5, emissive: '#12252c', emissiveIntensity: 0.25 }),
  trunk: new THREE.MeshStandardMaterial({ color: '#59483a', roughness: 1 }),
  leaves: new THREE.MeshStandardMaterial({ color: '#4d705d', roughness: 0.94 }),
  lamp: new THREE.MeshStandardMaterial({ color: '#40484c', roughness: 0.5, metalness: 0.7 }),
  trim: new THREE.MeshStandardMaterial({ color: '#b3b0a7', roughness: 0.7 }),
};
const failedAssets = new Set();
let nightLighting = 0;
let rainWetness = 0;
export function setCityConditions({ night = nightLighting, rain = rainWetness }) {
  nightLighting = night;
  if (rain !== rainWetness) {
    rainWetness = rain;
    MAT.road.roughness = THREE.MathUtils.lerp(0.94, 0.24, rainWetness);
    MAT.road.metalness = THREE.MathUtils.lerp(0.04, 0.38, rainWetness);
    // Roughness/metalness are shader uniforms. Marking this shared material
    // needsUpdate every frame recompiles it repeatedly and can freeze the tab.
  }
}
const hash = (n) => { let x = n | 0; x = Math.imul(x ^ x >>> 16, 0x7feb352d); x = Math.imul(x ^ x >>> 15, 0x846ca68b); return (x ^ x >>> 16) >>> 0; };
const randomFor = (seed) => { let a = seed >>> 0; return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };

function CityAsset({ path, position, targetSize, report }) {
  const renderer = useThree((s) => s.gl);
  const [object, setObject] = useState(null);
  const targetSignature = targetSize.join(':');
  useEffect(() => {
    let cancelled = false;
    if (failedAssets.has(path)) return undefined;
    loadGLTF(path, renderer).then((gltf) => {
      if (cancelled) return;
      const clone = cloneModel(gltf.scene);
      clone.traverse((node) => { if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; } });
      clone.updateMatrixWorld(true);
      const sourceBounds = new THREE.Box3().setFromObject(clone);
      const sourceSize = sourceBounds.getSize(new THREE.Vector3());
      clone.scale.set(
        sourceSize.x ? targetSize[0] / sourceSize.x : 1,
        sourceSize.y ? targetSize[1] / sourceSize.y : 1,
        sourceSize.z ? targetSize[2] / sourceSize.z : 1,
      );
      clone.updateMatrixWorld(true);
      const normalizedBounds = new THREE.Box3().setFromObject(clone);
      const center = normalizedBounds.getCenter(new THREE.Vector3());
      clone.position.set(-center.x, -normalizedBounds.min.y, -center.z);
      clone.updateMatrixWorld(true);
      setObject(clone);
      console.info(`[CITY] Loaded ${path}`);
    }).catch((error) => {
      if (cancelled) return;
      failedAssets.add(path);
      console.error(`[CITY] Missing asset, skipped: ${path}`, error);
      report(path);
    });
    return () => { cancelled = true; };
  }, [path, renderer, report, targetSignature]);
  return object ? <primitive object={object} position={position} /> : null;
}

function Building({ x, z, district, seed, assetPath, report }) {
  const spec = district === 'downtown' ? { lo: 34, hi: 62, size: 26, colors: ['#303a42', '#47515a', '#394348'] }
    : district === 'industrial' ? { lo: 10, hi: 20, size: 29, colors: ['#5e625e', '#625a50', '#4b565b'] }
      : { lo: 7, hi: 14, size: 19, colors: ['#857560', '#788071', '#9b8770'] };
  const dimensions = useMemo(() => {
    const rng = randomFor(seed);
    return [spec.size * (0.72 + rng() * 0.28), spec.lo + rng() * (spec.hi - spec.lo), spec.size * (0.72 + rng() * 0.28)];
  }, [seed, district]);
  const targetSize = useMemo(() => dimensions, [dimensions]);
  return <CityAsset path={assetPath} position={[x, 0, z]} targetSize={targetSize} report={report} />;
}

function RoadBlock() {
  const dashPositions = useMemo(() => { const a = []; for (let p = 3; p < 100; p += 8) a.push([p, 0.035, 50], [50, 0.035, p]); return a; }, []);
  const lampPositions = useMemo(() => [[10, 3.5, 34], [90, 3.5, 66], [34, 3.5, 90], [66, 3.5, 10]], []);
  const dash = useRef(); const lamps = useRef(); const streetlight = useRef();
  useFrame(() => { if (streetlight.current) streetlight.current.intensity = nightLighting * 8; });
  useEffect(() => {
    const apply = (ref, positions, scale) => {
      if (!ref.current) return;
      const obj = new THREE.Object3D();
      positions.forEach(([x, y, z], i) => { obj.position.set(x, y, z); obj.scale.set(...scale); obj.rotation.y = i % 2 ? Math.PI / 2 : 0; obj.updateMatrix(); ref.current.setMatrixAt(i, obj.matrix); });
      ref.current.instanceMatrix.needsUpdate = true;
    };
    apply(dash, dashPositions, [3.5, 0.12, 0.18]); apply(lamps, lampPositions, [1, 1, 1]);
  }, [dashPositions, lampPositions]);
  return <group>
    <mesh position={[50, -0.06, 50]} rotation={[-Math.PI / 2, 0, 0]} material={MAT.road}><planeGeometry args={[100, 18]} /></mesh>
    <mesh position={[50, -0.055, 50]} rotation={[-Math.PI / 2, 0, 0]} material={MAT.road}><planeGeometry args={[18, 100]} /></mesh>
    {[[50, 38], [50, 62], [38, 50], [62, 50]].map(([x, z], i) => <mesh key={i} position={[x, 0, z]} rotation={[-Math.PI / 2, 0, 0]} material={MAT.sidewalk}><planeGeometry args={[i < 2 ? 100 : 5, i < 2 ? 5 : 100]} /></mesh>)}
    <instancedMesh ref={dash} args={[new THREE.BoxGeometry(1, 1, 1), MAT.line, dashPositions.length]} />
    <instancedMesh ref={lamps} args={[new THREE.CylinderGeometry(0.12, 0.18, 7, 8), MAT.lamp, lampPositions.length]} castShadow />
    <pointLight ref={streetlight} position={[10, 6.4, 34]} color="#ffd7a0" intensity={0} distance={22} decay={2} />
  </group>;
}

export default function WorldGenerator({ chunkX, chunkZ }) {
  const report = useGameStore((state) => state.reportAssetError);
  const seed = useMemo(() => hash(chunkX * 73856093 ^ chunkZ * 19349663), [chunkX, chunkZ]);
  const district = Math.hypot(chunkX, chunkZ) < 4 ? 'downtown' : (chunkX >= 7 && chunkX <= 11 && Math.abs(chunkZ) <= 2) || hash(chunkX * 92821 ^ chunkZ * 68917) % 5 === 0 ? 'industrial' : 'suburbs';
  const buildings = useMemo(() => {
    const rng = randomFor(seed); const result = [];
    const lots = [[22, 22], [78, 22], [22, 78], [78, 78]];
    lots.forEach(([x, z], i) => {
      let type = district === 'downtown' ? 'skyscraper' : district === 'industrial' ? 'warehouse' : rng() < 0.24 ? 'shop' : 'house';
      const variants = ASSETS[type];
      result.push({ x: x + (rng() - 0.5) * 7, z: z + (rng() - 0.5) * 7, type, assetPath: variants[Math.floor(rng() * variants.length)], seed: seed + i * 997 });
    });
    return result;
  }, [seed, district]);
  return <group position={[chunkX * 100, 0, chunkZ * 100]}>
    <mesh position={[50, -0.13, 50]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[100, 100]} /><meshStandardMaterial color="#4b514c" roughness={1} /></mesh>
    <RoadBlock />
    {buildings.map((b, i) => <Building key={`${chunkX}:${chunkZ}:${i}`} {...b} district={district} report={report} />)}
  </group>;
}
