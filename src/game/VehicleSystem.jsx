import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { clone as cloneModel } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { loadGLTF } from './assetLoader';
import { useGameStore, GAME_STATES } from '../store/gameStore';
import { audioManager } from '../systems/audioManager';

const MODEL_PATHS = {
  sedan: '/assets/vehicles/sedan.glb',
  sports: '/assets/vehicles/sports_car.glb',
  truck: '/assets/vehicles/truck.glb',
  police: '/assets/vehicles/police_car.glb',
};
const CAR_COLORS = { sedan: '#b7c4cd', sports: '#c64b39', truck: '#787f78', police: '#e6e8e7' };
const carFailures = new Set();
const registry = new Map();
const CAR_BODY_GEOMETRY = makeProfile([[-0.78, -1.75], [0.78, -1.75], [0.9, -1.2], [0.86, 1.3], [0.65, 1.8], [-0.65, 1.8], [-0.86, 1.3], [-0.9, -1.2]]);
const CAR_CABIN_GEOMETRY = makeProfile([[-0.56, -0.88], [0.56, -0.88], [0.53, 0.77], [0.32, 1.05], [-0.32, 1.05], [-0.53, 0.77]]);
const CAR_WHEEL_GEOMETRY = new THREE.CylinderGeometry(0.34, 0.34, 0.22, 14);
const CAR_RIM_GEOMETRY = new THREE.CylinderGeometry(0.19, 0.19, 0.025, 12);
const CAR_MATERIALS = {
  body: Object.fromEntries(Object.entries(CAR_COLORS).map(([type, color]) => [type, new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.55 })])),
  cabin: new THREE.MeshStandardMaterial({ color: '#213842', roughness: 0.3, metalness: 0.42, transparent: true, opacity: 0.84 }),
  tire: new THREE.MeshStandardMaterial({ color: '#131719', roughness: 0.9 }),
  rim: new THREE.MeshStandardMaterial({ color: '#a4a9aa', metalness: 0.75, roughness: 0.3 }),
  headlamp: new THREE.MeshBasicMaterial({ color: '#fff0c2' }),
  taillamp: new THREE.MeshBasicMaterial({ color: '#ff3028' }),
};

function makeProfile(points) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], index) => index === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y));
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.54, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.07, bevelThickness: 0.06 });
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function ProceduralCar({ type }) {
  return <group>
    <mesh geometry={CAR_BODY_GEOMETRY} position={[0, 0.42, 0]} castShadow receiveShadow material={CAR_MATERIALS.body[type] || CAR_MATERIALS.body.sedan} />
    <mesh geometry={CAR_CABIN_GEOMETRY} position={[0, 0.87, 0]} castShadow material={CAR_MATERIALS.cabin} />
    {[-1, 1].flatMap((side) => [-1, 1].map((axle) => <group key={`${side}_${axle}`} position={[side * 0.83, 0.34, axle * 1.18]} rotation={[0, 0, Math.PI / 2]}>
      <mesh geometry={CAR_WHEEL_GEOMETRY} castShadow material={CAR_MATERIALS.tire} />
      <mesh geometry={CAR_RIM_GEOMETRY} position={[0, side * 0.12, 0]} material={CAR_MATERIALS.rim} />
    </group>))}
    <group position={[0, 0.52, -1.73]}>
      <mesh position={[-0.47, 0, 0]} material={CAR_MATERIALS.headlamp}><circleGeometry args={[0.13, 10]} /></mesh>
      <mesh position={[0.47, 0, 0]} material={CAR_MATERIALS.headlamp}><circleGeometry args={[0.13, 10]} /></mesh>
    </group>
    <mesh position={[-0.5, 0.55, 1.73]} material={CAR_MATERIALS.taillamp}><circleGeometry args={[0.12, 10]} /></mesh>
    <mesh position={[0.5, 0.55, 1.73]} material={CAR_MATERIALS.taillamp}><circleGeometry args={[0.12, 10]} /></mesh>
  </group>;
}

