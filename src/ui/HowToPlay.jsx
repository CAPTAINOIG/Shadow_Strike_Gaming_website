// How to Play screen
import React from 'react';

export default function HowToPlay({ onBack }) {
  const controls = [
    { key: 'W A S D', action: 'Move' },
    { key: 'Mouse', action: 'Look / Aim' },
    { key: 'Left Click', action: 'Shoot' },
    { key: 'Right Click', action: 'Aim Down Sights' },
    { key: 'Shift', action: 'Sprint' },
    { key: 'Space', action: 'Jump' },
    { key: 'C', action: 'Toggle Crouch' },
    { key: 'R', action: 'Reload' },
    { key: '1 - 4', action: 'Switch Weapon' },
    { key: 'E', action: 'Interact' },
    { key: 'Esc', action: 'Pause Game' },
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
            Complete mission objectives shown in the top-right corner of the HUD.
            Eliminate enemies, collect intel, and reach the extraction zone marked
            by a green beacon.
          </p>
        </div>

        <div className="how-to-section">
          <h3 className="how-to-heading">WEAPONS</h3>
          <p className="how-to-text">
            Switch between 4 weapons using number keys. Each weapon has different
            damage, fire rate, and accuracy. Collect ammo pickups (orange boxes)
            to resupply. Health pickups (green boxes) restore 25 HP.
          </p>
        </div>

        <div className="how-to-section">
          <h3 className="how-to-heading">TIPS</h3>
          <ul className="how-to-list">
            <li>Use cover to avoid enemy fire</li>
            <li>Aim down sights for better accuracy</li>
            <li>Reload before entering combat</li>
            <li>Use the sniper rifle for distant enemies</li>
            <li>The shotgun is devastating at close range</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
