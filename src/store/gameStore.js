// Shadow Strike: Last Stand - Game Store (Zustand)
import { create } from 'zustand';
import { DEFAULT_PLAYER_WEAPON, WEAPONS } from '../data/weapons';
import { DEFAULT_MISSION } from '../data/missions';

export const GAME_STATES = {
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'game_over',
  MISSION_COMPLETE: 'mission_complete',
};

export const useGameStore = create((set, get) => ({
  // Game state
  gameState: GAME_STATES.MENU,
  setGameState: (state) => set({ gameState: state }),
  missingAssets: [],
  reportAssetError: (path) => set((state) => ({
    missingAssets: state.missingAssets.includes(path) ? state.missingAssets : [...state.missingAssets, path],
  })),
  clearAssetErrors: () => set({ missingAssets: [] }),

  // Player state
  playerHealth: 100,
  playerMaxHealth: 100,
  playerShield: 100,
  playerMaxShield: 100,
  lastShieldHitTime: 0,
  regenerateShield: (amount) => set((state) => ({ playerShield: Math.min(state.playerMaxShield, state.playerShield + amount) })),
  playerPosition: { x: 0, y: 0, z: 0 },
  playerRotation: 0,
  inVehicle: false,
  activeVehicleId: null,
  setVehicle: (id) => set({ inVehicle: Boolean(id), activeVehicleId: id || null }),
  wantedLevel: 0,
  raiseWantedLevel: (amount = 1) => set((state) => ({ wantedLevel: Math.min(5, state.wantedLevel + amount) })),
  clearWantedLevel: () => set({ wantedLevel: 0 }),
  openWorldMission: null,
  setOpenWorldMission: (mission) => set({ openWorldMission: mission }),
  missionNotice: '',
  setMissionNotice: (missionNotice) => set({ missionNotice }),
  cityWeather: 'DAY',
  setCityWeather: (cityWeather) => set({ cityWeather }),
  playerAmmo: DEFAULT_PLAYER_WEAPON.magSize,
  playerReserveAmmo: DEFAULT_PLAYER_WEAPON.magSize * 4,
  playerWeapon: DEFAULT_PLAYER_WEAPON,
  isReloading: false,
  isShooting: false,
  isAiming: false,
  setAiming: (value) => set({ isAiming: Boolean(value) }),
  isInCover: false,
  setInCover: (value) => set({ isInCover: Boolean(value) }),
  selectWeapon: (weaponId) => {
    const weapon = Object.values(WEAPONS).find((item) => item.id === weaponId);
    if (!weapon) return;
    set({ playerWeapon: weapon, playerAmmo: weapon.magSize, playerReserveAmmo: weapon.magSize * 4, isReloading: false });
  },
  cycleWeapon: () => {
    const choices = [WEAPONS.ASSAULT_RIFLE, WEAPONS.SHOTGUN, WEAPONS.SNIPER];
    const current = choices.findIndex((weapon) => weapon.id === get().playerWeapon.id);
    const next = choices[(current + 1) % choices.length];
    set({ playerWeapon: next, playerAmmo: next.magSize, playerReserveAmmo: next.magSize * 4, isReloading: false });
  },

  // Camera shake
  cameraShake: 0,
  setCameraShake: (v) => set({ cameraShake: v }),

  // Damage feedback
  showDamageOverlay: false,
  lastHitTime: 0,

  // Hit marker
  showHitMarker: false,
  hitMarkerTime: 0,

  // Mission
  currentMission: { ...DEFAULT_MISSION },
  selectedLevel: 'swamp',
  setSelectedLevel: (level) => set({ selectedLevel: level === 'snow' ? 'snow' : 'swamp' }),
  kills: 0,
  killFeed: [],
  nextKillFeedId: 0,

  // Squad and enemies alive counts
  friendliesAlive: 0,
  enemiesAlive: 0,
  bossUnlocked: false,
  activateBoss: () => set({ bossUnlocked: true }),

  // Effects queue
  effects: [],      // { id, type, position, direction, ... }
  nextEffectId: 0,
  addEffect: (effect) => {
    const id = get().nextEffectId;
    set((s) => ({
      effects: [...s.effects, { ...effect, id, createdAt: Date.now() }],
      nextEffectId: id + 1,
    }));
    // auto-remove after lifetime
    setTimeout(() => {
      set((s) => ({ effects: s.effects.filter((e) => e.id !== id) }));
    }, effect.lifetime || 500);
  },

  // Player actions
  setPlayerPosition: (pos) => set({ playerPosition: pos }),
  setPlayerRotation: (rot) => set({ playerRotation: rot }),

  damagePlayer: (amount) => {
    const state = get();
    const shieldDamage = Math.min(state.playerShield, amount);
    const shield = Math.max(0, state.playerShield - shieldDamage);
    const hp = Math.max(0, state.playerHealth - (amount - shieldDamage));
    set({ playerHealth: hp, playerShield: shield, lastShieldHitTime: Date.now(), showDamageOverlay: true, lastHitTime: Date.now(), cameraShake: 0.5 });
    setTimeout(() => set({ showDamageOverlay: false }), 300);
    if (hp <= 0) {
      set({ gameState: GAME_STATES.GAME_OVER });
    }
  },

  healPlayer: (amount) => {
    set((s) => ({ playerHealth: Math.min(s.playerMaxHealth, s.playerHealth + amount) }));
  },

  playerShoot: () => {
    const s = get();
    if (s.isReloading || s.playerAmmo <= 0) return false;
    set({ playerAmmo: s.playerAmmo - 1, isShooting: true, cameraShake: 0.15 });
    setTimeout(() => set({ isShooting: false }), 80);
    if (s.playerAmmo - 1 <= 0 && s.playerReserveAmmo > 0) {
      get().startReload();
    }
    return true;
  },

  startReload: () => {
    const s = get();
    if (s.isReloading || s.playerAmmo === s.playerWeapon.magSize || s.playerReserveAmmo <= 0) return;
    set({ isReloading: true });
    setTimeout(() => {
      const current = get();
      const needed = current.playerWeapon.magSize - current.playerAmmo;
      const available = Math.min(needed, current.playerReserveAmmo);
      set({
        playerAmmo: current.playerAmmo + available,
        playerReserveAmmo: current.playerReserveAmmo - available,
        isReloading: false,
      });
    }, s.playerWeapon.reloadTime * 1000);
  },

  triggerHitMarker: () => {
    set({ showHitMarker: true, hitMarkerTime: Date.now() });
    setTimeout(() => set({ showHitMarker: false }), 200);
  },

  addKill: (source = 'YOU') => {
    const s = get();
    const newKills = s.kills + 1;
    const newEnemiesAlive = Math.max(0, s.enemiesAlive - 1);
    const feedId = s.nextKillFeedId;
    const mission = { ...s.currentMission };
    mission.objectives = mission.objectives.map((obj) => {
      if (obj.type === 'eliminate') return { ...obj, current: newKills };
      return obj;
    });
    set((state) => ({
      kills: newKills,
      enemiesAlive: newEnemiesAlive,
      currentMission: mission,
      killFeed: [{ id: feedId, source }, ...state.killFeed].slice(0, 3),
      nextKillFeedId: feedId + 1,
    }));
    setTimeout(() => {
      set((state) => ({
        killFeed: state.killFeed.filter((entry) => entry.id !== feedId),
      }));
    }, 2400);
    // Check win condition
    if (newEnemiesAlive <= 0) {
      setTimeout(() => set({ gameState: GAME_STATES.MISSION_COMPLETE }), 1500);
    }
  },

  friendlyDied: () => {
    const alive = Math.max(0, get().friendliesAlive - 1);
    set({ friendliesAlive: alive });
    const mission = { ...get().currentMission };
    mission.objectives = mission.objectives.map((obj) => {
      if (obj.type === 'survive') return { ...obj, current: alive };
      return obj;
    });
    set({ currentMission: mission });
  },

  // Start/reset game
  startGame: () => {
    set({
      gameState: GAME_STATES.PLAYING,
      inVehicle: false,
      activeVehicleId: null,
      wantedLevel: 0,
      openWorldMission: null,
      missionNotice: '',
      cityWeather: 'DAY',
      missingAssets: [],
      playerHealth: 100,
      playerShield: 100,
      playerAmmo: DEFAULT_PLAYER_WEAPON.magSize,
      playerReserveAmmo: DEFAULT_PLAYER_WEAPON.magSize * 4,
      playerWeapon: DEFAULT_PLAYER_WEAPON,
      isReloading: false,
      isShooting: false,
      kills: 0,
      killFeed: [],
      friendliesAlive: 0,
      bossUnlocked: false,
      effects: [],
      showDamageOverlay: false,
      showHitMarker: false,
      cameraShake: 0,
      currentMission: {
        ...DEFAULT_MISSION,
        objectives: DEFAULT_MISSION.objectives.map((o) => ({
          ...o,
          target: o.type === 'eliminate' ? 10 : o.target,
          current: o.type === 'survive' ? 3 : 0,
        })),
      },
      enemiesAlive: 10,
    });
  },

  returnToMenu: () => {
    set({ gameState: GAME_STATES.MENU });
  },

  togglePause: () => {
    const s = get();
    if (s.gameState === GAME_STATES.PLAYING) set({ gameState: GAME_STATES.PAUSED });
    else if (s.gameState === GAME_STATES.PAUSED) set({ gameState: GAME_STATES.PLAYING });
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
