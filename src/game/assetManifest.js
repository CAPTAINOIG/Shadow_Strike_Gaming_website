export const LEVEL_ASSETS = {
  swamp: [
    '/assets/models/levels/swamp/swamp_navmesh.glb',
    '/assets/models/levels/swamp/swamp_ground.glb',
    '/assets/models/levels/swamp/collapsed_concrete_ruins.glb',
    '/assets/models/levels/swamp/tall_grass.glb',
    '/assets/models/levels/swamp/swamp_foliage.glb',
    '/assets/models/levels/swamp/water_and_mud.glb',
  ],
  snow: [
    '/assets/models/levels/snow/snow_city_navmesh.glb',
    '/assets/models/levels/snow/snow_city_ground.glb',
    '/assets/models/levels/snow/abandoned_city_ruins.glb',
    '/assets/models/levels/snow/wrecked_armored_vehicle.glb',
    '/assets/models/levels/snow/snow_piles.glb',
    '/assets/models/levels/snow/ice_fog_volume.glb',
  ],
};

const COMMON_REQUIRED_ASSETS = [
  '/assets/models/player.glb',
  '/assets/models/enemies/swarmer.glb',
  '/assets/models/enemies/shooter.glb',
  '/assets/models/enemies/heavy.glb',
  '/assets/models/enemies/drone.glb',
  '/assets/models/enemies/boss.glb',
  '/assets/models/weapons/assault_rifle.glb',
  '/assets/models/weapons/shotgun.glb',
  '/assets/models/weapons/sniper.glb',
  '/assets/models/props/cover_wall.glb',
  '/assets/models/props/sci_fi_crate.glb',
  '/assets/models/props/ammo_crate.glb',
  '/assets/animations/player.glb',
  '/assets/animations/enemies.glb',
];

export const REQUIRED_ASSETS = [...COMMON_REQUIRED_ASSETS, ...LEVEL_ASSETS.swamp, ...LEVEL_ASSETS.snow,
  '/assets/hdr/swamp.hdr', '/assets/hdr/snow_city.hdr'];

export function requiredAssetsForLevel(level = 'swamp') {
  const snow = level === 'snow';
  return [...COMMON_REQUIRED_ASSETS, ...(snow ? LEVEL_ASSETS.snow : LEVEL_ASSETS.swamp),
    snow ? '/assets/hdr/snow_city.hdr' : '/assets/hdr/swamp.hdr'];
}

export const OPTIONAL_AUDIO_ASSETS = [
  '/assets/audio/weapons/assault_rifle.ogg',
  '/assets/audio/weapons/shotgun.ogg',
  '/assets/audio/weapons/sniper.ogg',
  '/assets/audio/weapons/reload.ogg',
  '/assets/audio/player/footsteps.ogg',
  '/assets/audio/enemies/alert.ogg',
  '/assets/audio/ambience/swamp_loop.ogg',
  '/assets/audio/ambience/snow_city_loop.ogg',
  '/assets/audio/music/combat_loop.ogg',
  '/assets/audio/music/boss_loop.ogg',
];
