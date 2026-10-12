// Shadow Strike: Last Stand - Weapon Data
export const WEAPONS = {
  ASSAULT_RIFLE: {
    id: 'assault_rifle',
    name: 'M4A1 ASSAULT RIFLE',
    damage: 18,
    fireRate: 0.12,       // seconds between shots
    magSize: 30,
    reloadTime: 2.2,      // seconds
    range: 80,
    spread: 0.03,
    headshotMultiplier: 2.5,
    bulletSpeed: 200,
  },
  SMG: {
    id: 'smg',
    name: 'MP5 SMG',
    damage: 12,
    fireRate: 0.08,
    magSize: 25,
    reloadTime: 1.8,
    range: 50,
    spread: 0.05,
    headshotMultiplier: 2.0,
    bulletSpeed: 180,
  },
  SNIPER: {
    id: 'sniper',
    name: 'SVD SNIPER',
    damage: 75,
    fireRate: 1.2,
    magSize: 5,
    reloadTime: 3.0,
    range: 150,
    spread: 0.005,
    headshotMultiplier: 3.0,
    bulletSpeed: 350,
  },
  SHOTGUN: {
    id: 'shotgun',
    name: 'M870 SHOTGUN',
    damage: 10,  // per pellet, fires 8 pellets
    fireRate: 0.8,
    magSize: 6,
    reloadTime: 2.5,
    range: 25,
    spread: 0.12,
    pellets: 8,
    headshotMultiplier: 1.5,
    bulletSpeed: 150,
  },
  PISTOL: {
    id: 'pistol',
    name: 'M9 PISTOL',
    damage: 22,
    fireRate: 0.25,
    magSize: 15,
    reloadTime: 1.5,
    range: 40,
    spread: 0.02,
    headshotMultiplier: 2.0,
    bulletSpeed: 160,
  },
};

export const DEFAULT_PLAYER_WEAPON = WEAPONS.ASSAULT_RIFLE;
export const DEFAULT_ENEMY_WEAPON = WEAPONS.ASSAULT_RIFLE;
export const DEFAULT_FRIENDLY_WEAPON = WEAPONS.ASSAULT_RIFLE;
