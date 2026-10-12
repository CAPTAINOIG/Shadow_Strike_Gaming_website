import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { setCityConditions } from './WorldGenerator';
import { useGameStore } from '../store/gameStore';

function RainField({ active }) {
  const quality = useGameStore((s) => s.graphicsQuality);
  const ref = useRef();
  const count = quality === 'low' ? 480 : quality === 'medium' ? 900 : 1400;
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry(); const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) { p[i * 3] = (Math.random() - 0.5) * 70; p[i * 3 + 1] = Math.random() * 24; p[i * 3 + 2] = (Math.random() - 0.5) * 70; }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3)); return g;
  }, [count]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame((_, delta) => {
    if (!active || !ref.current) return;
    const player = useGameStore.getState().playerPosition;
    ref.current.position.set(player.x, 0, player.z);
    const p = geometry.attributes.position.array;
    for (let i = 0; i < count; i++) {
      const offset = i * 3; p[offset + 1] -= delta * 25; p[offset] += delta * 1.2;
      if (p[offset + 1] < 0) { p[offset + 1] = 22; p[offset] = (Math.random() - 0.5) * 70; p[offset + 2] = (Math.random() - 0.5) * 70; }
    }
    geometry.attributes.position.needsUpdate = true;
  });
  if (!active) return null;
  return <points ref={ref} geometry={geometry} frustumCulled={false}>
    <pointsMaterial color="#b8d8e8" size={0.095} transparent opacity={0.68} depthWrite={false} sizeAttenuation />
  </points>;
}

export default function CityAtmosphere() {
  const { scene } = useThree();
  // Begin in full daylight so a fresh free-roam session never starts as an unreadable night scene.
  const sun = useRef(); const hemi = useRef(); const elapsed = useRef(130); const lastWeather = useRef('');
  const [rain, setRain] = useState(false);
  const daySky = useMemo(() => new THREE.Color('#a6bac3'), []);
  const nightSky = useMemo(() => new THREE.Color('#101724'), []);
  const weather = useGameStore((s) => s.setCityWeather);
  useFrame((_, delta) => {
    elapsed.current += delta;
    const phase = (elapsed.current / 260) % 1;
    const daylight = THREE.MathUtils.clamp((Math.sin(phase * Math.PI * 2 - Math.PI / 2) + 0.12) / 0.9, 0, 1);
    const night = 1 - daylight;
    const raining = phase > 0.64 && phase < 0.72;
    if (raining !== rain) setRain(raining);
    setCityConditions({ night, rain: raining ? 1 : 0 });
    if (scene.background?.isColor) scene.background.copy(nightSky).lerp(daySky, daylight);
    if (scene.fog) scene.fog.color.copy(nightSky).lerp(daySky, daylight);
    if (sun.current) {
      const player = useGameStore.getState().playerPosition;
      const angle = phase * Math.PI * 2 - Math.PI / 2;
      sun.current.position.set(player.x + Math.cos(angle) * 150, Math.max(10, Math.sin(angle) * 180), player.z + 90);
      sun.current.intensity = 0.35 + daylight * 2.6;
    }
    if (hemi.current) hemi.current.intensity = 0.65 + daylight * 1.25;
    const next = raining ? 'RAIN' : night > 0.62 ? 'NIGHT' : 'DAY';
    if (next !== lastWeather.current) { lastWeather.current = next; weather(next); }
  });
  return <>
    <directionalLight ref={sun} position={[100, 150, 80]} intensity={2} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
    <hemisphereLight ref={hemi} args={['#dbeeff', '#595d55', 1.5]} />
    <RainField active={rain} />
  </>;
}
