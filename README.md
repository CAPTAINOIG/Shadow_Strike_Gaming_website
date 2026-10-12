# Shadow Strike: Last Stand

Browser based third person shooter built with React, Three.js, React Three Fiber and Vite.

## Run locally

```bash
npm install
npm run dev
```

Create the asset folders below inside `public/assets/`. Models must be GLB files with embedded materials and textures. Character roots should face local `-Z`, use meters, and place the feet at `Y=0`. The game does not substitute primitive characters when a model is missing; deployment lists the exact missing paths.

## Required model files

```text
public/assets/models/player.glb
public/assets/models/enemies/swarmer.glb
public/assets/models/enemies/shooter.glb
public/assets/models/enemies/heavy.glb
public/assets/models/enemies/drone.glb
public/assets/models/enemies/boss.glb
public/assets/models/weapons/assault_rifle.glb
public/assets/models/weapons/shotgun.glb
public/assets/models/weapons/sniper.glb
public/assets/models/props/cover_wall.glb
public/assets/models/props/sci_fi_crate.glb
public/assets/models/props/ammo_crate.glb
```

## Required level files

```text
public/assets/models/levels/swamp/swamp_ground.glb
public/assets/models/levels/swamp/swamp_navmesh.glb
public/assets/models/levels/swamp/collapsed_concrete_ruins.glb
public/assets/models/levels/swamp/tall_grass.glb
public/assets/models/levels/swamp/swamp_foliage.glb
public/assets/models/levels/swamp/water_and_mud.glb
public/assets/models/levels/snow/snow_city_ground.glb
public/assets/models/levels/snow/snow_city_navmesh.glb
public/assets/models/levels/snow/abandoned_city_ruins.glb
public/assets/models/levels/snow/wrecked_armored_vehicle.glb
public/assets/models/levels/snow/snow_piles.glb
public/assets/models/levels/snow/ice_fog_volume.glb
```

## Required animation and lighting files

`player.glb` must contain `Idle`, `Walk`, `Run`, `Aim`, `Shoot`, `Reload`, `Take_Cover`, `Hit`, and `Death` clips. `enemies.glb` must contain corresponding enemy clips. Animation tracks must target the matching character skeleton.

```text
public/assets/animations/player.glb
public/assets/animations/enemies.glb
public/assets/hdr/swamp.hdr
public/assets/hdr/snow_city.hdr
```

## Optional audio files

Missing audio is non-fatal and is skipped by the audio manager.

```text
public/assets/audio/weapons/assault_rifle.ogg
public/assets/audio/weapons/shotgun.ogg
public/assets/audio/weapons/sniper.ogg
public/assets/audio/weapons/reload.ogg
public/assets/audio/player/footsteps.ogg
public/assets/audio/enemies/alert.ogg
public/assets/audio/ambience/swamp_loop.ogg
public/assets/audio/ambience/snow_city_loop.ogg
public/assets/audio/music/combat_loop.ogg
public/assets/audio/music/boss_loop.ogg
```

DRACO and KTX2 decoding uses the local decoder/transcoder files at `public/assets/draco/` and `public/assets/basis/`, included from the installed Three.js package. Put large foliage and debris clusters into combined GLBs, use embedded PBR maps, and keep pivots at ground contact for placement.

Each navmesh GLB must contain one walkable indexed mesh with world transforms baked in. Exclude walls and other blocked areas from the walkable surface.

## Controls

- **PC:** WASD move, mouse aim, left click fire, right click aim, R reload, Shift sprint, C/Ctrl cover, Space jump, 1–3 switch weapons, Esc pause.
- **Mobile:** left virtual stick to move, right side drag to aim; touch buttons provide fire, aim, reload, cover, jump and weapon switch.
