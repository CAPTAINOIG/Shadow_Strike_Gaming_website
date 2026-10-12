// Shadow Strike: Last Stand - Settings Screen
import React from 'react';
import { useGameStore } from '../store/gameStore';

export default function Settings({ onBack }) {
  const masterVolume = useGameStore((s) => s.masterVolume);
  const sfxVolume = useGameStore((s) => s.sfxVolume);
  const musicVolume = useGameStore((s) => s.musicVolume);
  const mouseSensitivity = useGameStore((s) => s.mouseSensitivity);
  const graphicsQuality = useGameStore((s) => s.graphicsQuality);
  const setMasterVolume = useGameStore((s) => s.setMasterVolume);
  const setSfxVolume = useGameStore((s) => s.setSfxVolume);
  const setMusicVolume = useGameStore((s) => s.setMusicVolume);
  const setMouseSensitivity = useGameStore((s) => s.setMouseSensitivity);
  const setGraphicsQuality = useGameStore((s) => s.setGraphicsQuality);

  return (
    <div className="menu-container fade-in">
      <div className="menu-bg-overlay" />
      <div className="menu-content">
        <button className="back-btn" onClick={onBack}>
          ← BACK
        </button>
        <div className="section-title">SETTINGS</div>
        <div className="menu-divider" />

        <div className="settings-list">
          <div className="setting-row">
            <span className="setting-label">MASTER VOLUME</span>
            <div className="setting-control">
              <input
                className="setting-slider"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={masterVolume}
                onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
              />
              <span className="setting-value">{Math.round(masterVolume * 100)}%</span>
            </div>
          </div>

          <div className="setting-row">
            <span className="setting-label">SFX VOLUME</span>
            <div className="setting-control">
              <input
                className="setting-slider"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={sfxVolume}
                onChange={(e) => setSfxVolume(parseFloat(e.target.value))}
              />
              <span className="setting-value">{Math.round(sfxVolume * 100)}%</span>
            </div>
          </div>

          <div className="setting-row">
            <span className="setting-label">MUSIC VOLUME</span>
            <div className="setting-control">
              <input className="setting-slider" type="range" min="0" max="1" step="0.05" value={musicVolume}
                onChange={(event) => setMusicVolume(parseFloat(event.target.value))} />
              <span className="setting-value">{Math.round(musicVolume * 100)}%</span>
            </div>
          </div>

          <div className="setting-row">
            <span className="setting-label">MOUSE SENSITIVITY</span>
            <div className="setting-control">
              <input
                className="setting-slider"
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={mouseSensitivity}
                onChange={(e) => setMouseSensitivity(parseFloat(e.target.value))}
              />
              <span className="setting-value">{Math.round(mouseSensitivity * 100)}%</span>
            </div>
          </div>

          <div className="setting-row">
            <span className="setting-label">GRAPHICS QUALITY</span>
            <div className="setting-control">
              <select className="setting-select" value={graphicsQuality} onChange={(event) => setGraphicsQuality(event.target.value)}>
                <option value="low">LOW · MOBILE SAFE</option>
                <option value="medium">MEDIUM</option>
                <option value="high">HIGH · CINEMATIC</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
