import * as THREE from 'three';

const bounds = new THREE.Box3();
const closest = new THREE.Vector3();

export function findCoverSnap(scene, position, maxDistance = 3) {
  let best = null;
  scene.traverse((object) => {
    if (!object.isMesh || !object.userData.coverSurface || !object.visible) return;
    bounds.setFromObject(object);
    closest.set(
      THREE.MathUtils.clamp(position.x, bounds.min.x, bounds.max.x),
      position.y,
      THREE.MathUtils.clamp(position.z, bounds.min.z, bounds.max.z)
    );
    const normal = new THREE.Vector3(position.x - closest.x, 0, position.z - closest.z);
    let distance = normal.length();
    if (distance < 0.001) {
      const centerX = (bounds.min.x + bounds.max.x) * 0.5;
      const centerZ = (bounds.min.z + bounds.max.z) * 0.5;
      normal.set(position.x - centerX, 0, position.z - centerZ);
      distance = normal.length();
    }
    if (distance > maxDistance || !distance) return;
    normal.normalize();
    if (!best || distance < best.distance) {
      best = {
        distance,
        normal: normal.clone(),
        position: new THREE.Vector3(closest.x + normal.x * 0.8, position.y, closest.z + normal.z * 0.8),
      };
    }
  });
  return best;
}
