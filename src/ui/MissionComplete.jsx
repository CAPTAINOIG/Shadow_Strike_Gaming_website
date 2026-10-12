// Shadow Strike: Last Stand - Mission Complete Screen
import React from 'react';
import { useGameStore, GAME_STATES } from '../store/gameStore';

export default function MissionComplete() {
  const gameState = useGameStore((s) => s.gameState);
  const kills = useGameStore((s) => s.kills);
  const friendliesAlive = useGameStore((s) => s.friendliesAlive);
  const currentMission = useGameStore((s) => s.currentMission);
  const startGame = useGameStore((s) => s.startGame);
  const returnToMenu = useGameStore((s) => s.returnToMenu);

  if (gameState !== GAME_STATES.MISSION_COMPLETE) return null;

  return (
    <div className="overlay-container">
      <div className="overlay-backdrop success-backdrop" />
      <div className="overlay-panel success-panel">
        <div className="success-icon">⭐</div>
        <div className="overlay-title success-title">MISSION COMPLETE</div>
        <div className="overlay-subtitle">{currentMission.name}</div>
        <div className="overlay-divider" />
        <div className="mission-rewards">
          <div className="reward-row">
            <span className="reward-label">ENEMIES ELIMINATED</span>
            <span className="reward-value">{kills}</span>
          </div>
          <div className="reward-row">
            <span className="reward-label">SQUAD SURVIVED</span>
            <span className="reward-value">{friendliesAlive}/3</span>
          </div>
          <div className="reward-row">
            <span className="reward-label">XP EARNED</span>
            <span className="reward-value xp-value">+{currentMission.rewards?.xp || 500}</span>
          </div>
          <div className="reward-row">
            <span className="reward-label">CREDITS</span>
            <span className="reward-value credits-value">+{currentMission.rewards?.credits || 200}</span>
          </div>
        </div>
        <div className="overlay-buttons">
          <button id="btn-play-again" className="overlay-btn primary" onClick={startGame}>
            PLAY AGAIN
          </button>
          <button id="btn-complete-menu" className="overlay-btn" onClick={returnToMenu}>
            MAIN MENU
          </button>
        </div>
      </div>
    </div>
  );
}
