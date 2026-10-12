// Shadow Strike: Last Stand - Main Application
import React from 'react';
import GameScene from './game/GameScene';
import MainMenu from './ui/MainMenu';
import HUD from './ui/HUD';
import PauseMenu from './ui/PauseMenu';
import GameOver from './ui/GameOver';
import MissionComplete from './ui/MissionComplete';
import InputManager from './ui/InputManager';
import { useGameStore } from './store/gameStore';

export default function App() {
  const gameState = useGameStore((s) => s.gameState);
  const missingAssets = useGameStore((s) => s.missingAssets);

  return (
    <div id="game-root" className="w-screen h-screen overflow-hidden bg-[#0a0a12]">
      {/* 3D Game World */}
      <GameScene />

      {/* UI Layers */}
      <MainMenu />
      <HUD />
      <PauseMenu />
      <GameOver />
      <MissionComplete />
      <InputManager />
      {missingAssets.length > 0 && gameState !== 'menu' && (
        <aside className="asset-error-panel" role="alert" aria-live="assertive">
          <strong>ASSET LOAD NOTICE</strong>
          <ul>{missingAssets.map((path) => <li key={path}>{path}</li>)}</ul>
        </aside>
      )}
    </div>
  );
}
