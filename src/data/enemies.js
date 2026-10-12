// Shadow Strike: Last Stand - Enemy Data
export const ENEMY_TYPES = {
  GRUNT: {
    id: 'grunt',
    name: 'Grunt',
    health: 80,
    speed: 2.5,
    detectionRange: 35,
    attackRange: 30,
    accuracy: 0.55,
    color: '#8B0000',     // Dark red uniform
    helmetColor: '#4a0000',
    vestColor: '#5c1010',
  },
  RIFLEMAN: {
    id: 'rifleman',
    name: 'Rifleman',
    health: 100,
    speed: 3.0,
    detectionRange: 45,
    attackRange: 40,
    accuracy: 0.65,
    color: '#6B1515',
    helmetColor: '#3d0a0a',
    vestColor: '#7a2020',
  },
  HEAVY: {
    id: 'heavy',
    name: 'Heavy',
    health: 180,
    speed: 1.8,
    detectionRange: 30,
    attackRange: 25,
    accuracy: 0.5,
    color: '#4a0e0e',
    helmetColor: '#2a0505',
    vestColor: '#600f0f',
  },
  BOSS: {
    id: 'boss',
    name: 'WRAITH COMMANDER',
    health: 950,
    speed: 2.1,
    detectionRange: 90,
    attackRange: 38,
    accuracy: 0.72,
    color: '#242b38',
    helmetColor: '#151b2b',
    vestColor: '#313b4d',
  },
  DRONE: {
    id: 'drone',
    name: 'STALKER DRONE',
    health: 130,
    speed: 3.8,
    detectionRange: 52,
    attackRange: 32,
    accuracy: 0.61,
    color: '#38454c',
    helmetColor: '#28343c',
    vestColor: '#46545b',
  },
};

// Initial spawn positions for 8 enemies (spread across the battlefield ahead of the player)
export const ENEMY_SPAWN_POSITIONS = [
  { x: 15, z: -25, type: 'GRUNT' },
  { x: -10, z: -30, type: 'RIFLEMAN' },
  { x: 25, z: -40, type: 'GRUNT' },
  { x: -20, z: -35, type: 'GRUNT' },
  { x: 5, z: -50, type: 'RIFLEMAN' },
  { x: -15, z: -55, type: 'HEAVY' },
  { x: 30, z: -45, type: 'RIFLEMAN' },
  { x: 0, z: -60, type: 'GRUNT' },
  { x: 11, z: -70, type: 'DRONE' },
];

export const FRIENDLY_SPAWN_OFFSETS = [
  { x: -3, z: 2 },
  { x: 3, z: 2 },
  { x: 0, z: 4 },
];
