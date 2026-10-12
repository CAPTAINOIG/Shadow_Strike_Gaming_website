import { Pathfinding } from 'three-pathfinding';
import * as THREE from 'three';

const pathfinder = new Pathfinding();
const configuredLevels = new Set();

export function configureNavMesh(level, gltf) {
  let navMesh = null;
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((node) => {
    if (!navMesh && node.isMesh) navMesh = node;
  });
  if (!navMesh) throw new Error(`Navmesh file for ${level} contains no mesh.`);
  const geometry = navMesh.geometry.clone();
  geometry.applyMatrix4(navMesh.matrixWorld);
  pathfinder.setZoneData(`mission_${level}`, Pathfinding.createZone(geometry));
  geometry.dispose();
  configuredLevels.add(level);
}

export function findNavPath(level, start, target) {
  if (!configuredLevels.has(level)) return null;
  const startPoint = new THREE.Vector3(start.x, start.y, start.z);
  const targetPoint = new THREE.Vector3(target.x, target.y, target.z);
  const zoneId = `mission_${level}`;
  const group = pathfinder.getGroup(zoneId, startPoint);
  if (group === null || group === undefined) return null;
  return pathfinder.findPath(startPoint, targetPoint, zoneId, group);
}
