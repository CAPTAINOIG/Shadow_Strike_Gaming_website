import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { useGameStore } from '../store/gameStore';
import { loadGLTF } from './assetLoader';
import { configureNavMesh } from '../systems/navMeshSystem';

export default function NavMeshLoader() {
  const renderer = useThree((state) => state.gl);
  const level = useGameStore((state) => state.selectedLevel);
  const reportAssetError = useGameStore((state) => state.reportAssetError);
  useEffect(() => {
    let cancelled = false;
    const path = level === 'snow'
      ? '/assets/models/levels/snow/snow_city_navmesh.glb'
      : '/assets/models/levels/swamp/swamp_navmesh.glb';
    loadGLTF(path, renderer).then((gltf) => {
      if (!cancelled) configureNavMesh(level, gltf);
    }).catch(() => {
      if (!cancelled) reportAssetError(path);
    });
    return () => { cancelled = true; };
  }, [level, renderer, reportAssetError]);
  return null;
}
