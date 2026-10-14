// Shadow Strike: Last Stand - the combat zone.
// Builds terrain, roads, architecture, props and vehicles from the layout,
// registers every collider, then builds the AI navigation grid.
import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { useGameStore } from '../store/gameStore';
import { collisionWorld } from '../systems/collisionWorld';
import { navGrid } from '../systems/navGrid';
import { GeometryBatch, building, rubble, stairs, wall } from './environment/architecture';
import { applyWorldUV, edgeMask, pbrMaterial } from './environment/materials';
import {
  BACKDROP, BUILDINGS, GROUND_PATCHES, PLAY_AREA, PROPS, PROP_MODELS, ROADS, RUBBLE, TRACKS, WALLS,
} from '../data/battlefieldLayout';

export const SUN_DIRECTION = new THREE.Vector3(-0.55, 0.62, 0.56).normalize();
const FOG_COLOR = '#c4b9a5';
const HDRI = '/assets/hdri/derelict_airfield_01_1k.hdr';

// ---------------------------------------------------------------------------
// Sky: gradient dome with sun glow and drifting cloud layer, horizon = fog colour.

function SkyDome() {
  const material = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      sunDir: { value: SUN_DIRECTION },
      horizon: { value: new THREE.Color(FOG_COLOR) },
      zenith: { value: new THREE.Color('#6f8fae') },
      time: { value: 0 },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * p;
        gl_Position.z = gl_Position.w;
      }`,
    fragmentShader: `
      uniform vec3 sunDir; uniform vec3 horizon; uniform vec3 zenith; uniform float time;
      varying vec3 vDir;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      float fbm(vec2 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
      void main() {
        vec3 dir = normalize(vDir);
        float h = clamp(dir.y, 0.0, 1.0);
        vec3 col = mix(horizon, zenith, pow(h, 0.55));
        float sun = max(dot(dir, normalize(sunDir)), 0.0);
        col += vec3(1.0, 0.82, 0.6) * pow(sun, 7.0) * 0.32;
        col += vec3(1.0, 0.9, 0.75) * pow(sun, 900.0) * 6.0;
        // Clouds projected on a plane above the scene.
        if (dir.y > 0.0) {
          vec2 uv = dir.xz / (dir.y + 0.12) * 1.4 + vec2(time * 0.004, time * 0.002);
          float c = smoothstep(0.48, 0.82, fbm(uv));
          vec3 cloud = mix(vec3(0.86, 0.84, 0.8), vec3(1.0, 0.93, 0.82), pow(sun, 3.0));
          col = mix(col, cloud, c * 0.62 * smoothstep(0.0, 0.25, dir.y));
        }
        col = mix(horizon, col, smoothstep(-0.02, 0.18, dir.y));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }), []);
  useEffect(() => () => material.dispose(), [material]);
  const ref = useRef();
  useFrame(({ camera }, delta) => {
    material.uniforms.time.value += delta;
    if (ref.current) ref.current.position.copy(camera.position);
  });
  return <mesh ref={ref} material={material} frustumCulled={false} renderOrder={-10}><sphereGeometry args={[400, 32, 16]} /></mesh>;
}

// ---------------------------------------------------------------------------

function Lighting() {
  const sun = useRef();
  const quality = useGameStore((s) => s.graphicsQuality);
  const { scene, gl } = useThree();
  const reportAssetError = useGameStore((s) => s.reportAssetError);

  useEffect(() => {
    scene.fog = new THREE.FogExp2(FOG_COLOR, 0.0072);
    let cancelled = false;
    const pmrem = new THREE.PMREMGenerator(gl);
    new RGBELoader().load(HDRI, (hdr) => {
      if (cancelled) { hdr.dispose(); return; }
      hdr.mapping = THREE.EquirectangularReflectionMapping;
      const env = pmrem.fromEquirectangular(hdr).texture;
      hdr.dispose();
      scene.environment = env;
      scene.environmentIntensity = 0.55;
    }, undefined, () => reportAssetError(HDRI));
    return () => {
      cancelled = true;
      pmrem.dispose();
      scene.environment?.dispose?.();
      scene.environment = null;
      scene.fog = null;
    };
  }, [scene, gl, reportAssetError]);

  useEffect(() => {
    if (!sun.current) return;
    const shadow = sun.current.shadow;
    const size = quality === 'high' ? 4096 : quality === 'medium' ? 2048 : 1024;
    shadow.mapSize.set(size, size);
    shadow.map?.dispose(); shadow.map = null;
    shadow.camera.left = -48; shadow.camera.right = 48; shadow.camera.top = 48; shadow.camera.bottom = -48;
    shadow.camera.near = 1; shadow.camera.far = 220;
    shadow.bias = -0.0003; shadow.normalBias = 0.035;
    shadow.camera.updateProjectionMatrix();
  }, [quality]);

  // Shadow frustum follows the player, snapped to texels to avoid shimmering.
  useFrame(() => {
    const light = sun.current;
    if (!light) return;
    const p = useGameStore.getState().playerPosition;
    const texel = 96 / light.shadow.mapSize.x;
    const cx = Math.round(p.x / texel) * texel; const cz = Math.round(p.z / texel) * texel;
    light.target.position.set(cx, 0, cz);
    light.position.set(cx + SUN_DIRECTION.x * 110, SUN_DIRECTION.y * 110, cz + SUN_DIRECTION.z * 110);
    light.target.updateMatrixWorld();
  });

  return <>
    <directionalLight ref={sun} color="#ffe1bd" intensity={3.1} castShadow={quality !== 'low'} />
    <hemisphereLight args={['#bccbd8', '#5e5040', 0.55]} />
  </>;
}

