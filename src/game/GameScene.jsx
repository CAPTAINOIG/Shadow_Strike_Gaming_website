// Shadow Strike: Last Stand - Main Game Scene (3D Canvas)
import React, { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import ChunkManager from './ChunkManager';
import Player from './Player';
import EnemyManager from './EnemyManager';
import FriendlyManager from './FriendlyManager';
import VehicleSystem from './VehicleSystem';
import TrafficAI from './TrafficAI';
import PedestrianAI from './PedestrianAI';
import Effects from './Effects';
import PostProcessing from './PostProcessing';
import WantedSystem from './WantedSystem';
import MissionSystem from './MissionSystem';
import CityAtmosphere from './CityAtmosphere';
import { useGameStore, GAME_STATES } from '../store/gameStore';
import { combatSystem } from '../systems/combatSystem';
import { audioManager } from '../systems/audioManager';

function SceneContent() {
  const gameState = useGameStore((s) => s.gameState);
  const selectedLevel = useGameStore((s) => s.selectedLevel);
  const musicVolume = useGameStore((s) => s.musicVolume);
  const sfxVolume = useGameStore((s) => s.sfxVolume);
  const masterVolume = useGameStore((s) => s.masterVolume);

  // Initialize audio on first interaction
  useEffect(() => {
    const initAudio = () => {
      audioManager.init();
      window.removeEventListener('click', initAudio);
      window.removeEventListener('keydown', initAudio);
    };
    window.addEventListener('click', initAudio);
    window.addEventListener('keydown', initAudio);
    return () => {
      window.removeEventListener('click', initAudio);
      window.removeEventListener('keydown', initAudio);
    };
  }, []);

  useEffect(() => {
    audioManager.setMasterVolume(masterVolume);
    audioManager.setSfxVolume(sfxVolume);
    if (gameState === GAME_STATES.PLAYING) {
      audioManager.playLevelAmbience(selectedLevel, musicVolume * 0.45);
      audioManager.playLoop('combat_music', musicVolume * 0.24);
    } else {
      audioManager.stopAmbientAndMusic();
    }
  }, [gameState, selectedLevel, musicVolume, masterVolume, sfxVolume]);

  // Clear combat system when going back to menu
  useEffect(() => {
    if (gameState === GAME_STATES.MENU) {
      combatSystem.clear();
    }
  }, [gameState]);

  return (
    <>
      <color attach="background" args={['#9aaeb5']} />
      <fog attach="fog" args={['#9aaeb5', 75, 390]} />
      <CityAtmosphere />
      <ChunkManager />
      <Player />
      <EnemyManager />
      <FriendlyManager />
      <VehicleSystem />
      <TrafficAI />
      <PedestrianAI />
      <WantedSystem />
      <MissionSystem />
      <Effects />
      <PostProcessing />
    </>
  );
}

export default function GameScene() {
  const quality = useGameStore((state) => state.graphicsQuality);
  const setGraphicsQuality = useGameStore((state) => state.setGraphicsQuality);
  useEffect(() => {
    const isMobile = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    setGraphicsQuality(isMobile || (navigator.deviceMemory && navigator.deviceMemory <= 4) ? 'low' : 'medium');
  }, [setGraphicsQuality]);
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
      <Canvas
        shadows={quality !== 'low'}
        dpr={quality === 'low' ? 1 : quality === 'medium' ? [1, 1.15] : [1, 1.4]}
        camera={{
          fov: 60,
          near: 0.1,
          far: 200,
          position: [0, 4, 12],
        }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
        }}
        onCreated={({ gl }) => {
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = 2; // PCFSoftShadowMap
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <SceneContent />
      </Canvas>
    </div>
  );
}
