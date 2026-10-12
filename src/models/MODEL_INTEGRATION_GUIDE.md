# Character Model Integration Guide
## Using Universal Base Characters in Shadow Strike: Last Stand

---

## Quick Reference

**Models Available**:
- `Superhero_Male_FullBody.gltf` + `.bin` (703 KB)
- `Superhero_Female_FullBody.gltf` + `.bin` (967 KB)
- `Hair_Long.gltf` + `.bin` (optional customization)
- `Hair_Buzzed.gltf` + `.bin` (optional customization)

**Format**: GLTF 2.0 (open standard, web-optimized)

---

## Basic Loading with Three.js

```javascript
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

loader.load(
  'models/Superhero_Male_FullBody.gltf',
  (gltf) => {
    const character = gltf.scene;
    
    // Scale if needed (models come at real scale)
    character.scale.set(1, 1, 1);
    
    // Access animations if present
    const animations = gltf.animations;
    console.log('Available animations:', animations);
    
    // Add to your Three.js scene
    scene.add(character);
  },
  (progress) => {
    console.log('Loading:', (progress.loaded / progress.total * 100) + '%');
  },
  (error) => {
    console.error('Failed to load model:', error);
  }
);
```

---

## React Integration Example

```javascript
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

function CharacterDisplay({ gender = 'male' }) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setClearColor(0x000000, 0.1);
    containerRef.current.appendChild(renderer.domElement);

    // Lighting
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(10, 10, 10);
    scene.add(light);
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // Load character model
    const loader = new GLTFLoader();
    const modelPath = gender === 'male' 
      ? 'models/Superhero_Male_FullBody.gltf'
      : 'models/Superhero_Female_FullBody.gltf';

    loader.load(modelPath, (gltf) => {
      const character = gltf.scene;
      
      // Center character in view
      const box = new THREE.Box3().setFromObject(character);
      const center = box.getCenter(new THREE.Vector3());
      character.position.sub(center);
      
      scene.add(character);

      // Setup animation if available
      if (gltf.animations.length > 0) {
        const mixer = new THREE.AnimationMixer(character);
        gltf.animations.forEach(clip => {
          mixer.clipAction(clip).play();
        });

        // Animation loop
        const clock = new THREE.Clock();
        const animate = () => {
          requestAnimationFrame(animate);
          const delta = clock.getDelta();
          mixer.update(delta);
          renderer.render(scene, camera);
        };
        animate();
      } else {
        renderer.render(scene, camera);
      }
    });

    // Camera positioning
    camera.position.z = 2;

    return () => {
      renderer.dispose();
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, [gender]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}

export default CharacterDisplay;
```

---

## Character Swapping System

```javascript
// CharacterManager.js
class CharacterManager {
  constructor(scene) {
    this.scene = scene;
    this.currentCharacter = null;
    this.loader = new GLTFLoader();
    this.characterCache = {};
  }

  async loadCharacter(gender = 'male') {
    const modelPath = gender === 'male'
      ? 'models/Superhero_Male_FullBody.gltf'
      : 'models/Superhero_Female_FullBody.gltf';

    return new Promise((resolve, reject) => {
      this.loader.load(
        modelPath,
        (gltf) => {
          if (this.currentCharacter) {
            this.scene.remove(this.currentCharacter);
          }
          this.currentCharacter = gltf.scene;
          this.scene.add(this.currentCharacter);
          resolve(gltf);
        },
        undefined,
        reject
      );
    });
  }

  swapHair(hairstyle = 'long') {
    // Hair models: 'long', 'buzzed'
    // Load hair model and attach to character head
    const hairPath = `models/Hair_${hairstyle.charAt(0).toUpperCase() + hairstyle.slice(1)}.gltf`;
    
    this.loader.load(hairPath, (gltf) => {
      // Find head bone/mesh in character
      // Attach hair model to head
      const hair = gltf.scene;
      // Position and attach logic here
    });
  }

  getCurrentCharacter() {
    return this.currentCharacter;
  }
}

export default CharacterManager;
```

---

## Performance Optimization

### 1. Model Caching
```javascript
const characterCache = {};

async function getCharacter(gender) {
  if (characterCache[gender]) {
    return characterCache[gender].clone();
  }
  
  // Load and cache
  const model = await loadModel(gender);
  characterCache[gender] = model;
  return model.clone();
}
```

