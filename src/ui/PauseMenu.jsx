// Shadow Strike: Last Stand - Pause Menu
import React from 'react';
import { useGameStore, GAME_STATES } from '../store/gameStore';

export default function PauseMenu() {
  const gameState = useGameStore((s) => s.gameState);
  const togglePause = useGameStore((s) => s.togglePause);
  const returnToMenu = useGameStore((s) => s.returnToMenu);

  if (gameState !== GAME_STATES.PAUSED) return null;

  return (
    <div className="overlay-container">
      <div className="overlay-backdrop" />
      <div className="overlay-panel">
        <div className="overlay-title" style={{ color: 'var(--primary)', textShadow: '0 0 20px rgba(0, 255, 136, 0.4)' }}>
          PAUSED
        </div>
        <div className="overlay-subtitle">GAME PAUSED</div>
        <div className="overlay-divider" />
        <div className="overlay-buttons">
          <button id="btn-resume" className="overlay-btn primary" onClick={togglePause}>
            RESUME
          </button>
          <button id="btn-quit-menu" className="overlay-btn danger" onClick={returnToMenu}>
            QUIT TO MENU
          </button>
        </div>
        <div className="overlay-hint">PRESS ESC TO RESUME</div>
      </div>
    </div>
  );
}
