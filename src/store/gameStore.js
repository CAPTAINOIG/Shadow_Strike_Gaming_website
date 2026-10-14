// Shadow Strike: Last Stand - Game Store (Zustand)
import { create } from 'zustand';
import { WEAPONS, PLAYER_LOADOUT } from '../data/weapons';
import { DEFAULT_MISSION } from '../data/missions';
import { ENEMY_SPAWN_POSITIONS } from '../data/enemies';

export const GAME_STATES = {
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'game_over',
  MISSION_COMPLETE: 'mission_complete',
};

const REGULAR_ENEMIES = ENEMY_SPAWN_POSITIONS.length;
const TOTAL_ENEMIES = REGULAR_ENEMIES + 1; // plus the commander

function freshLoadout() {
  return Object.fromEntries(PLAYER_LOADOUT.map((id) => {
    const weapon = Object.values(WEAPONS).find((w) => w.id === id);
    return [id, { ammo: weapon.magSize, reserve: weapon.magSize * weapon.spareMags }];
  }));
}

function freshMission() {
  return {
    ...DEFAULT_MISSION,
    objectives: DEFAULT_MISSION.objectives.map((o) => ({
      ...o,
      target: o.type === 'eliminate' ? REGULAR_ENEMIES : o.target,
      current: o.type === 'survive' ? 3 : 0,
    })),
  };
}

let reloadTimer = null;
let shootTimer = null;
let noticeTimer = null;
let nextId = 1;

