// Shadow Strike: Last Stand - Game Over Screen
import React from 'react';
import { useGameStore, GAME_STATES } from '../store/gameStore';

export default function GameOver() {
  const gameState = useGameStore((s) => s.gameState);
  const kills = useGameStore((s) => s.kills);
  const startGame = useGameStore((s) => s.startGame);
  const returnToMenu = useGameStore((s) => s.returnToMenu);

  if (gameState !== GAME_STATES.GAME_OVER) return null;

  return (
    <div className="overlay-container">
      <div className="overlay-backdrop death-backdrop" />
      <div className="overlay-panel death-panel">
        <div className="death-icon">☠</div>
        <div className="overlay-title death-title">KIA</div>
        <div className="overlay-subtitle">KILLED IN ACTION</div>
        <div className="overlay-divider" />
        <div className="death-stats">
          <div className="stat-row">
            <span className="stat-label">ENEMIES ELIMINATED</span>
            <span className="stat-value">{kills}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">STATUS</span>
            <span className="stat-value" style={{ color: 'var(--danger)' }}>FAILED</span>
          </div>
        </div>
        <div className="overlay-buttons">
          <button id="btn-retry" className="overlay-btn primary" onClick={startGame}>
            RETRY MISSION
          </button>
          <button id="btn-gameover-menu" className="overlay-btn" onClick={returnToMenu}>
            MAIN MENU
          </button>
        </div>
      </div>
    </div>
  );
}
