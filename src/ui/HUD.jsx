// Shadow Strike: Last Stand - tactical HUD.
import React, { useEffect, useState } from 'react';
import { useGameStore, GAME_STATES } from '../store/gameStore';

const OBJECTIVE_POINT = { x: 2, z: -72 };
const HEADINGS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const FIRE_MODE = { assault_rifle: 'AUTO', shotgun: 'PUMP', sniper: 'BOLT' };
const THREAT = [
  { label: 'UNDETECTED', tone: 'calm' },
  { label: 'ENEMY SEARCHING', tone: 'caution' },
  { label: 'ENGAGED', tone: 'danger' },
];

// Our yaw: 0 faces -Z (north on the compass), increasing counter-clockwise.
const mod = (value, m) => ((value % m) + m) % m;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const toHeadingDeg = (yaw) => mod(-yaw * 180 / Math.PI, 360);

function Compass({ yaw, px, pz, showObjective }) {
  const heading = toHeadingDeg(yaw);
  const ticks = [];
  for (let deg = 0; deg < 360; deg += 15) {
    let offset = deg - heading;
    if (offset > 180) offset -= 360;
    if (offset < -180) offset += 360;
    if (Math.abs(offset) > 75) continue;
    const label = deg % 45 === 0 ? HEADINGS[deg / 45] : null;
    ticks.push(<div key={deg} className={`tac-compass-tick ${label ? 'major' : ''}`} style={{ left: `${50 + offset / 1.5}%` }}>{label && <span>{label}</span>}</div>);
  }
  let marker = null;
  if (showObjective) {
    const bearing = mod(Math.atan2(OBJECTIVE_POINT.x - px, -(OBJECTIVE_POINT.z - pz)) * 180 / Math.PI, 360);
    let offset = bearing - heading;
    if (offset > 180) offset -= 360;
    if (offset < -180) offset += 360;
    const distance = Math.round(Math.hypot(OBJECTIVE_POINT.x - px, OBJECTIVE_POINT.z - pz));
    marker = <div className="tac-compass-objective" style={{ left: `${50 + clamp(offset, -75, 75) / 1.5}%` }}><b /><small>{distance}m</small></div>;
  }
  return (
    <div className="tac-compass" aria-label={`Heading ${Math.round(heading)} degrees`}>
      {ticks}{marker}
      <div className="tac-compass-center" />
      <div className="tac-compass-readout">{String(Math.round(heading) % 360).padStart(3, '0')}</div>
    </div>
  );
}

function Crosshair({ spread, aiming, sprinting, weaponId }) {
  const gap = 6 + spread * 0.9;
  if (aiming && weaponId === 'sniper') return null;
  return (
    <div className={`tac-crosshair ${sprinting ? 'dim' : ''}`} style={{ '--gap': `${gap}px` }}>
      <i className="t" /><i className="b" /><i className="l" /><i className="r" /><i className="dot" />
    </div>
  );
}

function HitMarker() {
  const marker = useGameStore((s) => s.hitMarker);
  if (!marker) return null;
  return <div key={marker.id} className={`tac-hitmarker ${marker.kill ? 'kill' : ''} ${marker.headshot ? 'head' : ''}`}><i /><i /><i /><i /></div>;
}

function DamageIndicators({ px, pz, yaw }) {
  const indicators = useGameStore((s) => s.damageIndicators);
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!indicators.length) return undefined;
    const timer = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(timer);
  }, [indicators]);
  return (
    <div className="tac-damage-ring">
      {indicators.filter((d) => now - d.time < 1800).map((d) => {
        // Angle of the source relative to where the camera faces (0 = ahead).
        const worldAngle = Math.atan2(-(d.x - px), -(d.z - pz));
        const relative = (worldAngle - yaw) * -180 / Math.PI;
        return <div key={d.id} className="tac-damage-arc" style={{ transform: `rotate(${relative}deg)`, opacity: 1 - (now - d.time) / 1800 }} />;
      })}
    </div>
  );
}

function ReloadBar({ weapon }) {
  const reloading = useGameStore((s) => s.isReloading);
  const started = useGameStore((s) => s.reloadStartedAt);
  if (!reloading) return null;
  return (
    <div className="tac-reload">
      <span>RELOADING</span>
      <div className="tac-reload-track"><div key={started} className="tac-reload-fill" style={{ animationDuration: `${weapon.reloadTime}s` }} /></div>
    </div>
  );
}