### 2. LOD (Level of Detail)
```javascript
// If you need distance-based detail reduction
const lod = new THREE.LOD();
lod.addLevel(highPolyModel, 0);     // Close range: high detail
lod.addLevel(lowPolyModel, 50);     // Far range: low detail
scene.add(lod);
```

### 3. Texture Optimization
```javascript
// Use texture compression
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/draco_wasm_wrapper_1_4_3/');
loader.setDRACOLoader(dracoLoader);
```

---

## Animation Setup

### If models include animations:
```javascript
loader.load('models/Superhero_Male_FullBody.gltf', (gltf) => {
  const character = gltf.scene;
  const mixer = new THREE.AnimationMixer(character);
  
  // List available animations
  gltf.animations.forEach((clip, index) => {
    console.log(`${index}: ${clip.name}`);
  });

  // Play specific animation
  if (gltf.animations.length > 0) {
    mixer.clipAction(gltf.animations[0]).play();
  }

  // Update mixer in render loop
  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    mixer.update(clock.getDelta());
    renderer.render(scene, camera);
  }
  animate();
});
```

---

## Material Customization

```javascript
// Access and modify materials
loader.load('models/Superhero_Male_FullBody.gltf', (gltf) => {
  const character = gltf.scene;
  
  character.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      // Modify material properties
      child.material.metalness = 0.2;
      child.material.roughness = 0.8;
      
      // Change colors
      child.material.color.setHex(0xFF0000); // Red variant
    }
  });
  
  scene.add(character);
});
```

---

## Integration with Existing Game Code

### Update `CharacterModel.jsx`:
```jsx
import { useEffect, useRef } from 'react';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

export default function CharacterModel({ gender = 'male', scale = 1 }) {
  const groupRef = useRef();

  useEffect(() => {
    const loader = new GLTFLoader();
    const modelPath = gender === 'male'
      ? 'models/Superhero_Male_FullBody.gltf'
      : 'models/Superhero_Female_FullBody.gltf';

    loader.load(modelPath, (gltf) => {
      const model = gltf.scene;
      model.scale.setScalar(scale);
      
      // Clear previous model
      while (groupRef.current.children.length > 0) {
        groupRef.current.remove(groupRef.current.children[0]);
      }
      
      groupRef.current.add(model);
    });
  }, [gender, scale]);

  return <group ref={groupRef} />;
}
```

---

## File Format Details

### GLTF Files (.gltf)
- Text-based metadata file
- References binary geometry and textures
- Small size (~30 KB)
- Always pair with .bin file

### BIN Files (.bin)
- Binary geometry data
- Large file (~700-1000 KB)
- Loaded automatically when GLTF references it
- Contains vertex, normal, texture coordinate data

**Both files required for models to load properly!**

---

## Troubleshooting

### Model doesn't load
- Check console for errors
- Verify both .gltf and .bin files exist
- Ensure correct path to models folder
- Check CORS if loading from different domain

### Model appears black/no lighting
- Add lights to scene (DirectionalLight + AmbientLight)
- Check material color and transparency settings
- Verify textures loaded correctly

### Model is too large/small
- Adjust scale: `model.scale.set(0.5, 0.5, 0.5)`
- Typical scale: 1.0 works well for full-body characters

### Performance issues
- Use LOD (level of detail)
- Enable frustum culling
- Consider model caching
- Optimize textures (compression)

---

## Resources

- **Three.js Documentation**: https://threejs.org/docs/
- **GLTF Format**: https://www.khronos.org/gltf/
- **GLTFLoader**: https://threejs.org/docs/#examples/en/loaders/GLTFLoader

---

## Summary Checklist

- [ ] Both .gltf and .bin files present in `src/models/`
- [ ] GLTFLoader imported in your component
- [ ] Scene has proper lighting setup
- [ ] Model loads without errors in console
- [ ] Model displays with correct scale
- [ ] Character selection works (male/female swap)
- [ ] Integrate with existing Player.jsx system
- [ ] Test animation support
- [ ] Optimize for performance if needed

---

**Status**: Ready for integration ✓
**Next Step**: Implement in your CharacterModel.jsx component
