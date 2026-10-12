import React, { useMemo } from 'react';
import { useGameStore } from '../store/gameStore';
import WorldGenerator from './WorldGenerator';

const CHUNK_SIZE = 100;
// A 3x3 neighborhood keeps the 200-unit view range populated without
// flooding the first frame with a hundred independently loaded buildings.
const LOAD_RADIUS = 1;

export default function ChunkManager() {
  // Subscribe to chunk coordinates only, so this component does not rerender on
  // every player-position update while they are still inside the same block.
  const chunkX = useGameStore((state) => Math.floor(state.playerPosition.x / CHUNK_SIZE));
  const chunkZ = useGameStore((state) => Math.floor(state.playerPosition.z / CHUNK_SIZE));
  const chunks = useMemo(() => {
    const result = [];
    for (let z = chunkZ - LOAD_RADIUS; z <= chunkZ + LOAD_RADIUS; z += 1) {
      for (let x = chunkX - LOAD_RADIUS; x <= chunkX + LOAD_RADIUS; x += 1) result.push([x, z]);
    }
    return result;
  }, [chunkX, chunkZ]);

  return <group>{chunks.map(([x, z]) => <WorldGenerator key={`${x}:${z}`} chunkX={x} chunkZ={z} />)}</group>;
}
