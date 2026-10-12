// Shadow Strike: Last Stand - Mission Select (placeholder)
import React from 'react';

export default function MissionSelect({ onBack }) {
  return (
    <div className="menu-container fade-in">
      <div className="menu-bg-overlay" />
      <div className="menu-content">
        <button className="back-btn" onClick={onBack}>← BACK</button>
        <div className="section-title">MISSIONS</div>
        <div className="overlay-divider" />
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '20px' }}>
          More missions coming soon...
        </p>
      </div>
    </div>
  );
}