export function VehicleActor({ data, register, reportAssetError }) {
  const renderer = useThree((s) => s.gl);
  const groupRef = useRef();
  const [model, setModel] = useState(null);
  const [failed, setFailed] = useState(false);
  const path = MODEL_PATHS[data.type];
  useEffect(() => {
    registry.set(data.id, { ref: groupRef, data });
    register(data.id, { ref: groupRef, data });
    return () => { registry.delete(data.id); register(data.id, null); };
  }, [data, register]);
  useEffect(() => {
    let cancelled = false;
    loadGLTF(path, renderer).then((gltf) => {
      if (cancelled) return;
      const clone = cloneModel(gltf.scene);
      clone.traverse((node) => { if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; node.frustumCulled = false; } });
      clone.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(clone);
      const dimensions = bounds.getSize(new THREE.Vector3());
      if (dimensions.y > 0) clone.scale.setScalar(1.55 / dimensions.y);
      clone.updateMatrixWorld(true);
      const groundBounds = new THREE.Box3().setFromObject(clone);
      clone.position.y -= groundBounds.min.y;
      setModel(clone);
      console.info(`[VEHICLE] Loaded ${path}`);
    }).catch((error) => {
      if (cancelled) return;
      setFailed(true);
      if (!carFailures.has(path)) {
        carFailures.add(path);
        console.error(`[VEHICLE] Missing model ${path}; using the custom non-box car mesh`, error);
        reportAssetError(path);
      }
    });
    return () => { cancelled = true; };
  }, [path, renderer, reportAssetError]);
  return <group ref={groupRef} position={data.position} rotation={[0, data.yaw, 0]} userData={{ vehicle: true, vehicleId: data.id }}>
    {model ? <primitive object={model} /> : <ProceduralCar type={data.type} />}
  </group>;
}