// ---------------------------------------------------------------------------
// Terrain: flat play area, berms and hills rising outside the boundary.

function terrainHeight(x, z) {
  const dx = Math.max(PLAY_AREA.minX - 4 - x, 0, x - PLAY_AREA.maxX - 4);
  const dz = Math.max(PLAY_AREA.minZ - 4 - z, 0, z - PLAY_AREA.maxZ - 4);
  const outside = Math.hypot(dx, dz);
  const n = Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.038) * 0.5 + Math.sin(x * 0.11 - z * 0.07) * 0.25 + 0.75;
  return THREE.MathUtils.smoothstep(outside, 0, 45) * (6 + 22 * n) + THREE.MathUtils.smoothstep(outside, 0, 6) * 0.8;
}

function Terrain() {
  const mesh = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(760, 760, 190, 190);
    geometry.rotateX(-Math.PI / 2);
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i += 1) position.setY(i, terrainHeight(position.getX(i), position.getZ(i)));
    geometry.computeVertexNormals();
    // Top-down projection: slopes stretch slightly but never show seams.
    applyWorldUV(geometry, 7, 0, true);
    const material = pbrMaterial('ground').clone();
    material.onBeforeCompile = (shader) => {
      // Large-scale colour variation hides texture repetition.
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPos;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vWorldPos;
          float tHash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.743); }
          float tNoise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
            return mix(mix(tHash(i), tHash(i + vec2(1, 0)), f.x), mix(tHash(i + vec2(0, 1)), tHash(i + vec2(1, 1)), f.x), f.y); }`)
        .replace('#include <map_fragment>', `#include <map_fragment>
          float macro = tNoise(vWorldPos.xz * 0.035) * 0.6 + tNoise(vWorldPos.xz * 0.11) * 0.4;
          diffuseColor.rgb *= mix(vec3(0.78, 0.76, 0.72), vec3(1.08, 1.04, 0.98), macro);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.86, 0.92, 0.78), smoothstep(6.0, 22.0, vWorldPos.y));`);
    };
    const result = new THREE.Mesh(geometry, material);
    result.receiveShadow = true;
    return result;
  }, []);
  useEffect(() => () => { mesh.geometry.dispose(); mesh.material.dispose(); }, [mesh]);
  return <primitive object={mesh} />;
}

// ---------------------------------------------------------------------------
// Ground decals: roads, tyre tracks and patches with soft alpha edges.

const decalMaterials = new Map();
function decalMaterial(key, radial) {
  const id = `${key}:${radial}`;
  if (!decalMaterials.has(id)) {
    const base = pbrMaterial(key);
    const mask = edgeMask({ radial, softness: radial ? 0.55 : 0.32, noise: radial ? 0.45 : 0.3 });
    mask.channel = 1;
    const material = base.clone();
    material.alphaMap = mask;
    material.transparent = true;
    material.depthWrite = false;
    material.polygonOffset = true;
    material.polygonOffsetFactor = -2;
    material.polygonOffsetUnits = -2;
    decalMaterials.set(id, material);
  }
  return decalMaterials.get(id);
}

function ribbonGeometry(points, width, y) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, y, z)));
  const samples = Math.ceil(curve.getLength() / 1.5);
  const positions = []; const uv1 = []; const indices = [];
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    const p = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    for (const s of [-1, 1]) {
      positions.push(p.x + side.x * width * 0.5 * s, y, p.z + side.z * width * 0.5 * s);
      uv1.push(s < 0 ? 0 : 1, t * samples * 0.1);
    }
    if (i < samples) { const a = i * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(positions.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  geometry.setAttribute('uv1', new THREE.Float32BufferAttribute(uv1, 2));
  geometry.setIndex(indices);
  return applyWorldUV(geometry, 5);
}

function GroundDecals() {
  const group = useMemo(() => {
    const root = new THREE.Group();
    ROADS.forEach((road, i) => {
      const mesh = new THREE.Mesh(ribbonGeometry(road.points, road.width, 0.012 + i * 0.002), decalMaterial('gravelRoad', false));
      mesh.receiveShadow = true; mesh.renderOrder = 1; root.add(mesh);
    });
    TRACKS.forEach((track) => {
      const mesh = new THREE.Mesh(ribbonGeometry(track.points, track.width, 0.02), decalMaterial('tracks', false));
      mesh.receiveShadow = true; mesh.renderOrder = 2; root.add(mesh);
    });
    GROUND_PATCHES.forEach(([key, x, z, rx, rz, rot], i) => {
      const geometry = new THREE.PlaneGeometry(rx * 2, rz * 2, 1, 1);
      geometry.rotateX(-Math.PI / 2);
      geometry.rotateY(rot);
      geometry.translate(x, 0.008 + (i % 4) * 0.001, z);
      geometry.setAttribute('uv1', geometry.attributes.uv.clone());
      applyWorldUV(geometry, 4, i * 0.13);
      const mesh = new THREE.Mesh(geometry, decalMaterial(key, true));
      mesh.receiveShadow = true; mesh.renderOrder = 1; root.add(mesh);
    });
    return root;
  }, []);
  useEffect(() => () => group.traverse((n) => n.geometry?.dispose()), [group]);
  return <primitive object={group} />;
}

// ---------------------------------------------------------------------------

function buildArchitecture() {
  const batch = new GeometryBatch();
  for (const spec of BUILDINGS) {
    const parent = { x: spec.x, z: spec.z, yaw: spec.yaw || 0 };
    building(batch, spec);
    if (spec.roofMaterial) {
      // Corrugated roof sheet over the slab.
      const top = spec.floors.reduce((sum, f) => sum + f.height, 0) + 0.24 * spec.floors.length;
      batch.box(spec.roofMaterial, parent, [0, top + 0.03, 0], [spec.width - 0.3, 0.06, spec.depth - 0.3], { collider: false });
    }
    if (spec.stairs) stairs(batch, parent, { ...spec.stairs, material: spec.material });
    (spec.rubble || []).forEach((r, i) => rubble(batch, parent, { ...r, material: spec.material === 'brick' ? 'brick' : 'plasterBroken', seed: i * 31 + spec.x * 7 }));
  }
  for (const spec of WALLS) wall(batch, { x: 0, z: 0, yaw: 0 }, { ...spec, trim: null });
  RUBBLE.forEach((r, i) => rubble(batch, { x: 0, z: 0, yaw: 0 }, { ...r, seed: 900 + i }));
  return batch;
}

function Architecture({ onColliders }) {
  const { meshes, colliders } = useMemo(() => {
    const batch = buildArchitecture();
    return { meshes: batch.build((key) => pbrMaterial(key)), colliders: batch.colliders };
  }, []);
  useEffect(() => onColliders(colliders), [colliders, onColliders]);
  useEffect(() => () => meshes.forEach((m) => m.geometry.dispose()), [meshes]);
  return <group>{meshes.map((mesh) => <primitive key={mesh.uuid} object={mesh} />)}</group>;
}

// ---------------------------------------------------------------------------
// Props and vehicles (GLB/GLTF), grounded and given box colliders from their bounds.

const gltfLoader = new GLTFLoader();
const modelRequests = new Map();
function loadModel(path) {
  if (!modelRequests.has(path)) {
    modelRequests.set(path, gltfLoader.loadAsync(path).catch((error) => { modelRequests.delete(path); throw error; }));
  }
  return modelRequests.get(path);
}

const preparedTemplates = new Map();
async function propTemplate(key) {
  if (!preparedTemplates.has(key)) {
    preparedTemplates.set(key, (async () => {
      const spec = PROP_MODELS[key];
      const gltf = await loadModel(spec.path);
      const model = gltf.scene.clone(true);
      if (Array.isArray(spec.scale)) model.scale.set(...spec.scale);
      else if (spec.scale) model.scale.setScalar(spec.scale);
      const tint = spec.tint ? new THREE.Color(spec.tint) : null;
      model.traverse((node) => {
        if (!node.isMesh) return;
        node.castShadow = true;
        node.receiveShadow = true;
        const fix = (material) => {
          const m = material.clone();
          // Textured materials are multiplied; flat-coloured body panels take the paint colour.
          // Dark parts (tyres, glass, trim) keep their colour.
          if (tint && m.map) m.color.multiply(tint);
          else if (tint && m.color.getHSL({}).l > 0.35) m.color.copy(tint);
          if (spec.burnt) { m.roughness = 0.95; m.metalness = 0.2; }
          if (!m.map && m.roughness === undefined) m.roughness = 0.8;
          if (!m.map && !node.name.match(/glass|window/i)) m.roughness = Math.max(m.roughness, 0.55);
          if (m.transparent && m.opacity > 0.95) m.transparent = false;
          return m;
        };
        node.material = Array.isArray(node.material) ? node.material.map(fix) : fix(node.material);
      });
      model.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(model);
      const center = bounds.getCenter(new THREE.Vector3());
      const wrapper = new THREE.Group();
      model.position.set(-center.x, -bounds.min.y, -center.z);
      wrapper.add(model);
      wrapper.userData.size = bounds.getSize(new THREE.Vector3());
      return wrapper;
    })());
  }
  return preparedTemplates.get(key);
}

function Props({ list, onColliders, onDone, colliders = true }) {
  const group = useRef();
  const reportAssetError = useGameStore((s) => s.reportAssetError);
  useEffect(() => {
    let cancelled = false;
    const added = [];
    Promise.allSettled(list.map(async ([key, x, z, yaw = 0, scale = 1, y = 0]) => {
      const template = await propTemplate(key);
      if (cancelled || !group.current) return;
      const instance = template.clone(true);
      instance.position.set(x, y, z);
      instance.rotation.y = yaw;
      instance.scale.setScalar(scale);
      group.current.add(instance);
      added.push(instance);
      const spec = PROP_MODELS[key];
      if (colliders && spec.collider !== false) {
        const size = template.userData.size.clone().multiplyScalar(scale);
        const isVehicle = spec.surface === 'vehicle';
        onColliders([{
          center: [x, y + size.y / 2, z],
          // Vehicles' boxes are trimmed so mirrors and overhangs do not catch.
          size: [size.x * (isVehicle ? 0.92 : 0.96), size.y * (isVehicle ? 0.9 : 1), size.z * (isVehicle ? 0.92 : 0.96)],
          yaw,
          surface: spec.surface,
          // Shrub-like foliage never blocks sight; everything else does.
          sight: size.y > 0.5,
        }]);
      }
    })).then((results) => {
      results.forEach((result, i) => {
        if (result.status === 'rejected') {
          const path = PROP_MODELS[list[i][0]]?.path || list[i][0];
          console.error(`[PROP] Failed to load ${path}`, result.reason);
          reportAssetError(path);
        }
      });
      if (!cancelled) onDone?.();
    });
    return () => {
      cancelled = true;
      added.forEach((object) => object.removeFromParent());
    };
  }, [list, onColliders, onDone, colliders, reportAssetError]);
  return <group ref={group} />;
}

// ---------------------------------------------------------------------------

export default function Battlefield() {
  const setWorldReady = useGameStore((s) => s.setWorldReady);
  const pending = useRef({ architecture: false, props: false });
  const registered = useRef([]);

  const addColliders = useMemo(() => (list) => {
    for (const box of list) registered.current.push(collisionWorld.add(box));
  }, []);

  const tryFinish = useMemo(() => () => {
    if (!pending.current.architecture || !pending.current.props) return;
    navGrid.build({ minX: PLAY_AREA.minX, maxX: PLAY_AREA.maxX, minZ: PLAY_AREA.minZ, maxZ: PLAY_AREA.maxZ, cell: 1, agentRadius: 0.42 });
    setWorldReady(true);
  }, [setWorldReady]);

  const onArchitecture = useMemo(() => (list) => {
    addColliders(list);
    pending.current.architecture = true;
    tryFinish();
  }, [addColliders, tryFinish]);
  const onPropsDone = useMemo(() => () => { pending.current.props = true; tryFinish(); }, [tryFinish]);

  useEffect(() => {
    // Invisible boundary: stops movement and bullets at the edge of the zone.
    const { minX, maxX, minZ, maxZ } = PLAY_AREA;
    const h = 12; const t = 1;
    addColliders([
      { center: [minX - t / 2, h / 2, (minZ + maxZ) / 2], size: [t, h, maxZ - minZ + 2], sight: false, surface: 'dirt', walkable: false },
      { center: [maxX + t / 2, h / 2, (minZ + maxZ) / 2], size: [t, h, maxZ - minZ + 2], sight: false, surface: 'dirt', walkable: false },
      { center: [(minX + maxX) / 2, h / 2, minZ - t / 2], size: [maxX - minX + 2, h, t], sight: false, surface: 'dirt', walkable: false },
      { center: [(minX + maxX) / 2, h / 2, maxZ + t / 2], size: [maxX - minX + 2, h, t], sight: false, surface: 'dirt', walkable: false },
    ]);
    return () => {
      registered.current.forEach((c) => collisionWorld.remove(c));
      registered.current = [];
      setWorldReady(false);
    };
  }, [addColliders, setWorldReady]);

  return (
    <group>
      <SkyDome />
      <Lighting />
      <Terrain />
      <GroundDecals />
      <Architecture onColliders={onArchitecture} />
      <Props list={PROPS} onColliders={addColliders} onDone={onPropsDone} />
      <Props list={BACKDROP} colliders={false} />
    </group>
  );
}

