# Third-party asset credits

Every external asset below was downloaded from the listed source.
CC-BY assets require attribution, which this file provides; show it in the game credits as well.

## Characters and animation

| File | Source | Author | License |
|---|---|---|---|
| `soldier/soldier.glb` (baked) mesh and skeleton | three.js repository, `examples/models/gltf/Soldier.glb` (https://github.com/mrdoob/three.js) | Mixamo character "Vanguard" | Mixamo terms (royalty-free use in projects); repository MIT |
| Rifle clips baked into `soldier/soldier.glb` | `public/assets/Basic Shooter Pack/*.fbx` (already in the project) | Mixamo | Mixamo terms |
| Death, crouch, sprint and jump clips baked into `soldier/soldier.glb` | Universal Animation Library (Standard), in `src/assets/character/` | Quaternius | CC0 |

## Weapons

| File | Source | Author | License |
|---|---|---|---|
| `weapons/m4.glb` | https://poly.pizza/m/MdbcTe6hH3 | Zsky | CC-BY 3.0 |
| `weapons/ak47.glb` | https://poly.pizza/m/XGeBGFQxYg | Zsky | CC-BY 3.0 |
| `weapons/shotgun.glb` | https://poly.pizza/m/DcNE0HVdW8 | Quaternius | CC0 / Public Domain |
| `props/ph/bolt_action_rifle_7_62/` | https://polyhaven.com/a/bolt_action_rifle_7_62 | Poly Haven | CC0 |

## Vehicles

| File | Source | Author | License |
|---|---|---|---|
| `vehicles/humvee.glb` | https://poly.pizza/m/Ebryot9iKM | madtrollstudio | CC-BY 3.0 |
| `vehicles/m939.glb` | https://poly.pizza/m/y8lBpvMlim | J-Toastie | CC-BY 3.0 |
| `vehicles/lmtv.glb` | https://poly.pizza/m/3XAD5t0Djqv | Alex Safayan | CC-BY 3.0 |

## Props

| File | Source | Author | License |
|---|---|---|---|
| `props/sandbags_long.glb` | https://poly.pizza/m/LW3jwpPfiN | Quaternius | CC0 / Public Domain |
| `props/sandbags_short.glb` | https://poly.pizza/m/iHyRewQQcN | Quaternius | CC0 / Public Domain |
| `props/container.glb` | https://poly.pizza/m/83Cai5aKxa | Davidlamic000 | CC0 / Public Domain |
| `props/ph/*` (crates, ammo box, jerrycan, barrels, concrete barrier, covered car, tyre, cement bags, boulders, shrubs, dead tree, utility box, propane tank, trash bag, compressor, plastic crate, ladder) | https://polyhaven.com/models | Poly Haven | CC0 |

## Textures and lighting

| File | Source | License |
|---|---|---|
| `textures/*` (ground, gravel road, tyre tracks, grass, scorched ground, concrete, plaster, brick, corrugated iron, rusty metal) | https://polyhaven.com/textures | CC0 |
| `hdri/derelict_airfield_01_1k.hdr`, `hdri/kloofendal_overcast_1k.hdr` | https://polyhaven.com/hdris | CC0 |

## Audio

The project contains no recorded audio files. All weapon, impact, footstep and ambience sounds are synthesised at runtime with the Web Audio API (`src/systems/audioManager.js`).
