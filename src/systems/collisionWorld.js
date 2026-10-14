// Shadow Strike: Last Stand - static collision world.
// Colliders are boxes rotated only around Y. They drive player/AI movement,
// standing height (stairs, rooftops), camera collision, bullets and sight lines.
import * as THREE from 'three';

const EPS = 1e-6;

class CollisionWorld {
  constructor() {
    this.colliders = [];
    this.version = 0;
    this.groundHeight = 0;
  }

  clear() {
    this.colliders.length = 0;
    this.version += 1;
  }

  /**
   * @param {object} box
   * center [x,y,z], size [w,h,d], yaw radians,
   * surface 'concrete' | 'brick' | 'metal' | 'wood' | 'dirt' | 'sandbag' | 'vehicle',
   * walkable: can be stood on, bullets/sight: blocks them (default true)
   */
  add(box) {
    const [cx, cy, cz] = box.center;
    const [w, h, d] = box.size;
    const yaw = box.yaw || 0;
    const collider = {
      cx, cy, cz,
      hx: w / 2, hy: h / 2, hz: d / 2,
      cos: Math.cos(yaw), sin: Math.sin(yaw),
      surface: box.surface || 'concrete',
      walkable: box.walkable !== false,
      bullets: box.bullets !== false,
      sight: box.sight !== false,
      solid: box.solid !== false,
      tag: box.tag || null,
    };
    // Conservative XZ bounds for broad-phase rejection.
    const ex = Math.abs(collider.cos) * collider.hx + Math.abs(collider.sin) * collider.hz;
    const ez = Math.abs(collider.sin) * collider.hx + Math.abs(collider.cos) * collider.hz;
    collider.minX = cx - ex; collider.maxX = cx + ex;
    collider.minZ = cz - ez; collider.maxZ = cz + ez;
    collider.minY = cy - collider.hy; collider.maxY = cy + collider.hy;
    this.colliders.push(collider);
    this.version += 1;
    return collider;
  }

  remove(collider) {
    const index = this.colliders.indexOf(collider);
    if (index >= 0) { this.colliders.splice(index, 1); this.version += 1; }
  }

  // World XZ -> collider-local XZ.
  static toLocal(c, x, z) {
    const dx = x - c.cx; const dz = z - c.cz;
    return [dx * c.cos - dz * c.sin, dx * c.sin + dz * c.cos];
  }

  static toWorldDir(c, lx, lz) {
    return [lx * c.cos + lz * c.sin, -lx * c.sin + lz * c.cos];
  }

