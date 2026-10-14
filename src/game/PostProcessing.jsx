// Shadow Strike: Last Stand - post-processing chain.
// medium/high: HDR render (MSAA) -> [GTAO on high] -> subtle bloom -> one final
// pass doing ACES tone mapping, sRGB, colour grade, vignette and damage tint.
// low: renders straight to the screen (renderer tone mapping, MSAA backbuffer).
import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { useGameStore } from '../store/gameStore';

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    exposure: { value: 1 },
    saturation: { value: 0.9 },
    contrast: { value: 1.05 },
    vignette: { value: 0.36 },
    damage: { value: 0 },
    lowHealth: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float exposure; uniform float saturation; uniform float contrast;
    uniform float vignette; uniform float damage; uniform float lowHealth; varying vec2 vUv;
    // ACES filmic fit (same curve as three.js ACESFilmicToneMapping).
    vec3 gradeRRTFit(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
    vec3 gradeAces(vec3 color) {
      const mat3 ACESInputMat = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
      const mat3 ACESOutputMat = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
      color *= exposure / 0.6;
      color = ACESInputMat * color; color = gradeRRTFit(color); color = ACESOutputMat * color;
      return clamp(color, 0.0, 1.0);
    }
    vec3 gradeToSRGB(vec3 c) { return mix(pow(c, vec3(0.41666)) * 1.055 - vec3(0.055), c * 12.92, vec3(lessThanEqual(c, vec3(0.0031308)))); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = gradeToSRGB(gradeAces(c.rgb));
      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(luma), col, saturation * (1.0 - lowHealth * 0.6));
      col = (col - 0.5) * contrast + 0.5;
      col += vec3(0.02, 0.008, -0.012) * smoothstep(0.45, 1.0, luma);
      vec2 d = vUv - 0.5;
      float edge = smoothstep(0.25, 0.85, length(d * vec2(1.25, 1.0)));
      col *= 1.0 - edge * vignette;
      col = mix(col, vec3(0.45, 0.03, 0.02), edge * clamp(damage * 0.55 + lowHealth * 0.3, 0.0, 0.7));
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }`,
};

export default function PostProcessing() {
  const { gl, scene, camera, size } = useThree();
  const quality = useGameStore((state) => state.graphicsQuality);

  const chain = useMemo(() => {
    if (quality === 'low') return null;
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: quality === 'high' ? 4 : 2 });
    const composer = new EffectComposer(gl, target);
    composer.addPass(new RenderPass(scene, camera));
    if (quality === 'high') {
      const gtao = new GTAOPass(scene, camera, 1, 1);
      gtao.blendIntensity = 0.85;
      composer.addPass(gtao);
    }
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.16, 0.35, 0.95));
    const final = new ShaderPass(FinalShader);
    composer.addPass(final);
    return { composer, final };
  }, [gl, scene, camera, quality]);

  useEffect(() => {
    if (!chain) return;
    chain.composer.setPixelRatio(gl.getPixelRatio());
    chain.composer.setSize(size.width, size.height);
  }, [chain, gl, size]);
  useEffect(() => () => chain?.composer.dispose(), [chain]);

  useFrame((_, delta) => {
    if (!chain) { gl.render(scene, camera); return; }
    const store = useGameStore.getState();
    const sinceHit = (Date.now() - store.lastHitTime) / 1000;
    const uniforms = chain.final.uniforms;
    uniforms.exposure.value = gl.toneMappingExposure;
    uniforms.damage.value = store.lastHitTime ? Math.max(0, 1 - sinceHit * 2.2) : 0;
    uniforms.lowHealth.value = THREE.MathUtils.clamp((40 - store.playerHealth) / 40, 0, 1);
    chain.composer.render(delta);
  }, 1);
  return null;
}
