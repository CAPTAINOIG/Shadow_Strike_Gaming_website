const REQUIRED_CHARACTER_URLS = [
  '/assets/model/Superhero_Male_FullBody.gltf',
  '/assets/model/Superhero_Male_FullBody.bin',
  '/assets/model/CombatAnimations.glb',
];

export async function preloadCharacterAssets(level = 'swamp', onProgress = () => {}) {
  onProgress(0.15);
  const missing = [];
  for (let i = 0; i < REQUIRED_CHARACTER_URLS.length; i += 1) {
    const path = REQUIRED_CHARACTER_URLS[i];
    try {
      const ok = (await fetch(path, { method: 'HEAD', cache: 'no-store' })).ok;
      if (!ok) missing.push(path);
    } catch {
      missing.push(path);
    }
    onProgress(0.15 + ((i + 1) / REQUIRED_CHARACTER_URLS.length) * 0.85);
  }
  if (missing.length > 0) {
    const error = new Error(`Required player character assets are missing:\n${missing.join('\n')}`);
    error.assetPaths = missing;
    throw error;
  }
}
