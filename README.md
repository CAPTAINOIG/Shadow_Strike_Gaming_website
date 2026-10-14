# Shadow Strike: Last Stand

Browser-based third-person tactical shooter built with React, Three.js, React Three Fiber and Vite.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173 and choose **Deploy**. The battlefield loads behind the main menu; the button enables once it is ready.

## Controls

| Input | Action |
|---|---|
| W A S D | Move |
| Mouse | Look and aim (click the game to lock the pointer) |
| Left click | Fire |
| Right click (hold) | Aim down sights / scope |
| Shift | Sprint |
| C or Ctrl | Toggle crouch |
| Space | Jump (stands up when crouched) |
| R | Reload |
| 1, 2, 3 or mouse wheel | Carbine, shotgun, bolt-action rifle |
| Q | Swap camera shoulder |
| Esc | Pause |

## How it is put together

| Area | Files |
|---|---|
| Soldier mesh, rig and clips | `public/assets/soldier/soldier.glb`, baked by `scripts/bake-soldier.cjs` |
| Layered animation (legs/torso, speed-matched blending, aim pitch, recoil) | `src/game/soldierAnimator.js` |
| Soldier loading, weapon grip solved from the aiming pose | `src/game/soldierAssets.js`, `src/game/CharacterModel.jsx` |
| Player movement, camera and firing | `src/game/Player.jsx` |
| Tactical AI (perception, cover, flanking, squad follow) | `src/game/ai/SoldierBrain.js` |
| Collision, line of sight and bullets | `src/systems/collisionWorld.js`, `src/systems/combatSystem.js`, `src/systems/ballistics.js` |
| Navigation grid (A*) | `src/systems/navGrid.js` |
| Map layout ("Outpost Kestrel") | `src/data/battlefieldLayout.js` |
| Terrain, sky, lighting, buildings, props | `src/game/Battlefield.jsx`, `src/game/environment/` |
| Effects (tracers, muzzle flash, impacts, casings, decals) | `src/systems/fx.js` |
| Audio (synthesised, positional) | `src/systems/audioManager.js` |

Graphics quality starts at **low** on integrated Intel/mobile GPUs and **medium** elsewhere, and steps down automatically if gameplay runs below 24 FPS. It can be changed in Settings.

## Rebuilding generated assets

- **Soldier:** run `npm run dev`, then `node scripts/bake-soldier.cjs` (needs `puppeteer-core` and a local Chrome; set `CHROME_PATH` if Chrome is not in the default Windows location). It combines `asset-src/Soldier.glb` with the Mixamo clips in `public/assets/Basic Shooter Pack/` and the Quaternius UAL clips in `src/assets/character/`.
- **Decimated props:** `scripts/optimize-props.sh` (uses `@gltf-transform/cli`).

## Asset credits

Third-party models, textures and HDRIs, with their sources and licences, are listed in [`public/assets/CREDITS.md`](public/assets/CREDITS.md). CC-BY 3.0 assets require attribution.
