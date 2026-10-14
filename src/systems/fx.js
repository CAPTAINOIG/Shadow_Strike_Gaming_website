// Shadow Strike: Last Stand - pooled combat effects.
// Particles, tracers, muzzle flashes, shell casings and bullet-hole decals all
// live in fixed-size pools and are updated imperatively once per frame.
import * as THREE from 'three';
import { collisionWorld } from './collisionWorld';

function canvasTexture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const softTexture = () => canvasTexture(64, (g, s) => {
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.45, 'rgba(255,255,255,0.45)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, s, s);
});

const flashTexture = () => canvasTexture(128, (g, s) => {
  g.translate(s / 2, s / 2);
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, s / 2);
  grad.addColorStop(0, 'rgba(255,250,225,1)'); grad.addColorStop(0.18, 'rgba(255,205,120,0.95)'); grad.addColorStop(0.5, 'rgba(255,140,40,0.25)'); grad.addColorStop(1, 'rgba(255,120,30,0)');
  g.fillStyle = grad;
  for (let i = 0; i < 7; i += 1) {
    g.rotate((Math.PI * 2) / 7 + (i % 2) * 0.2);
    g.beginPath(); g.moveTo(0, -5); g.lineTo(s * (i % 2 ? 0.3 : 0.48), 0); g.lineTo(0, 5); g.closePath(); g.fill();
  }
  g.beginPath(); g.arc(0, 0, s * 0.16, 0, Math.PI * 2); g.fill();
});

const holeTexture = () => canvasTexture(64, (g, s) => {
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, 'rgba(8,7,6,1)'); grad.addColorStop(0.22, 'rgba(18,16,14,0.95)'); grad.addColorStop(0.36, 'rgba(60,55,50,0.55)'); grad.addColorStop(0.6, 'rgba(90,85,80,0.18)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.fillRect(0, 0, s, s);
  g.strokeStyle = 'rgba(30,28,25,0.6)'; g.lineWidth = 1;
  for (let i = 0; i < 6; i += 1) {
    const a = Math.random() * Math.PI * 2; const r = s * (0.12 + Math.random() * 0.2);
    g.beginPath(); g.moveTo(s / 2 + Math.cos(a) * s * 0.1, s / 2 + Math.sin(a) * s * 0.1); g.lineTo(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r); g.stroke();
  }
});

const tracerTexture = () => canvasTexture(16, (g, s) => {
  const grad = g.createLinearGradient(0, 0, 0, s);
  grad.addColorStop(0, 'rgba(255,255,255,0)'); grad.addColorStop(0.7, 'rgba(255,230,170,0.85)'); grad.addColorStop(1, 'rgba(255,255,230,1)');
  g.fillStyle = grad; g.fillRect(0, 0, s, s);
});

// ---------------------------------------------------------------------------