export const useGameStore = create((set, get) => ({
  gameState: GAME_STATES.MENU,
  setGameState: (state) => set({ gameState: state }),
  missingAssets: [],
  reportAssetError: (path) => set((state) => ({
    missingAssets: state.missingAssets.includes(path) ? state.missingAssets : [...state.missingAssets, path],
  })),
  clearAssetErrors: () => set({ missingAssets: [] }),
  worldReady: false,
  setWorldReady: (worldReady) => set({ worldReady }),

  // Player
  playerHealth: 100,
  playerMaxHealth: 100,
  playerArmor: 100,
  playerMaxArmor: 100,
  lastHitTime: 0,
  regenerateArmor: (amount) => set((state) => ({ playerArmor: Math.min(state.playerMaxArmor, state.playerArmor + amount) })),
  playerPosition: { x: 0, y: 0, z: 0 },
  playerRotation: 0,
  setPlayerPosition: (pos) => set({ playerPosition: pos }),
  setPlayerRotation: (rot) => set({ playerRotation: rot }),
  isAiming: false,
  setAiming: (value) => set({ isAiming: Boolean(value) }),
  isCrouching: false,
  setCrouching: (value) => set({ isCrouching: Boolean(value) }),
  crosshairSpread: 0,
  setCrosshairSpread: (crosshairSpread) => set({ crosshairSpread }),

  // Weapons
  loadout: freshLoadout(),
  playerWeapon: WEAPONS.ASSAULT_RIFLE,
  playerAmmo: WEAPONS.ASSAULT_RIFLE.magSize,
  playerReserveAmmo: WEAPONS.ASSAULT_RIFLE.magSize * WEAPONS.ASSAULT_RIFLE.spareMags,
  isReloading: false,
  reloadStartedAt: 0,
  isShooting: false,

  selectWeapon: (weaponId) => {
    const state = get();
    const weapon = Object.values(WEAPONS).find((item) => item.id === weaponId);
    if (!weapon || !state.loadout[weaponId] || weapon.id === state.playerWeapon.id) return;
    clearTimeout(reloadTimer);
    const loadout = { ...state.loadout, [state.playerWeapon.id]: { ammo: state.playerAmmo, reserve: state.playerReserveAmmo } };
    set({ loadout, playerWeapon: weapon, playerAmmo: loadout[weaponId].ammo, playerReserveAmmo: loadout[weaponId].reserve, isReloading: false });
  },
  cycleWeapon: () => {
    const state = get();
    const index = PLAYER_LOADOUT.indexOf(state.playerWeapon.id);
    state.selectWeapon(PLAYER_LOADOUT[(index + 1) % PLAYER_LOADOUT.length]);
  },

  /** Spends one round. Returns false when empty or reloading. */
  consumeAmmo: () => {
    const s = get();
    if (s.isReloading || s.playerAmmo <= 0) return false;
    set({ playerAmmo: s.playerAmmo - 1, isShooting: true });
    clearTimeout(shootTimer);
    shootTimer = setTimeout(() => set({ isShooting: false }), 120);
    return true;
  },

  startReload: () => {
    const s = get();
    if (s.isReloading || s.playerAmmo === s.playerWeapon.magSize || s.playerReserveAmmo <= 0) return false;
    const weaponId = s.playerWeapon.id;
    set({ isReloading: true, reloadStartedAt: performance.now() });
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      const current = get();
      if (!current.isReloading || current.playerWeapon.id !== weaponId) return;
      const needed = current.playerWeapon.magSize - current.playerAmmo;
      const available = Math.min(needed, current.playerReserveAmmo);
      set({ playerAmmo: current.playerAmmo + available, playerReserveAmmo: current.playerReserveAmmo - available, isReloading: false });
    }, s.playerWeapon.reloadTime * 1000);
    return true;
  },

  // Feedback
  hitMarker: null, // { id, kill, headshot }
  triggerHitMarker: (kind = {}) => set({ hitMarker: { id: nextId++, ...kind } }),
  damageIndicators: [],
  showDamageOverlay: false,

  damagePlayer: (amount, sourcePosition) => {
    const state = get();
    if (state.gameState !== GAME_STATES.PLAYING || state.playerHealth <= 0) return;
    // Armour soaks 70% of incoming damage while it lasts.
    const absorbed = Math.min(state.playerArmor, amount * 0.7);
    const armor = state.playerArmor - absorbed;
    const health = Math.max(0, state.playerHealth - (amount - absorbed));
    const indicators = sourcePosition
      ? [...state.damageIndicators.filter((d) => performance.now() - d.time < 1800), { id: nextId++, x: sourcePosition.x, z: sourcePosition.z, time: performance.now() }].slice(-6)
      : state.damageIndicators;
    set({ playerHealth: health, playerArmor: armor, lastHitTime: Date.now(), showDamageOverlay: true, damageIndicators: indicators });
    setTimeout(() => set({ showDamageOverlay: false }), 260);
    if (health <= 0) setTimeout(() => { if (get().playerHealth <= 0) set({ gameState: GAME_STATES.GAME_OVER }); }, 2600);
  },

  // Mission
  currentMission: freshMission(),
  kills: 0,
  killFeed: [],
  friendliesAlive: 3,
  enemiesAlive: TOTAL_ENEMIES,
  enemiesTotal: TOTAL_ENEMIES,
  bossDown: false,
  alertLevel: 0,
  setAlertLevel: (alertLevel) => { if (get().alertLevel !== alertLevel) set({ alertLevel }); },
  missionNotice: '',
  setMissionNotice: (missionNotice) => set({ missionNotice }),
  flashNotice: (missionNotice, duration = 3200) => {
    set({ missionNotice });
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { if (get().missionNotice === missionNotice) set({ missionNotice: '' }); }, duration);
  },

  addKill: ({ source = 'YOU', victim = 'HOSTILE', headshot = false, boss = false } = {}) => {
    const s = get();
    const kills = s.kills + (source === 'YOU' ? 1 : 0);
    const enemiesAlive = Math.max(0, s.enemiesAlive - 1);
    const killed = s.enemiesTotal - enemiesAlive;
    const id = nextId++;
    const mission = {
      ...s.currentMission,
      objectives: s.currentMission.objectives.map((obj) => {
        if (obj.type === 'eliminate') return { ...obj, current: Math.min(obj.target, killed) };
        if (obj.type === 'commander') return { ...obj, current: boss ? 1 : obj.current };
        return obj;
      }),
    };
    set({ kills, enemiesAlive, currentMission: mission, bossDown: s.bossDown || boss, killFeed: [{ id, source, victim, headshot }, ...s.killFeed].slice(0, 4) });
    setTimeout(() => set((state) => ({ killFeed: state.killFeed.filter((entry) => entry.id !== id) })), 4000);
    if (boss) get().flashNotice('COMMANDER NEUTRALISED');
    if (enemiesAlive === 0) {
      get().flashNotice('AREA SECURE', 6000);
      setTimeout(() => { if (get().gameState === GAME_STATES.PLAYING) set({ gameState: GAME_STATES.MISSION_COMPLETE }); }, 3000);
    }
  },

  friendlyDied: () => {
    const alive = Math.max(0, get().friendliesAlive - 1);
    const mission = { ...get().currentMission };
    mission.objectives = mission.objectives.map((obj) => (obj.type === 'survive' ? { ...obj, current: alive } : obj));
    set({ friendliesAlive: alive, currentMission: mission });
    if (alive === 0) {
      get().flashNotice('SQUAD LOST — MISSION FAILED', 6000);
      setTimeout(() => { if (get().gameState === GAME_STATES.PLAYING) set({ gameState: GAME_STATES.GAME_OVER }); }, 2500);
    }
  },

  startGame: () => {
    clearTimeout(reloadTimer);
    set({
      gameState: GAME_STATES.PLAYING,
      missionNotice: '',
      missingAssets: get().missingAssets,
      playerHealth: 100,
      playerArmor: 100,
      lastHitTime: 0,
      loadout: freshLoadout(),
      playerWeapon: WEAPONS.ASSAULT_RIFLE,
      playerAmmo: WEAPONS.ASSAULT_RIFLE.magSize,
      playerReserveAmmo: WEAPONS.ASSAULT_RIFLE.magSize * WEAPONS.ASSAULT_RIFLE.spareMags,
      isReloading: false,
      isShooting: false,
      isAiming: false,
      isCrouching: false,
      kills: 0,
      killFeed: [],
      friendliesAlive: 3,
      enemiesAlive: TOTAL_ENEMIES,
      bossDown: false,
      alertLevel: 0,
      hitMarker: null,
      damageIndicators: [],
      showDamageOverlay: false,
      currentMission: freshMission(),
      runId: nextId++,
    });
  },
  runId: 0,

  returnToMenu: () => {
    clearTimeout(reloadTimer);
    if (document.pointerLockElement) document.exitPointerLock();
    set({ gameState: GAME_STATES.MENU, isReloading: false });
  },

  togglePause: () => {
    const s = get();
    if (s.gameState === GAME_STATES.PLAYING) {
      if (document.pointerLockElement) document.exitPointerLock();
      set({ gameState: GAME_STATES.PAUSED });
    } else if (s.gameState === GAME_STATES.PAUSED) set({ gameState: GAME_STATES.PLAYING });
  },

  // Settings
  masterVolume: 0.7,
  sfxVolume: 0.8,
  musicVolume: 0.5,
  mouseSensitivity: 0.5,
  setMasterVolume: (v) => set({ masterVolume: v }),
  setSfxVolume: (v) => set({ sfxVolume: v }),
  setMusicVolume: (v) => set({ musicVolume: v }),
  setMouseSensitivity: (v) => set({ mouseSensitivity: v }),
  graphicsQuality: 'medium',
  setGraphicsQuality: (quality) => set({ graphicsQuality: ['low', 'medium', 'high'].includes(quality) ? quality : 'medium' }),
}));
