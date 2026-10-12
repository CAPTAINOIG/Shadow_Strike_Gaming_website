// Shadow Strike: Last Stand - Main Menu
import React, { useState, useEffect } from 'react';
import { useGameStore, GAME_STATES } from '../store/gameStore';
import HowToPlay from './HowToPlay';
import Settings from './Settings';

export default function MainMenu() {
  const gameState = useGameStore((s) => s.gameState);
  const startGame = useGameStore((s) => s.startGame);
  const [fadeIn, setFadeIn] = useState(false);
  const [subMenu, setSubMenu] = useState(null);

  useEffect(() => {
    if (gameState === GAME_STATES.MENU) {
      setTimeout(() => setFadeIn(true), 100);
      setSubMenu(null);
    } else {
      setFadeIn(false);
    }
  }, [gameState]);

  if (gameState !== GAME_STATES.MENU) return null;

  if (subMenu === 'howto') {
    return <HowToPlay onBack={() => setSubMenu(null)} />;
  }
  if (subMenu === 'settings') {
    return <Settings onBack={() => setSubMenu(null)} />;
  }
  return (
    <div className={`menu-container ${fadeIn ? 'fade-in' : ''}`}>
      <div className="menu-bg-overlay" />

      {/* Corner decorations */}
      <div className="menu-corner top-left" />
      <div className="menu-corner top-right" />
      <div className="menu-corner bottom-left" />
      <div className="menu-corner bottom-right" />

      <div className="menu-content">
        {/* Title */}
        <div className="menu-title-section">
          <div className="menu-subtitle">OPEN WORLD ACTION</div>
          <h1 className="menu-title">
            <span className="title-shadow">SHADOW</span>
            <span className="title-strike">STRIKE</span>
          </h1>
          <div className="menu-tagline">CITY AFTER DARK</div>
          <div className="menu-divider" />
        </div>

        {/* Navigation */}
        <nav className="menu-nav">
          <button id="btn-new-game" className="menu-btn" onClick={startGame}>
            <span className="menu-btn-indicator" />
            <span className="menu-btn-text">ENTER THE CITY</span>
            <span className="menu-btn-arrow">›</span>
          </button>

          <button id="btn-how-to-play" className="menu-btn" onClick={() => setSubMenu('howto')}>
            <span className="menu-btn-indicator" />
            <span className="menu-btn-text">HOW TO PLAY</span>
            <span className="menu-btn-arrow">›</span>
          </button>

          <button id="btn-settings" className="menu-btn" onClick={() => setSubMenu('settings')}>
            <span className="menu-btn-indicator" />
            <span className="menu-btn-text">SETTINGS</span>
            <span className="menu-btn-arrow">›</span>
          </button>
        </nav>

        {/* Footer */}
        <div className="menu-footer">
          <span>v1.0</span>
          <span>SHADOW STRIKE</span>
        </div>
      </div>
    </div>
  );
}