class ParticlePool {
  constructor(count, texture, blending) {
    this.count = count;
    this.cursor = 0;
    this.position = new Float32Array(count * 3);
    this.velocity = new Float32Array(count * 3);
    this.color = new Float32Array(count * 4);
    this.baseColor = new Float32Array(count * 3);
    this.size = new Float32Array(count);
    this.data = new Float32Array(count * 6); // life, maxLife, size0, size1, gravity, drag
    this.alpha0 = new Float32Array(count);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.position, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.color, 4).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.material = new THREE.ShaderMaterial({
      uniforms: { map: { value: texture }, scale: { value: 600 } },
      vertexShader: `
        attribute float size; attribute vec4 color; varying vec4 vColor;
        uniform float scale;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * scale / max(-mv.z, 0.1);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D map; varying vec4 vColor;
        void main() {
          vec4 tex = texture2D(map, gl_PointCoord);
          gl_FragColor = vec4(vColor.rgb * tex.rgb, vColor.a * tex.a);
          if (gl_FragColor.a < 0.004) discard;
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      blending,
    });
    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.geometry = geometry;
  }

  spawn(x, y, z, vx, vy, vz, life, size0, size1, r, g, b, alpha, gravity = 0, drag = 0) {
    const i = this.cursor; this.cursor = (this.cursor + 1) % this.count;
    this.position.set([x, y, z], i * 3);
    this.velocity.set([vx, vy, vz], i * 3);
    this.baseColor.set([r, g, b], i * 3);
    this.data.set([life, life, size0, size1, gravity, drag], i * 6);
    this.alpha0[i] = alpha;
  }

  update(dt) {
    const { position: p, velocity: v, color: c, baseColor: bc, data: d, size } = this;
    for (let i = 0; i < this.count; i += 1) {
      const k = i * 6;
      if (d[k] <= 0) { c[i * 4 + 3] = 0; size[i] = 0; continue; }
      d[k] -= dt;
      const t = 1 - Math.max(d[k], 0) / d[k + 1];
      const drag = Math.max(0, 1 - d[k + 5] * dt);
      v[i * 3] *= drag; v[i * 3 + 1] = v[i * 3 + 1] * drag - d[k + 4] * dt; v[i * 3 + 2] *= drag;
      p[i * 3] += v[i * 3] * dt; p[i * 3 + 1] += v[i * 3 + 1] * dt; p[i * 3 + 2] += v[i * 3 + 2] * dt;
      if (p[i * 3 + 1] < 0.02 && d[k + 4] > 0) { p[i * 3 + 1] = 0.02; v[i * 3 + 1] *= -0.3; v[i * 3] *= 0.6; v[i * 3 + 2] *= 0.6; }
      size[i] = d[k + 2] + (d[k + 3] - d[k + 2]) * t;
      const fadeIn = Math.min(1, t * 8);
      c[i * 4] = bc[i * 3]; c[i * 4 + 1] = bc[i * 3 + 1]; c[i * 4 + 2] = bc[i * 3 + 2];
      c[i * 4 + 3] = this.alpha0[i] * fadeIn * (1 - t) * (1 - t * 0.3);
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;
  }
}

class TracerPool {
  constructor(count) {
    this.count = count;
    this.items = Array.from({ length: count }, () => ({ active: false, from: new THREE.Vector3(), dir: new THREE.Vector3(), distance: 0, travelled: 0, speed: 0, width: 0.025 }));
    const geometry = new THREE.PlaneGeometry(1, 1);
    geometry.rotateX(-Math.PI / 2); // length along Z, width along X
    geometry.translate(0, 0, -0.5); // origin at the head of the streak
    this.material = new THREE.MeshBasicMaterial({ map: tracerTexture(), color: '#ffcf86', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
    this.mesh = new THREE.InstancedMesh(geometry, this.material, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.cursor = 0;
    this.hide = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < count; i += 1) this.mesh.setMatrixAt(i, this.hide);
  }

  spawn(from, to, speed = 420) {
    const item = this.items[this.cursor]; this.cursor = (this.cursor + 1) % this.count;
    item.active = true;
    item.from.copy(from);
    item.dir.subVectors(to, from);
    item.distance = item.dir.length();
    item.dir.divideScalar(item.distance || 1);
    item.travelled = 0;
    item.speed = speed;
  }

  update(dt, camera) {
    for (let i = 0; i < this.count; i += 1) {
      const item = this.items[i];
      if (!item.active) continue;
      item.travelled += item.speed * dt;
      if (item.travelled - 7 > item.distance) { item.active = false; this.mesh.setMatrixAt(i, this.hide); continue; }
      const head = Math.min(item.travelled, item.distance);
      const tail = Math.max(0, item.travelled - 7);
      const length = Math.max(0.01, head - tail);
      _pos.copy(item.from).addScaledVector(item.dir, head);
      _z.copy(item.dir);
      _toCam.subVectors(camera.position, _pos);
      _x.crossVectors(_z, _toCam).normalize();
      _y.crossVectors(_z, _x);
      // The streak geometry extends backwards from its head along -Z.
      // Width grows with distance so far tracers stay visible but near ones stay thin.
      const camDistance = _mid.copy(item.from).addScaledVector(item.dir, (head + tail) / 2).distanceTo(camera.position);
      _m.makeBasis(_x, _y, _z).scale(_s.set(0.006 + camDistance * 0.0016, 1, length)).setPosition(_pos);
      this.mesh.setMatrixAt(i, _m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

class FlashPool {
  constructor(count) {
    this.count = count;
    this.material = new THREE.MeshBasicMaterial({ map: flashTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
    const geometry = new THREE.PlaneGeometry(1, 1);
    this.items = [];
    this.group = new THREE.Group();
    for (let i = 0; i < count; i += 1) {
      // Two crossed planes: a frontal star plus a side plume along the barrel.
      const front = new THREE.Mesh(geometry, this.material);
      const side = new THREE.Mesh(geometry, this.material);
      side.rotation.y = Math.PI / 2; side.scale.set(1.8, 0.7, 1); side.position.z = 0.35;
      const flash = new THREE.Group(); flash.add(front, side); flash.visible = false;
      this.group.add(flash);
      this.items.push({ flash, life: 0 });
    }
    this.cursor = 0;
    this.light = new THREE.PointLight('#ffb35c', 0, 9, 2);
    this.group.add(this.light);
  }

  spawn(position, direction, size = 1) {
    const item = this.items[this.cursor]; this.cursor = (this.cursor + 1) % this.count;
    item.life = 0.05;
    item.flash.visible = true;
    item.flash.position.copy(position);
    item.flash.lookAt(_tmp.copy(position).add(direction));
    item.flash.rotateZ(Math.random() * Math.PI);
    item.flash.scale.setScalar(0.32 * size * (0.8 + Math.random() * 0.4));
    this.light.position.copy(position).addScaledVector(direction, 0.2);
    this.light.intensity = 26 * size;
  }

  update(dt) {
    for (const item of this.items) {
      if (item.life <= 0) continue;
      item.life -= dt;
      if (item.life <= 0) item.flash.visible = false;
    }
    this.light.intensity = Math.max(0, this.light.intensity - dt * 600);
  }
}

class ShellPool {
  constructor(count) {
    this.count = count;
    const geometry = new THREE.CylinderGeometry(0.0045, 0.0045, 0.045, 6);
    geometry.rotateX(Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({ color: '#b58a3a', metalness: 0.9, roughness: 0.32 }), count);
    this.mesh.castShadow = false;
    this.mesh.frustumCulled = false;
    this.items = Array.from({ length: count }, () => ({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion(), spin: new THREE.Vector3(), floor: 0, resting: false }));
    this.cursor = 0;
    const hide = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < count; i += 1) this.mesh.setMatrixAt(i, hide);
    this.hide = hide;
  }

  spawn(position, velocity) {
    const item = this.items[this.cursor]; this.cursor = (this.cursor + 1) % this.count;
    item.life = 6; item.resting = false;
    item.p.copy(position); item.v.copy(velocity);
    item.q.setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, 0));
    item.spin.set((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30);
    item.floor = collisionWorld.supportHeight(position.x, position.z, 0.05, position.y, 0);
  }

  update(dt) {
    for (let i = 0; i < this.count; i += 1) {
      const item = this.items[i];
      if (item.life <= 0) continue;
      item.life -= dt;
      if (item.life <= 0) { this.mesh.setMatrixAt(i, this.hide); continue; }
      if (!item.resting) {
        item.v.y -= 9.8 * dt;
        item.p.addScaledVector(item.v, dt);
        _e.set(item.spin.x * dt, item.spin.y * dt, item.spin.z * dt);
        item.q.multiply(_q.setFromEuler(_e));
        if (item.p.y < item.floor + 0.005) {
          item.p.y = item.floor + 0.005;
          item.v.y *= -0.35; item.v.x *= 0.5; item.v.z *= 0.5; item.spin.multiplyScalar(0.5);
          if (Math.abs(item.v.y) < 0.4) { item.resting = true; item.q.setFromEuler(_e.set(0, Math.random() * 6, Math.PI / 2)); }
        }
      }
      _m.compose(item.p, item.q, _s.set(1, 1, 1));
      this.mesh.setMatrixAt(i, _m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

class DecalPool {
  constructor(count) {
    this.count = count;
    const geometry = new THREE.PlaneGeometry(1, 1);
    this.material = new THREE.MeshStandardMaterial({ map: holeTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: 1, color: '#ffffff' });
    this.mesh = new THREE.InstancedMesh(geometry, this.material, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    this.cursor = 0;
    const hide = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < count; i += 1) this.mesh.setMatrixAt(i, hide);
  }

  spawn(point, normal, size) {
    _pos.copy(point).addScaledVector(normal, 0.012);
    _q.setFromUnitVectors(_zAxis, normal);
    _q.multiply(_q2.setFromAxisAngle(_zAxis, Math.random() * Math.PI * 2));
    _m.compose(_pos, _q, _s.set(size, size, 1));
    this.mesh.setMatrixAt(this.cursor, _m);
    this.cursor = (this.cursor + 1) % this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// Surface response: chip colour, dust colour, sparks and decal size.
const SURFACES = {
  concrete: { chips: [0.62, 0.6, 0.56], dust: [0.66, 0.63, 0.58], sparks: 0, decal: 0.09 },
  brick: { chips: [0.55, 0.3, 0.22], dust: [0.62, 0.45, 0.38], sparks: 0, decal: 0.09 },
  metal: { chips: [0.5, 0.5, 0.5], dust: [0.45, 0.45, 0.45], sparks: 10, decal: 0.06 },
  vehicle: { chips: [0.4, 0.4, 0.38], dust: [0.45, 0.45, 0.43], sparks: 8, decal: 0.06 },
  wood: { chips: [0.45, 0.32, 0.18], dust: [0.5, 0.4, 0.28], sparks: 0, decal: 0.07 },
  sandbag: { chips: [0.5, 0.45, 0.33], dust: [0.6, 0.55, 0.42], sparks: 0, decal: 0.08 },
  dirt: { chips: [0.36, 0.3, 0.22], dust: [0.5, 0.44, 0.34], sparks: 0, decal: 0.12 },
  flesh: { chips: [0.32, 0.05, 0.04], dust: [0.38, 0.08, 0.06], sparks: 0, decal: 0 },
};

class FX {
  constructor() {
    this.ready = false;
  }

  init(scene) {
    if (this.ready) return;
    this.group = new THREE.Group();
    this.group.name = 'fx';
    this.additive = new ParticlePool(700, softTexture(), THREE.AdditiveBlending);
    this.smoke = new ParticlePool(900, softTexture(), THREE.NormalBlending);
    this.tracers = new TracerPool(48);
    this.flashes = new FlashPool(10);
    this.shells = new ShellPool(80);
    this.decals = new DecalPool(260);
    this.group.add(this.smoke.points, this.additive.points, this.tracers.mesh, this.flashes.group, this.shells.mesh, this.decals.mesh);
    scene.add(this.group);
    this.ready = true;
  }

  dispose() {
    if (!this.ready) return;
    this.group.removeFromParent();
    this.group.traverse((node) => { node.geometry?.dispose(); node.material?.map?.dispose(); node.material?.dispose?.(); });
    this.ready = false;
  }

  setViewportHeight(height) {
    if (!this.ready) return;
    this.additive.material.uniforms.scale.value = height * 0.5;
    this.smoke.material.uniforms.scale.value = height * 0.5;
  }

  muzzleFlash(position, direction, size = 1) {
    if (!this.ready) return;
    this.flashes.spawn(position, direction, size);
    for (let i = 0; i < 3; i += 1) {
      this.smoke.spawn(position.x, position.y, position.z,
        direction.x * (0.6 + i * 0.5) + (Math.random() - 0.5) * 0.3, direction.y * 0.6 + 0.25 + Math.random() * 0.2, direction.z * (0.6 + i * 0.5) + (Math.random() - 0.5) * 0.3,
        0.7 + Math.random() * 0.5, 0.05, 0.28 + i * 0.08, 0.72, 0.7, 0.66, 0.16, -0.25, 1.6);
    }
  }

  tracer(from, to) {
    if (this.ready) this.tracers.spawn(from, to);
  }

  shell(position, velocity) {
    if (this.ready) this.shells.spawn(position, velocity);
  }

  impact(point, normal, surface = 'concrete') {
    if (!this.ready) return;
    const s = SURFACES[surface] || SURFACES.concrete;
    const n = normal;
    // Debris chips thrown off the surface.
    const chips = surface === 'flesh' ? 6 : 9;
    for (let i = 0; i < chips; i += 1) {
      const speed = surface === 'flesh' ? 1.2 : 2.2 + Math.random() * 2.5;
      this.smoke.spawn(point.x, point.y, point.z,
        (n.x + (Math.random() - 0.5) * 1.3) * speed, (n.y + Math.random() * 0.8) * speed, (n.z + (Math.random() - 0.5) * 1.3) * speed,
        0.35 + Math.random() * 0.4, 0.035, 0.02, s.chips[0], s.chips[1], s.chips[2], 0.95, 9.8, 0.5);
    }
    // Dust puff drifting off the impact.
    const puffs = surface === 'flesh' ? 2 : 4;
    for (let i = 0; i < puffs; i += 1) {
      this.smoke.spawn(point.x + n.x * 0.05, point.y + n.y * 0.05, point.z + n.z * 0.05,
        n.x * 0.7 + (Math.random() - 0.5) * 0.4, n.y * 0.5 + 0.2 + Math.random() * 0.3, n.z * 0.7 + (Math.random() - 0.5) * 0.4,
        0.9 + Math.random() * 0.8, 0.12, surface === 'flesh' ? 0.3 : 0.75 + Math.random() * 0.4, s.dust[0], s.dust[1], s.dust[2], surface === 'flesh' ? 0.5 : 0.42, -0.08, 1.4);
    }
    for (let i = 0; i < s.sparks; i += 1) {
      const speed = 3 + Math.random() * 5;
      this.additive.spawn(point.x, point.y, point.z,
        (n.x + (Math.random() - 0.5) * 1.6) * speed, (n.y + Math.random()) * speed, (n.z + (Math.random() - 0.5) * 1.6) * speed,
        0.12 + Math.random() * 0.2, 0.03, 0.01, 1, 0.75, 0.4, 1, 9.8, 0.2);
    }
    if (s.decal) this.decals.spawn(point, n, s.decal * (0.8 + Math.random() * 0.5));
  }

  update(dt, camera) {
    if (!this.ready) return;
    this.additive.update(dt);
    this.smoke.update(dt);
    this.tracers.update(dt, camera);
    this.flashes.update(dt);
    this.shells.update(dt);
  }
}

const _pos = new THREE.Vector3();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _s = new THREE.Vector3();
const _toCam = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _zAxis = new THREE.Vector3(0, 0, 1);
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _e = new THREE.Euler();

export const fx = new FX();
