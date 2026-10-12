import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

const requestCache = new Map();

export function loadGLTF(path, renderer) {
  if (!requestCache.has(path)) {
    const draco = new DRACOLoader();
    draco.setDecoderPath('/assets/draco/');
    const ktx2 = new KTX2Loader();
    ktx2.setTranscoderPath('/assets/basis/');
    ktx2.detectSupport(renderer);

    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);
    loader.setKTX2Loader(ktx2);
    const request = new Promise((resolve, reject) => {
      loader.load(path, resolve, undefined, (cause) => {
        const error = new Error(`Unable to load required GLB: ${path}`, { cause });
        error.assetPath = path;
        reject(error);
      });
    });
    requestCache.set(path, request);
    request.catch(() => {
      if (requestCache.get(path) === request) requestCache.delete(path);
    });
  }
  return requestCache.get(path);
}

export function clearAssetCache() {
  requestCache.clear();
}
