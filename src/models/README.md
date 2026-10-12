# Character Models - Shadow Strike: Last Stand

## Overview

This directory contains high-quality, game-ready character models extracted from the **Universal Base Characters [Standard]** asset package.

## Assets used by the game

The original source assets and skeletons are in this folder. The production-served
male character bundle is `public/models/Superhero_Male_FullBody.gltf` and its
`.bin` file, with its referenced PBR texture maps beside it. The game loader uses
the `/models/Superhero_Male_FullBody.gltf` URL; files under `src/models` are not
served at that URL.

`public/models/CombatAnimations.glb` is a compact subset of the supplied
Universal Animation Library, retargeted to the shared humanoid bone names. It
contains `Idle_Loop`, `Walk_Loop`, `Pistol_Aim_Neutral`, `Pistol_Shoot`,
`Pistol_Reload`, `Hit_Chest`, and `Death01`. Each soldier receives a separate
skinned skeleton and animation mixer; procedural joint animation remains
available when an animation asset cannot load.

The source GLTF files have a skin and PBR materials, but no animation clips.
They also have no military uniform or weapon: the game adds a team-camouflage
uniform texture, tactical kit, rifle, and team markers to the imported
character.

## Available Models

### Primary Characters (Full Body)
- **Superhero_Male_FullBody** (703 KB + 30 KB metadata)
  - Fully rigged humanoid character
  - Professional textures with PBR materials
  - Ready for animation
  
- **Superhero_Female_FullBody** (967 KB + 30 KB metadata)
  - Female variant with similar quality
  - Full skeletal rigging
  - Complete texture set

### Optional Components (Customization)
- **Hair_Long** - Long hairstyle variant
- **Hair_Buzzed** - Short military-style cut

## File Format

**GLTF 2.0** (glTF - GL Transmission Format)
- Modern web-standard 3D format
- Optimized for real-time rendering
- Open specification
- Perfect for Three.js integration

**How it works**:
- `.gltf` file = metadata (references textures/geometry)
- `.bin` file = binary geometry data (3D mesh)
- Both files required together

## Quick Start

### Basic Loading
```javascript
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

const loader = new GLTFLoader();
loader.load('models/Superhero_Male_FullBody.gltf', (gltf) => {
  scene.add(gltf.scene);
});
```

### In React Component
```jsx
import { useEffect, useRef } from 'react';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

export function Character() {
  const groupRef = useRef();

  useEffect(() => {
    const loader = new GLTFLoader();
    loader.load('models/Superhero_Male_FullBody.gltf', (gltf) => {
      groupRef.current.add(gltf.scene);
    });
  }, []);

  return <group ref={groupRef} />;
}
```

## Model Specifications

| Property | Value |
|----------|-------|
| Format | GLTF 2.0 |
| Polygon Count | ~25k-35k per character |
| Rig Type | Humanoid skeleton |
| Animation Ready | Yes |
| Material System | PBR (Physically Based) |
| Texture Resolution | 2K |
| Scale | Real-world scale (1 unit = 1 meter) |

## Features

✓ **Realistic Proportions** - Stylized superhero look
✓ **Professional Rigging** - Full skeletal animation support
✓ **High-Quality Textures** - PBR materials with normal & roughness maps
✓ **Male & Female Variants** - Gender customization
✓ **Hair Customization** - Multiple hairstyles included
✓ **Web-Optimized** - Efficient GLTF format for web delivery

## Perfect For

- Tactical military games
- Character customization systems
- Avatar selection screens
- Multiplayer character displays
- Third-person game protagonist

## Performance

- Each model: **~1.5-2 MB uncompressed**
- With compression: **~700-1000 KB**
- Suitable for: Multiple characters on screen simultaneously
- Optimization: Use LOD, frustum culling, texture compression if needed

## Integration Steps

1. ✓ Models already extracted to this directory
2. → Import GLTFLoader in your component
3. → Load model with appropriate path
4. → Add to Three.js scene
5. → Set lighting and camera
6. → Add animations if desired

## Documentation

- **CHARACTER_MODELS_ANALYSIS.md** - Detailed asset analysis
- **MODEL_INTEGRATION_GUIDE.md** - Complete technical implementation guide
- This file - Quick reference

## Troubleshooting

**Model doesn't load?**
- Verify both .gltf and .bin files exist
- Check browser console for errors
- Ensure path is correct relative to public folder

**Model looks wrong?**
- Add proper lighting (DirectionalLight + AmbientLight)
- Check scale (try 0.5 to 2.0 multipliers)
- Verify material rendering is enabled

**Performance issues?**
- Implement model caching
- Use LOD for distance-based detail
- Consider texture compression

## Source

**Package**: Universal Base Characters [Standard]
**Format**: Extracted as GLTF 2.0
**Quality**: Production-ready, professional game assets
**License**: Check original asset package terms

## Ready to Use

All models are:
- ✓ Extracted and ready
- ✓ Properly formatted
- ✓ Optimized for web
- ✓ Compatible with Three.js
- ✓ Well-documented

**Next Step**: Follow MODEL_INTEGRATION_GUIDE.md for implementation

---

*Last Updated*: Asset extraction and analysis complete
*Status*: ✓ Ready for game integration
