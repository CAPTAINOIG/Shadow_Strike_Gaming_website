// Shadow Strike: Last Stand - Enemy Data
// accuracy: base hit quality (0-1); reaction: seconds from spotting to first shot.
export const ENEMY_TYPES = {
  GRUNT: { id: 'grunt', name: 'Insurgent', health: 100, speed: 3.1, detectionRange: 55, attackRange: 45, accuracy: 0.5, reaction: 0.75, burst: [3, 5], aggression: 0.35 },
  RIFLEMAN: { id: 'rifleman', name: 'Rifleman', health: 110, speed: 3.3, detectionRange: 65, attackRange: 55, accuracy: 0.6, reaction: 0.6, burst: [3, 6], aggression: 0.5 },
  HEAVY: { id: 'heavy', name: 'Machine Gunner', health: 190, speed: 2.4, detectionRange: 55, attackRange: 50, accuracy: 0.45, reaction: 0.8, burst: [6, 10], aggression: 0.2 },
  SCOUT: { id: 'scout', name: 'Scout', health: 90, speed: 3.6, detectionRange: 70, attackRange: 50, accuracy: 0.55, reaction: 0.5, burst: [3, 4], aggression: 0.8 },
  BOSS: { id: 'boss', name: 'Compound Commander', health: 420, speed: 2.8, detectionRange: 80, attackRange: 55, accuracy: 0.65, reaction: 0.5, burst: [4, 7], aggression: 0.4 },
};

// Spawn positions with patrol routes, from the village checkpoint to the compound.
export const ENEMY_SPAWN_POSITIONS = [
  { x: -3, z: -22, type: 'GRUNT', patrol: [[-3, -22], [8, -22.5], [3, -25]] },
  { x: 8, z: -23.5, type: 'RIFLEMAN', patrol: [[8, -23.5], [11, -14.5], [3, -16]] },
  { x: 12, z: -31, type: 'GRUNT', patrol: [[11, -31], [20, -31], [21, -20]] },
  { x: -13, z: -36, type: 'RIFLEMAN', patrol: [[-12, -37], [-12, -25], [-27, -25], [-27, -38]] },
  { x: -8, z: -49, type: 'SCOUT', patrol: [[-9, -49], [2, -48], [-1, -40], [-14, -44]] },
  { x: -6, z: -60, type: 'HEAVY', patrol: [[-6, -60], [-2, -60]] },
  { x: 11, z: -60, type: 'RIFLEMAN', patrol: [[11, -60], [18, -60], [11, -64]] },
  { x: -18, z: -68, type: 'GRUNT', patrol: [[-18, -68], [-6, -72], [-22, -80], [-33, -70]] },
  { x: 19, z: -64, type: 'SCOUT', patrol: [[18, -64], [32, -64], [32, -80], [20, -82]] },
];

export const BOSS_SPAWN = { x: 0, z: -88, type: 'BOSS', patrol: [[0, -88], [-10, -88], [10, -90]] };

export const FRIENDLY_SPAWN_OFFSETS = [
  { x: -3.5, z: 2.5 },
  { x: 3.5, z: 2.5 },
  { x: 0, z: 5 },
];
