import React from 'react';
import { useGameStore, GAME_STATES } from '../store/gameStore';

export default function HUD() {
  const gameState = useGameStore((s) => s.gameState);
  const health = useGameStore((s) => s.playerHealth);
  const maxHealth = useGameStore((s) => s.playerMaxHealth);
  const shield = useGameStore((s) => s.playerShield);
  const maxShield = useGameStore((s) => s.playerMaxShield);
  const ammo = useGameStore((s) => s.playerAmmo);
  const reserve = useGameStore((s) => s.playerReserveAmmo);
  const weapon = useGameStore((s) => s.playerWeapon);
  const reloading = useGameStore((s) => s.isReloading);
  const aiming = useGameStore((s) => s.isAiming);
  const wanted = useGameStore((s) => s.wantedLevel);
  const weather = useGameStore((s) => s.cityWeather);
  const mission = useGameStore((s) => s.openWorldMission);
  const notice = useGameStore((s) => s.missionNotice);
  const rotation = useGameStore((s) => s.playerRotation);
  const px = useGameStore((s) => Math.floor(s.playerPosition.x / 25) * 25);
  const pz = useGameStore((s) => Math.floor(s.playerPosition.z / 25) * 25);
  if (gameState !== GAME_STATES.PLAYING) return null;
  const targetX = mission?.target ? 50 + Math.max(-38, Math.min(38, (mission.target.x - px) / 5)) : 50;
  const targetY = mission?.target ? 50 + Math.max(-38, Math.min(38, (mission.target.z - pz) / 5)) : 50;

  return <div className="hud-container city-hud">
    <div className={`crosshair ${aiming ? 'crosshair-aim' : ''}`}><div className="crosshair-line crosshair-top" /><div className="crosshair-line crosshair-bottom" /><div className="crosshair-line crosshair-left" /><div className="crosshair-line crosshair-right" /><div className="crosshair-dot" /></div>
    <div className="wanted-stars"><span>WANTED</span>{Array.from({ length: 5 }, (_, i) => <b key={i} className={i < wanted ? 'active' : ''}>★</b>)}</div>
    <div className="city-weather">{weather} <i>·</i> FREE ROAM</div>
    <div className="city-minimap" aria-label="City minimap">
      <span className="map-north">N</span><div className="map-road map-road-a" /><div className="map-road map-road-b" /><div className="map-road map-road-c" /><div className="map-road map-road-d" />
      {mission?.target && <i className="map-target" style={{ left: `${targetX}%`, top: `${targetY}%` }} />}<i className="map-player" /><span className="map-scale">CITY GRID</span>
    </div>
    <div className="hud-health city-health">
      <div className="hud-label">SHIELD <span>{Math.ceil(shield)}</span></div><div className="hud-bar"><div className="hud-bar-fill" style={{ width: `${100 * shield / maxShield}%`, background: '#62cfff' }} /></div>
      <div className="hud-label">HEALTH</div><div className="hud-bar"><div className="hud-bar-fill" style={{ width: `${100 * health / maxHealth}%`, background: health > 35 ? '#25d895' : '#ff4654' }} /></div><div className="hud-value">{Math.ceil(health)}</div>
    </div>
    <div className="hud-weapon"><div className="hud-weapon-name">{weapon.name}</div><div className="hud-ammo"><span className="hud-ammo-current">{ammo}</span><span className="hud-ammo-separator"> / </span><span className="hud-ammo-reserve">{reserve}</span></div>{reloading && <div className="hud-label">RELOADING…</div>}</div>
    <div className="hud-compass"><span>HEADING</span><strong>{['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(((((-rotation * 180 / Math.PI) % 360) + 360) % 360) / 45) % 8]}</strong></div>
    <div className="city-mission"><span>ACTIVE JOB</span><strong>{mission?.title || 'Explore the city'}</strong><p>{mission?.status === 'complete' ? 'Job complete' : mission?.objective || 'Press M to browse jobs'}</p><small>{mission?.hint || 'M  JOB BOARD'}</small></div>
    {notice && <div className="mission-complete-toast" role="status">{notice}</div>}
    <div className="city-controls-hint">WASD WALK · F ENTER/EXIT · M JOBS · LMB FIRE · R RELOAD · ESC PAUSE</div>
  </div>;
}
