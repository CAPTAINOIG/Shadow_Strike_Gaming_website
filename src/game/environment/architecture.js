// Shadow Strike: Last Stand - procedural architecture.
// Buildings are assembled from wall pieces around real door/window openings,
// floor slabs, parapets and stairs. Every piece also becomes a collider, so
// what you see is exactly what blocks movement, bullets and sight.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { applyWorldUV, surfaceOf, tileOf } from './materials';

/** Collects world-space box pieces per material, then merges them. */
export class GeometryBatch {
  constructor() {
    this.pieces = new Map(); // material key -> geometries
    this.colliders = [];
  }

  /**
   * Adds a box. `local` is relative to the parent transform (x, z, yaw).
   * collider: false | object of collider overrides.
   */
  box(material, parent, [lx, ly, lz], [w, h, d], { yawOffset = 0, collider = {}, tilt = null } = {}) {
    if (w <= 0.001 || h <= 0.001 || d <= 0.001) return;
    const cos = Math.cos(parent.yaw); const sin = Math.sin(parent.yaw);
    const x = parent.x + lx * cos + lz * sin;
    const z = parent.z - lx * sin + lz * cos;
    const yaw = parent.yaw + yawOffset;
    const geometry = new THREE.BoxGeometry(w, h, d);
    const matrix = new THREE.Matrix4().makeRotationY(yaw);
    if (tilt) matrix.multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(tilt[0], 0, tilt[1])));
    matrix.setPosition(x, ly, z);
    geometry.applyMatrix4(matrix);
    applyWorldUV(geometry, tileOf(material));
    if (!this.pieces.has(material)) this.pieces.set(material, []);
    this.pieces.get(material).push(geometry);
    if (collider !== false) {
      this.colliders.push({ center: [x, ly, z], size: [w, h, d], yaw, surface: surfaceOf(material), ...collider });
    }
  }

  /** One merged mesh per material. */
  build(getMaterial) {
    const meshes = [];
    for (const [key, geometries] of this.pieces) {
      const merged = mergeGeometries(geometries, false);
      geometries.forEach((g) => g.dispose());
      const mesh = new THREE.Mesh(merged, getMaterial(key));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.surface = surfaceOf(key);
      meshes.push(mesh);
    }
    this.pieces.clear();
    return meshes;
  }
}

/**
 * Wall along local X from -length/2 to +length/2 at (cx, cz) with yaw.
 * openings: [{ at, w, h, sill }] (`at` = centre offset along the wall).
 * profile: optional array of top heights per metre for ruined walls.
 */
export function wall(batch, parent, { cx, cz, yaw = 0, length, height, thickness = 0.3, base = 0, material, trim = 'trim', openings = [], profile = null }) {
  const frame = composeFrame(parent, cx, cz, yaw);
  const sorted = [...openings].sort((a, b) => a.at - b.at);
  let cursor = -length / 2;
  const segment = (from, to, y0, y1) => {
    if (to - from < 0.02 || y1 - y0 < 0.02) return;
    batch.box(material, frame, [(from + to) / 2, base + (y0 + y1) / 2, 0], [to - from, y1 - y0, thickness]);
  };
  const solidSpan = (from, to) => {
    if (!profile) { segment(from, to, 0, height); return; }
    // Ruined wall: irregular top made of short pieces.
    for (let x = from; x < to - 0.01; x += 0.6) {
      const next = Math.min(to, x + 0.6);
      const index = Math.min(profile.length - 1, Math.max(0, Math.floor(((x + next) / 2 + length / 2))));
      segment(x, next, 0, Math.min(height, profile[index]));
    }
  };
  for (const opening of sorted) {
    const left = opening.at - opening.w / 2; const right = opening.at + opening.w / 2;
    solidSpan(cursor, left);
    const sill = opening.sill || 0;
    segment(left, right, 0, sill);
    if (!profile) segment(left, right, sill + opening.h, height);
    // Frame trim around the opening.
    if (trim && !opening.breach) {
      const t = 0.07; const depth = thickness + 0.04;
      batch.box(trim, frame, [left + t / 2, base + sill + opening.h / 2, 0], [t, opening.h, depth], { collider: false });
      batch.box(trim, frame, [right - t / 2, base + sill + opening.h / 2, 0], [t, opening.h, depth], { collider: false });
      batch.box(trim, frame, [opening.at, base + sill + opening.h - t / 2, 0], [opening.w, t, depth], { collider: false });
      if (sill > 0) batch.box(trim, frame, [opening.at, base + sill + t / 2, 0], [opening.w + 0.12, t, depth + 0.06], { collider: false });
    }
    cursor = right;
  }
  solidSpan(cursor, length / 2);
}

function composeFrame(parent, lx, lz, yaw) {
  const cos = Math.cos(parent.yaw); const sin = Math.sin(parent.yaw);
  return { x: parent.x + lx * cos + lz * sin, z: parent.z - lx * sin + lz * cos, yaw: parent.yaw + yaw };
}