  /**
   * Ray against static colliders. Returns { distance, point, normal, collider } or null.
   * `filter(c)` may skip colliders (e.g. sight-only queries).
   */
  raycast(origin, direction, maxDistance = 200, filter = null) {
    let best = null;
    let bestT = maxDistance;
    const ox = origin.x; const oy = origin.y; const oz = origin.z;
    const dx = direction.x; const dy = direction.y; const dz = direction.z;
    const ex = ox + dx * maxDistance; const ez = oz + dz * maxDistance;
    const rMinX = Math.min(ox, ex); const rMaxX = Math.max(ox, ex);
    const rMinZ = Math.min(oz, ez); const rMaxZ = Math.max(oz, ez);
    for (const c of this.colliders) {
      if (c.maxX < rMinX || c.minX > rMaxX || c.maxZ < rMinZ || c.minZ > rMaxZ) continue;
      if (filter && !filter(c)) continue;
      // Into box space (yaw only).
      const px = ox - c.cx; const pz = oz - c.cz;
      const lox = px * c.cos - pz * c.sin; const loz = px * c.sin + pz * c.cos;
      const loy = oy - c.cy;
      const ldx = dx * c.cos - dz * c.sin; const ldz = dx * c.sin + dz * c.cos;
      let tMin = 0; let tMax = bestT; let axis = -1; let sign = 1;
      const slabs = [[lox, ldx, c.hx, 0], [loy, dy, c.hy, 1], [loz, ldz, c.hz, 2]];
      let miss = false;
      for (const [o, d, h, a] of slabs) {
        if (Math.abs(d) < EPS) {
          if (o < -h || o > h) { miss = true; break; }
          continue;
        }
        const inv = 1 / d;
        let t1 = (-h - o) * inv; let t2 = (h - o) * inv;
        let s = -1;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; s = 1; }
        if (t1 > tMin) { tMin = t1; axis = a; sign = s; }
        if (t2 < tMax) tMax = t2;
        if (tMin > tMax) { miss = true; break; }
      }
      if (miss || axis < 0 || tMin >= bestT) continue;
      bestT = tMin;
      let nx = 0; let ny = 0; let nz = 0;
      if (axis === 1) ny = sign;
      else {
        const [wx, wz] = axis === 0 ? CollisionWorld.toWorldDir(c, sign, 0) : CollisionWorld.toWorldDir(c, 0, sign);
        nx = wx; nz = wz;
      }
      best = { distance: tMin, collider: c, nx, ny, nz };
    }
    // Open ground plane.
    if (dy < -EPS) {
      const t = (this.groundHeight - oy) / dy;
      if (t > 0 && t < bestT) { bestT = t; best = { distance: t, collider: null, nx: 0, ny: 1, nz: 0, ground: true }; }
    }
    if (!best) return null;
    best.point = new THREE.Vector3(ox + dx * best.distance, oy + dy * best.distance, oz + dz * best.distance);
    best.normal = new THREE.Vector3(best.nx, best.ny, best.nz);
    best.surface = best.collider ? best.collider.surface : 'dirt';
    return best;
  }

  /** True when nothing that blocks sight lies between a and b. */
  hasLineOfSight(a, b) {
    const dir = _tmpDir.subVectors(b, a);
    const distance = dir.length();
    if (distance < 0.01) return true;
    dir.divideScalar(distance);
    const hit = this.raycast(a, dir, distance - 0.05, (c) => c.sight);
    return !hit || hit.ground;
  }

  /** Highest walkable surface under the circle that can be stepped onto from `feetY`. */
  supportHeight(x, z, radius, feetY, stepHeight = 0.5) {
    let height = this.groundHeight;
    const r = radius * 0.6;
    for (const c of this.colliders) {
      if (!c.walkable) continue;
      if (x + r < c.minX || x - r > c.maxX || z + r < c.minZ || z - r > c.maxZ) continue;
      if (c.maxY > feetY + stepHeight || c.maxY <= height) continue;
      const [lx, lz] = CollisionWorld.toLocal(c, x, z);
      if (Math.abs(lx) <= c.hx + r * 0.3 && Math.abs(lz) <= c.hz + r * 0.3) height = c.maxY;
    }
    return height;
  }

  /** Lowest solid ceiling above `y` at (x, z), used to stop jumps through floors. */
  ceilingHeight(x, z, y) {
    let ceiling = Infinity;
    for (const c of this.colliders) {
      if (!c.solid || c.minY < y || c.minY >= ceiling) continue;
      if (x < c.minX || x > c.maxX || z < c.minZ || z > c.maxZ) continue;
      const [lx, lz] = CollisionWorld.toLocal(c, x, z);
      if (Math.abs(lx) <= c.hx && Math.abs(lz) <= c.hz) ceiling = c.minY;
    }
    return ceiling;
  }

  /**
   * Pushes a vertical capsule (circle in XZ) out of solid colliders that overlap
   * [feetY + stepHeight, feetY + height]. Mutates and returns `position`.
   */
  resolveCircle(position, radius, feetY, height = 1.8, stepHeight = 0.5) {
    const low = feetY + stepHeight; const high = feetY + height;
    for (let iteration = 0; iteration < 3; iteration += 1) {
      let moved = false;
      for (const c of this.colliders) {
        if (!c.solid || c.maxY <= low || c.minY >= high) continue;
        if (position.x + radius < c.minX || position.x - radius > c.maxX
          || position.z + radius < c.minZ || position.z - radius > c.maxZ) continue;
        const [lx, lz] = CollisionWorld.toLocal(c, position.x, position.z);
        const qx = THREE.MathUtils.clamp(lx, -c.hx, c.hx);
        const qz = THREE.MathUtils.clamp(lz, -c.hz, c.hz);
        let ox = lx - qx; let oz = lz - qz;
        let distSq = ox * ox + oz * oz;
        if (distSq > radius * radius) continue;
        let push;
        if (distSq < EPS) {
          // Centre is inside the box: leave through the nearest face.
          const px = c.hx - Math.abs(lx); const pz = c.hz - Math.abs(lz);
          if (px < pz) { ox = Math.sign(lx) || 1; oz = 0; push = px + radius; } else { ox = 0; oz = Math.sign(lz) || 1; push = pz + radius; }
        } else {
          const dist = Math.sqrt(distSq);
          ox /= dist; oz /= dist; push = radius - dist;
        }
        const [wx, wz] = CollisionWorld.toWorldDir(c, ox, oz);
        position.x += wx * push; position.z += wz * push;
        moved = true;
      }
      if (!moved) break;
    }
    return position;
  }

  /** True when a circle at ground level overlaps any solid collider (for navigation). */
  blocksCircle(x, z, radius, low = 0.45, high = 1.7) {
    for (const c of this.colliders) {
      if (!c.solid || c.maxY <= low || c.minY >= high) continue;
      if (x + radius < c.minX || x - radius > c.maxX || z + radius < c.minZ || z - radius > c.maxZ) continue;
      const [lx, lz] = CollisionWorld.toLocal(c, x, z);
      const qx = THREE.MathUtils.clamp(lx, -c.hx, c.hx);
      const qz = THREE.MathUtils.clamp(lz, -c.hz, c.hz);
      if ((lx - qx) ** 2 + (lz - qz) ** 2 < radius * radius) return true;
    }
    return false;
  }

  /** Height of the tallest solid obstacle within `radius` of (x, z); 0 when open. */
  obstacleHeightNear(x, z, radius) {
    let height = 0;
    for (const c of this.colliders) {
      if (!c.solid || c.minY > 0.6) continue;
      if (x + radius < c.minX || x - radius > c.maxX || z + radius < c.minZ || z - radius > c.maxZ) continue;
      const [lx, lz] = CollisionWorld.toLocal(c, x, z);
      const qx = THREE.MathUtils.clamp(lx, -c.hx, c.hx);
      const qz = THREE.MathUtils.clamp(lz, -c.hz, c.hz);
      if ((lx - qx) ** 2 + (lz - qz) ** 2 < radius * radius) height = Math.max(height, c.maxY);
    }
    return height;
  }
}