export default function HUD() {
  const gameState = useGameStore((s) => s.gameState);
  const worldReady = useGameStore((s) => s.worldReady);
  const health = useGameStore((s) => s.playerHealth);
  const maxHealth = useGameStore((s) => s.playerMaxHealth);
  const armor = useGameStore((s) => s.playerArmor);
  const maxArmor = useGameStore((s) => s.playerMaxArmor);
  const ammo = useGameStore((s) => s.playerAmmo);
  const reserve = useGameStore((s) => s.playerReserveAmmo);
  const weapon = useGameStore((s) => s.playerWeapon);
  const aiming = useGameStore((s) => s.isAiming);
  const crouching = useGameStore((s) => s.isCrouching);
  const spread = useGameStore((s) => s.crosshairSpread);
  const rotation = useGameStore((s) => s.playerRotation);
  const position = useGameStore((s) => s.playerPosition);
  const mission = useGameStore((s) => s.currentMission);
  const alertLevel = useGameStore((s) => s.alertLevel);
  const enemiesAlive = useGameStore((s) => s.enemiesAlive);
  const friendliesAlive = useGameStore((s) => s.friendliesAlive);
  const killFeed = useGameStore((s) => s.killFeed);
  const notice = useGameStore((s) => s.missionNotice);
  const bossDown = useGameStore((s) => s.bossDown);
  const [hintVisible, setHintVisible] = useState(true);

  useEffect(() => {
    if (gameState !== GAME_STATES.PLAYING) return undefined;
    setHintVisible(true);
    const timer = setTimeout(() => setHintVisible(false), 14000);
    return () => clearTimeout(timer);
  }, [gameState]);

  if (gameState !== GAME_STATES.PLAYING) return null;
  if (!worldReady) return <div className="tac-loading">DEPLOYING TO AREA OF OPERATIONS…</div>;

  const threat = THREAT[alertLevel] || THREAT[0];
  const lowAmmo = ammo <= Math.ceil(weapon.magSize * 0.25);
  const scoped = aiming && weapon.id === 'sniper';

  return (
    <div className="tac-hud">
      {scoped && <div className="tac-scope"><div className="tac-scope-reticle" /></div>}
      <Compass yaw={rotation} px={position.x} pz={position.z} showObjective={!bossDown} />
      {health > 0 && <Crosshair spread={spread} aiming={aiming} sprinting={false} weaponId={weapon.id} />}
      <HitMarker />
      <DamageIndicators px={position.x} pz={position.z} yaw={rotation} />

      <section className="tac-panel tac-objectives" aria-label="Mission objectives">
        <header>{mission.name}</header>
        {mission.objectives.map((objective) => {
          const done = objective.type === 'survive' ? false : objective.current >= objective.target;
          const failed = objective.type === 'survive' && objective.current <= 0;
          return (
            <div key={objective.id} className={`tac-objective ${done ? 'done' : ''} ${failed ? 'failed' : ''}`}>
              <i />
              <span>{objective.text}</span>
              {objective.type === 'eliminate' && <em>{objective.current}/{objective.target}</em>}
              {objective.type === 'survive' && <em>{objective.current}/3</em>}
            </div>
          );
        })}
      </section>

      <section className="tac-panel tac-status" aria-label="Threat status">
        <div className={`tac-threat ${threat.tone}`}><i />{threat.label}</div>
        <div className="tac-status-row"><span>HOSTILES</span><b>{enemiesAlive}</b></div>
        <div className="tac-status-row"><span>SQUAD</span><b>{friendliesAlive}/3</b></div>
      </section>

      <div className="tac-killfeed">
        {killFeed.map((entry) => (
          <div key={entry.id} className="tac-kill">
            <span className={entry.source === 'YOU' ? 'you' : ''}>{entry.source}</span>
            <i>{entry.headshot ? '⌖' : '›'}</i>
            <span>{entry.victim}</span>
          </div>
        ))}
      </div>

      <section className="tac-vitals" aria-label="Health and armour">
        <div className="tac-vital">
          <label>ARMOR</label>
          <div className="tac-bar armor"><div style={{ width: `${(armor / maxArmor) * 100}%` }} /></div>
          <b>{Math.ceil(armor)}</b>
        </div>
        <div className="tac-vital">
          <label>HEALTH</label>
          <div className={`tac-bar health ${health < 35 ? 'critical' : ''}`}><div style={{ width: `${(health / maxHealth) * 100}%` }} /></div>
          <b>{Math.ceil(health)}</b>
        </div>
        <div className="tac-stance">{crouching ? 'CROUCHED' : 'STANDING'}</div>
      </section>

      <section className="tac-weapon" aria-label="Weapon">
        <div className="tac-weapon-name">{weapon.name}<span>{FIRE_MODE[weapon.id]}</span></div>
        <div className="tac-ammo">
          <b className={lowAmmo ? 'low' : ''}>{ammo}</b>
          <span>/ {reserve}</span>
        </div>
        <div className="tac-mag">{Array.from({ length: Math.min(weapon.magSize, 30) }, (_, i) => <i key={i} className={i < ammo ? 'full' : ''} />)}</div>
        <ReloadBar weapon={weapon} />
        {ammo === 0 && reserve === 0 && <div className="tac-reload"><span className="danger">NO AMMUNITION</span></div>}
        {ammo === 0 && reserve > 0 && !useGameStore.getState().isReloading && <div className="tac-reload"><span className="danger">PRESS R TO RELOAD</span></div>}
      </section>

      {notice && <div className="tac-notice" role="status">{notice}</div>}
      {hintVisible && (
        <div className="tac-hint">
          WASD MOVE · SHIFT SPRINT · RMB AIM · LMB FIRE · R RELOAD · C CROUCH · SPACE JUMP · Q SWAP SHOULDER · 1-3 WEAPONS · ESC PAUSE
        </div>
      )}
    </div>
  );
}
