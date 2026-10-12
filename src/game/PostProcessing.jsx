import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js';
import { useGameStore } from '../store/gameStore';

export default function PostProcessing() {
  const { gl, scene, camera, size } = useThree();
  const quality = useGameStore((state) => state.graphicsQuality);
  const composer = useMemo(() => {
    const result = new EffectComposer(gl);
    result.addPass(new RenderPass(scene, camera));
    if (quality !== 'low') {
      const ssao = new SSAOPass(scene, camera, size.width, size.height);
      ssao.kernelRadius = quality === 'high' ? 12 : 8;
      ssao.minDistance = 0.002;
      ssao.maxDistance = 0.16;
      result.addPass(ssao);
    }
    result.addPass(new UnrealBloomPass(new THREE.Vector2(size.width, size.height), quality === 'high' ? 0.38 : 0.22, 0.55, 0.82));
    if (quality === 'high') result.addPass(new BokehPass(scene, camera, { focus: 16, aperture: 0.000035, maxblur: 0.003 }));
    result.addPass(new FilmPass(quality === 'low' ? 0.045 : 0.09, 0.012, 648, false));
    const vignette = new ShaderPass(VignetteShader);
    vignette.uniforms.offset.value = 1.08;
    vignette.uniforms.darkness.value = 0.82;
    result.addPass(vignette);
    return result;
  }, [gl, scene, camera, size.width, size.height, quality]);

  useEffect(() => {
    composer.setSize(size.width, size.height);
    return () => composer.dispose();
  }, [composer, size]);

  useFrame((_, delta) => composer.render(delta), 1);
  return null;
}