/**
 * Rectangular building. floors: [{ height, n, s, e, w }] with opening lists per
 * side (n = -Z side, s = +Z, e = +X, w = -X in building space).
 */
export function building(batch, spec) {
  const { x, z, yaw = 0, width, depth, floors, material, interior = 'plaster', floorMaterial = 'floor', thickness = 0.3, parapet = 0.7, roof = true, ruined = null } = spec;
  const parent = { x, z, yaw };
  let base = 0;
  const halfW = width / 2; const halfD = depth / 2;
  // Ground-floor slab (walkable, slightly raised).
  batch.box(floorMaterial, parent, [0, 0.05, 0], [width - 0.05, 0.1, depth - 0.05], { collider: { bullets: false, sight: false, solid: false } });
  floors.forEach((floor, index) => {
    const h = floor.height;
    const sides = [
      { key: 'n', cx: 0, cz: -halfD + thickness / 2, yaw: 0, length: width },
      { key: 's', cx: 0, cz: halfD - thickness / 2, yaw: Math.PI, length: width },
      { key: 'e', cx: halfW - thickness / 2, cz: 0, yaw: -Math.PI / 2, length: depth - thickness * 2 },
      { key: 'w', cx: -halfW + thickness / 2, cz: 0, yaw: Math.PI / 2, length: depth - thickness * 2 },
    ];
    for (const side of sides) {
      wall(batch, parent, {
        cx: side.cx, cz: side.cz, yaw: side.yaw, length: side.length, height: h, thickness, base,
        material: floor.material || material, openings: floor[side.key] || [], profile: ruined?.[side.key] || null,
      });
    }
    base += h;
    const isTop = index === floors.length - 1;
    if (!isTop || roof) {
      // Floor/roof slab: walkable on top, solid underneath.
      batch.box(isTop ? material : floorMaterial, parent, [0, base + 0.12, 0], [width + 0.1, 0.24, depth + 0.1]);
      base += 0.24;
    }
  });
  if (roof && parapet > 0) {
    const t = 0.22;
    batch.box(material, parent, [0, base + parapet / 2, -halfD + t / 2], [width + 0.1, parapet, t]);
    batch.box(material, parent, [0, base + parapet / 2, halfD - t / 2], [width + 0.1, parapet, t]);
    batch.box(material, parent, [halfW - t / 2, base + parapet / 2, 0], [t, parapet, depth - t * 2]);
    batch.box(material, parent, [-halfW + t / 2, base + parapet / 2, 0], [t, parapet, depth - t * 2]);
  }
  // Interior plaster skin is skipped: wall boxes are textured on both faces.
  void interior;
  return base;
}

/** Straight flight of steps rising along local +Z from (lx, lz). */
export function stairs(batch, parent, { lx, lz, yaw = 0, width = 1.2, rise, run, material = 'concrete', landing = 1.2 }) {
  const frame = composeFrame(parent, lx, lz, yaw);
  const count = Math.max(2, Math.round(rise / 0.2));
  const stepH = rise / count; const stepD = run / count;
  for (let i = 0; i < count; i += 1) {
    const top = stepH * (i + 1);
    batch.box(material, frame, [0, top / 2, stepD * (i + 0.5)], [width, top, stepD + 0.01]);
  }
  if (landing > 0) batch.box(material, frame, [0, rise / 2, run + landing / 2], [width, rise, landing]);
}

/** Irregular rubble heap of concrete/brick chunks (visual + low collider). */
export function rubble(batch, parent, { lx, lz, radius = 1.5, height = 0.8, material = 'plasterBroken', seed = 1, collider = true }) {
  const rand = mulberry(seed);
  const frame = composeFrame(parent, lx, lz, 0);
  const pieces = Math.round(radius * 9);
  for (let i = 0; i < pieces; i += 1) {
    const a = rand() * Math.PI * 2; const r = Math.sqrt(rand()) * radius;
    const falloff = 1 - r / (radius * 1.1);
    const s = 0.18 + rand() * 0.45 * falloff + 0.08;
    const y = rand() * height * falloff;
    batch.box(material, frame, [Math.cos(a) * r, y + s * 0.3, Math.sin(a) * r], [s * (0.8 + rand()), s * (0.5 + rand() * 0.6), s * (0.8 + rand())], {
      yawOffset: rand() * Math.PI, tilt: [(rand() - 0.5) * 0.7, (rand() - 0.5) * 0.7], collider: false,
    });
  }
  if (collider) {
    batch.colliders.push({ center: [frame.x, height * 0.3, frame.z], size: [radius * 1.3, height * 0.6, radius * 1.3], yaw: 0, surface: surfaceOf(material), sight: false });
  }
}

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6D2B79F5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