const _tmpDir = new THREE.Vector3();

export const collisionWorld = new CollisionWorld();

// ---------------------------------------------------------------------------
// Ray vs character hitboxes (spheres and capsules in world space).

export function rayCapsule(origin, dir, a, b, radius, maxDistance) {
  // Closest approach between the ray and segment ab, then a sphere test there.
  const ab = _ab.subVectors(b, a);
  const ao = _ao.subVectors(origin, a);
  const abLenSq = ab.lengthSq();
  const abDotD = ab.dot(dir);
  const abDotAo = ab.dot(ao);
  const denom = abLenSq - abDotD * abDotD;
  const dDotAo = dir.dot(ao);
  const s = THREE.MathUtils.clamp(denom > EPS ? (abDotAo - abDotD * dDotAo) / denom : 0, 0, 1);
  const center = _center.copy(a).addScaledVector(ab, s);
  return raySphere(origin, dir, center, radius, maxDistance);
}

export function raySphere(origin, dir, center, radius, maxDistance) {
  const oc = _oc.subVectors(origin, center);
  const b = oc.dot(dir);
  const c = oc.lengthSq() - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  let t = -b - sq;
  if (t < 0) t = -b + sq;
  if (t < 0 || t > maxDistance) return null;
  return t;
}

const _ab = new THREE.Vector3();
const _ao = new THREE.Vector3();
const _oc = new THREE.Vector3();
const _center = new THREE.Vector3();