export default function VehicleSystem() {
  const cx = useGameStore((s) => Math.floor(s.playerPosition.x / 100));
  const cz = useGameStore((s) => Math.floor(s.playerPosition.z / 100));
  const inVehicle = useGameStore((s) => s.inVehicle);
  const activeVehicleId = useGameStore((s) => s.activeVehicleId);
  const gameState = useGameStore((s) => s.gameState);
  const setVehicle = useGameStore((s) => s.setVehicle);
  const reportAssetError = useGameStore((s) => s.reportAssetError);
  const { camera } = useThree();
  const keys = useRef({ throttle: false, brake: false, left: false, right: false, handbrake: false });
  const speed = useRef(0);
  const [nearby, setNearby] = useState(null);
  const cars = useMemo(() => {
    const result = [];
    for (let z = cz - 1; z <= cz + 1; z++) for (let x = cx - 1; x <= cx + 1; x++) {
      const baseX = x * 100; const baseZ = z * 100;
      const variants = [
        ['sedan', [baseX + 50, 0, baseZ + 44], 0],
        ['sports', [baseX + 50, 0, baseZ + 22], 0],
      ];
      variants.forEach(([type, position, yaw], i) => result.push({ id: `${x}:${z}:${i}`, type, position, yaw }));
    }
    return result;
  }, [cx, cz]);
  const register = useMemo(() => (id, entry) => { if (entry) registry.set(id, entry); else registry.delete(id); }, []);

  useEffect(() => {
    const down = (event) => {
      const key = event.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') keys.current.throttle = true;
      if (key === 's' || key === 'arrowdown') keys.current.brake = true;
      if (key === 'a' || key === 'arrowleft') keys.current.left = true;
      if (key === 'd' || key === 'arrowright') keys.current.right = true;
      if (key === ' ' && inVehicle) keys.current.handbrake = true;
      if (key === 'f' && gameState === GAME_STATES.PLAYING) {
        if (useGameStore.getState().inVehicle) {
          const id = useGameStore.getState().activeVehicleId;
          const vehicle = registry.get(id);
          if (vehicle?.ref.current) {
            const car = vehicle.ref.current;
            const exit = new THREE.Vector3(Math.cos(car.rotation.y), 0, -Math.sin(car.rotation.y)).multiplyScalar(2.2);
            useGameStore.getState().setPlayerPosition({ x: car.position.x + exit.x, y: 0, z: car.position.z + exit.z });
          }
          setVehicle(null); speed.current = 0; audioManager.stopLoop('vehicle_engine');
          return;
        }
        const player = useGameStore.getState().playerPosition;
        let best = null; let bestDistance = 4.8;
        registry.forEach((vehicle, id) => {
          const node = vehicle.ref.current;
          if (!node) return;
          const distance = Math.hypot(node.position.x - player.x, node.position.z - player.z);
          if (distance < bestDistance) { best = id; bestDistance = distance; }
        });
        if (best) { setVehicle(best); audioManager.playLoop('vehicle_engine', 0.22); }
      }
    };
    const up = (event) => {
      const key = event.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') keys.current.throttle = false;
      if (key === 's' || key === 'arrowdown') keys.current.brake = false;
      if (key === 'a' || key === 'arrowleft') keys.current.left = false;
      if (key === 'd' || key === 'arrowright') keys.current.right = false;
      if (key === ' ') keys.current.handbrake = false;
    };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [gameState, inVehicle, setVehicle]);

  useFrame((_, delta) => {
    const player = useGameStore.getState().playerPosition;
    let nearest = null; let nearestDistance = 4.8;
    registry.forEach((vehicle, id) => {
      if (id === activeVehicleId || !vehicle.ref.current) return;
      const node = vehicle.ref.current;
      const distance = Math.hypot(node.position.x - player.x, node.position.z - player.z);
      if (distance < nearestDistance) { nearest = id; nearestDistance = distance; }
    });
    setNearby((current) => current === nearest ? current : nearest);
    if (!inVehicle) return;
    const vehicle = registry.get(activeVehicleId);
    const node = vehicle?.ref.current;
    if (!node) return;
    const dt = Math.min(delta, 0.05);
    const control = keys.current;
    if (control.throttle) speed.current = Math.min(22, speed.current + 12 * dt);
    else speed.current *= Math.pow(control.handbrake ? 0.88 : 0.97, dt * 60);
    if (control.brake) speed.current = Math.abs(speed.current) > 0.6 ? speed.current - Math.sign(speed.current) * 19 * dt : Math.max(-7, speed.current - 5 * dt);
    const steering = (Number(control.right) - Number(control.left));
    if (Math.abs(speed.current) > 0.2) node.rotation.y += steering * (control.handbrake ? 2.2 : 1.25) * dt * Math.sign(speed.current);
    const forward = new THREE.Vector3(-Math.sin(node.rotation.y), 0, -Math.cos(node.rotation.y));
    const next = node.position.clone().addScaledVector(forward, speed.current * dt);
    let collided = false;
    registry.forEach((other, id) => {
      if (id === activeVehicleId || !other.ref.current) return;
      if (Math.hypot(other.ref.current.position.x - next.x, other.ref.current.position.z - next.z) < 3.1) collided = true;
    });
    if (collided) speed.current *= -0.22;
    else node.position.copy(next);
    useGameStore.getState().setPlayerPosition({ x: node.position.x, y: 0, z: node.position.z });
    useGameStore.getState().setPlayerRotation(node.rotation.y);
    camera.position.lerp(node.position.clone().add(new THREE.Vector3(Math.sin(node.rotation.y) * 7, 4, Math.cos(node.rotation.y) * 7)), 0.12);
    camera.lookAt(node.position.x, node.position.y + 1.1, node.position.z);
  });

  return <>
    {cars.map((data) => <VehicleActor key={data.id} data={data} register={register} reportAssetError={reportAssetError} />)}
    {nearby && !inVehicle && gameState === GAME_STATES.PLAYING && <Html fullscreen><div className="vehicle-prompt">F&nbsp; ENTER VEHICLE</div></Html>}
    {inVehicle && <Html fullscreen><div className="vehicle-controls">W / S DRIVE&nbsp; · &nbsp;A / D STEER&nbsp; · &nbsp;SPACE DRIFT&nbsp; · &nbsp;F EXIT</div></Html>}
  </>;
}
