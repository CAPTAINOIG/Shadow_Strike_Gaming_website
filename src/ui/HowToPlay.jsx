// How to Play screen
import React from 'react';

export default function HowToPlay({ onBack }) {
  const controls = [
    { key: 'W A S D', action: 'Move' },
    { key: 'Mouse', action: 'Look / Aim' },
    { key: 'Left Click', action: 'Fire' },
    { key: 'Right Click (hold)', action: 'Aim down sights / scope' },
    { key: 'Shift', action: 'Sprint' },
    { key: 'Space', action: 'Jump / stand up' },
    { key: 'C or Ctrl', action: 'Toggle crouch (use cover)' },
    { key: 'R', action: 'Reload' },
    { key: '1 / 2 / 3 or Wheel', action: 'Carbine / Shotgun / Bolt-action' },
    { key: 'Q', action: 'Swap camera shoulder' },
    { key: 'Esc', action: 'Pause' },
  ];

  return (
    <div className="menu-container fade-in">
      <div className="menu-bg-overlay" />
      <div className="menu-content" style={{ maxWidth: '600px' }}>
        <button className="back-btn" onClick={onBack}>
          ← BACK
        </button>
        <h2 className="section-title">HOW TO PLAY</h2>
        <div className="overlay-divider" />

        <div className="how-to-section">
          <h3 className="how-to-heading">CONTROLS</h3>
          <div className="controls-grid">
            {controls.map((c) => (
              <div key={c.key} className="control-row">
                <span className="control-key">{c.key}</span>
                <span className="control-action">{c.action}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="how-to-section">
          <h3 className="how-to-heading">OBJECTIVES</h3>
          <p className="how-to-text">
            Push north from FOB Kestrel, clear the village checkpoint and the ruins, then breach the walled compound and neutralise its commander. Objectives are listed top-left; the compass marker points to the compound.
          </p>
        </div>

        <div className="how-to-section">
          <h3 className="how-to-heading">WEAPONS</h3>
          <p className="how-to-text">
            You carry an M4 carbine, a pump shotgun and a bolt-action rifle, each with its own magazine and reserve. Aiming tightens your spread; moving, jumping and sustained fire widen it. Armour absorbs most incoming damage and recharges when you avoid fire.
          </p>
        </div>

        <div className="how-to-section">
          <h3 className="how-to-heading">TIPS</h3>
          <ul className="how-to-list">
            <li>Crouch behind sandbags, walls and vehicles: cover really stops bullets</li>
            <li>Enemies hear gunfire and will search where they last saw you</li>
            <li>Headshots deal far more damage than limb hits</li>
            <li>Reload in cover; your squad will hold positions near you</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
