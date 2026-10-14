// Shadow Strike: Last Stand - PBR materials from Poly Haven texture sets.
// Each set folder holds diff.jpg, nor_gl.jpg and arm.jpg (AO, roughness, metal).
import * as THREE from 'three';

const textureLoader = new THREE.TextureLoader();
const textures = new Map();
const materials = new Map();

function texture(path, color) {
  if (!textures.has(path)) {
    const tex = textureLoader.load(path, undefined, undefined, () => console.error(`[TEXTURE] Missing ${path}`));
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    if (color) tex.colorSpace = THREE.SRGBColorSpace;
    textures.set(path, tex);
  }
  return textures.get(path);
}

// World size (metres) one texture tile covers, plus look adjustments.
export const SURFACE_SETS = {
  concrete: { id: 'concrete_wall_006', tile: 3, surface: 'concrete' },
  plaster: { id: 'plastered_wall_04', tile: 3, surface: 'concrete', color: '#d9cfbd' },
  plasterDamaged: { id: 'damaged_plaster', tile: 2.5, surface: 'concrete' },
  plasterBroken: { id: 'rough_plaster_broken', tile: 2.5, surface: 'brick' },
  brick: { id: 'red_brick_03', tile: 2, surface: 'brick' },
  precast: { id: 'precast_concrete_wall', tile: 3.2, surface: 'concrete' },
  floor: { id: 'concrete_floor_damaged_01', tile: 3, surface: 'concrete' },
  corrugated: { id: 'rusty_corrugated_iron', tile: 2.5, surface: 'metal', metal: true },
  rustyMetal: { id: 'rusty_metal_02', tile: 2, surface: 'metal', metal: true },
  trim: { id: 'concrete_wall_006', tile: 1.5, surface: 'concrete', color: '#857a6c' },
  ground: { id: 'aerial_ground_rock', tile: 7, surface: 'dirt' },
  groundRocks: { id: 'dry_ground_rocks', tile: 4, surface: 'dirt' },
  dirt: { id: 'dirt', tile: 4, surface: 'dirt' },
  mud: { id: 'brown_mud_dry', tile: 4, surface: 'dirt' },
  gravelRoad: { id: 'gravel_road', tile: 5, surface: 'dirt' },
  tracks: { id: 'muddy_tracks', tile: 5, surface: 'dirt' },
  grass: { id: 'sparse_grass', tile: 4, surface: 'dirt' },
  burned: { id: 'burned_ground_01', tile: 4, surface: 'dirt' },
};

/**
 * Shared PBR material for a surface set. `options` (alphaMap, transparent,
 * polygonOffset) produce a separately cached variant for ground decals.
 */
export function pbrMaterial(key, options = {}) {
  const set = SURFACE_SETS[key];
  const cacheKey = `${key}:${options.variant || ''}`;
  if (!materials.has(cacheKey)) {
    const base = `/assets/textures/${set.id}/`;
    const arm = texture(`${base}arm.jpg`);
    const material = new THREE.MeshStandardMaterial({
      map: texture(`${base}diff.jpg`, true),
      normalMap: texture(`${base}nor_gl.jpg`),
      normalScale: new THREE.Vector2(1, 1),
      aoMap: arm,
      aoMapIntensity: 0.9,
      roughnessMap: arm,
      metalnessMap: set.metal ? arm : null,
      metalness: set.metal ? 1 : 0,
      roughness: 1,
      color: set.color || '#ffffff',
      envMapIntensity: 0.7,
      ...options.params,
    });
    material.userData.surface = set.surface;
    material.userData.tile = set.tile;
    materials.set(cacheKey, material);
  }
  return materials.get(cacheKey);
}

export function surfaceOf(key) {
  return SURFACE_SETS[key]?.surface || 'concrete';
}

export function tileOf(key) {
  return SURFACE_SETS[key]?.tile || 3;
}

/**
 * World-space planar UVs (geometry already in world space): each face is
 * projected along its dominant normal axis so tiling stays continuous across
 * separate wall pieces and never stretches.
 */
export function applyWorldUV(geometry, tile, offset = 0, topDown = false) {
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i); const y = position.getY(i); const z = position.getZ(i);
    const nx = Math.abs(normal.getX(i)); const ny = Math.abs(normal.getY(i)); const nz = Math.abs(normal.getZ(i));
    let u; let v;
    if (topDown || (ny >= nx && ny >= nz)) { u = x; v = z; } else if (nx >= nz) { u = z; v = y; } else { u = x; v = y; }
    uv[i * 2] = u / tile + offset;
    uv[i * 2 + 1] = v / tile + offset * 0.37;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geometry;
}

/** Soft-edged alpha mask for ground decals (roads, grass patches, scorch). */
export function edgeMask({ radial = false, softness = 0.35, noise = 0.25, size = 256 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const g = canvas.getContext('2d');
  const image = g.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / (size - 1); const v = y / (size - 1);
      const n = (Math.sin(u * 37.1 + v * 11.3) * Math.sin(v * 29.7 - u * 7.9) + Math.sin(u * 91.7 + v * 63.1) * 0.5) * noise;
      let d;
      if (radial) d = 1 - Math.hypot(u - 0.5, v - 0.5) * 2;
      else d = 1 - Math.abs(u - 0.5) * 2;
      const a = THREE.MathUtils.clamp((d + n * 0.5) / softness, 0, 1);
      const value = Math.round(a * a * (3 - 2 * a) * 255);
      const i = (y * size + x) * 4;
      image.data[i] = value; image.data[i + 1] = value; image.data[i + 2] = value; image.data[i + 3] = 255;
    }
  }
  g.putImageData(image, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping; tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
