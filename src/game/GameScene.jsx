// Shadow Strike: Last Stand - Main Game Scene (3D Canvas)
import React, { useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import Battlefield from './Battlefield';
import Player from './Player';
import EnemyManager from './EnemyManager';
import FriendlyManager from './FriendlyManager';
import Effects from './Effects';
import PostProcessing from './PostProcessing';
import { useGameStore, GAME_STATES } from '../store/gameStore';
import { combatSystem } from '../systems/combatSystem';
import { audioManager } from '../systems/audioManager';
import { loadSoldier } from './soldierAssets';

// Slow aerial orbit over the combat zone behind the main menu.
function MenuCamera() {
  const camera = useThree((s) => s.camera);
  useFrame(({ clock }) => {
    const state = useGameStore.getState().gameState;
    if (state !== GAME_STATES.MENU) return;
    const t = clock.elapsedTime * 0.035;
    camera.position.set(Math.sin(t) * 46 + 4, 15 + Math.sin(t * 1.7) * 2, -38 + Math.cos(t) * 46);
    camera.lookAt(0, 2, -42);
    if (camera.fov !== 55) { camera.fov = 55; camera.updateProjectionMatrix(); }
    audioManager.updateListener(camera);
  });
  return null;
}

// Picks a starting quality from the GPU, then steps down if gameplay runs slowly.
function QualityGovernor() {
  const gl = useThree((s) => s.gl);
  const sample = React.useRef({ frames: 0, time: 0, checks: 0 });
  useEffect(() => {
    const context = gl.getContext();
    const info = context.getExtension('WEBGL_debug_renderer_info');
    const renderer = info ? String(context.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    const weakIntegrated = /Intel.*(HD|UHD) Graphics|Mali|Adreno|PowerVR|SwiftShader|llvmpipe/i.test(renderer) && !/Iris|Arc/i.test(renderer);
    const mobile = window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(any-pointer: fine)').matches;
    useGameStore.getState().setGraphicsQuality(weakIntegrated || mobile ? 'low' : 'medium');
  }, [gl]);
  useFrame((_, delta) => {
    const store = useGameStore.getState();
    if (store.gameState !== GAME_STATES.PLAYING) { sample.current.frames = 0; sample.current.time = 0; return; }
    const s = sample.current;
    s.frames += 1; s.time += delta;
    if (s.time < 4) return;
    const fps = s.frames / s.time;
    s.frames = 0; s.time = 0; s.checks += 1;
    if (fps < 24 && s.checks > 1) {
      if (store.graphicsQuality === 'high') store.setGraphicsQuality('medium');
      else if (store.graphicsQuality === 'medium') store.setGraphicsQuality('low');
    }
  });
  return null;
}

function SceneContent() {
  const gameState = useGameStore((s) => s.gameState);
  const sfxVolume = useGameStore((s) => s.sfxVolume);
  const masterVolume = useGameStore((s) => s.masterVolume);
  const musicVolume = useGameStore((s) => s.musicVolume);

  // Audio can only start after a user gesture.
  useEffect(() => {
    const initAudio = () => {
      audioManager.init();
      audioManager.ensureContext();
      window.removeEventListener('pointerdown', initAudio);
      window.removeEventListener('keydown', initAudio);
    };
    window.addEventListener('pointerdown', initAudio);
    window.addEventListener('keydown', initAudio);
    // Start fetching the soldier while the menu is up.
    loadSoldier().catch(() => {});
    return () => {
      window.removeEventListener('pointerdown', initAudio);
      window.removeEventListener('keydown', initAudio);
    };
  }, []);

  useEffect(() => {
    audioManager.setMasterVolume(masterVolume);
    audioManager.setSfxVolume(sfxVolume);
    audioManager.setAmbienceVolume(musicVolume);
    if (gameState === GAME_STATES.PLAYING) audioManager.startAmbience();
    else if (gameState === GAME_STATES.MENU) audioManager.stopAmbience();
  }, [gameState, masterVolume, sfxVolume, musicVolume]);

  useEffect(() => {
    if (gameState === GAME_STATES.MENU) combatSystem.clear();
  }, [gameState]);

  return (
    <>
      <QualityGovernor />
      <Battlefield />
      <MenuCamera />
      <Player />
      <EnemyManager />
      <FriendlyManager />
      <Effects />
      <PostProcessing />
    </>
  );
}

export default function GameScene() {
  const quality = useGameStore((state) => state.graphicsQuality);
  // Low quality renders slightly below native resolution on weak GPUs.
  const dpr = quality === 'low' ? Math.min(0.85, window.devicePixelRatio) : quality === 'medium' ? [1, 1.25] : [1, 1.6];
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
      <Canvas
        shadows={{ type: quality === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap }}
        dpr={dpr}
        camera={{ fov: 55, near: 0.05, far: 900, position: [40, 16, 0] }}
        gl={{ antialias: true, powerPreference: 'high-performance', stencil: false }}
        onCreated={({ gl, scene, camera }) => {
          if (import.meta.env.DEV) window.__three = { gl, scene, camera };
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.0;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <SceneContent />
      </Canvas>
    </div>
  );
}
