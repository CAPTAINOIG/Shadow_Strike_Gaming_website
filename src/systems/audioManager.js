// Shadow Strike: Last Stand - synthesised combat audio.
// There are no recorded audio files in the project: every sound is rendered
// once with an OfflineAudioContext at start-up and then played through HRTF
// panners positioned in the world, with distance roll-off, air absorption
// (low-pass) for far sources and a shared outdoor reverb.
import * as THREE from 'three';

const SAMPLE_RATE = 44100;

function noiseBuffer(ctx, seconds) {
  const buffer = ctx.createBuffer(1, Math.ceil(seconds * ctx.sampleRate), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** Renders a short sound graph into an AudioBuffer. */
async function render(seconds, build) {
  const ctx = new OfflineAudioContext(1, Math.ceil(seconds * SAMPLE_RATE), SAMPLE_RATE);
  build(ctx, ctx.destination);
  return ctx.startRendering();
}

function envelope(ctx, node, points) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(points[0][1], 0);
  for (const [time, value] of points.slice(1)) gain.gain.exponentialRampToValueAtTime(Math.max(value, 0.0001), time);
  node.connect(gain);
  return gain;
}

function noiseSource(ctx, seconds) {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx, seconds);
  source.start(0);
  return source;
}

function filter(ctx, type, frequency, q = 0.7) {
  const node = ctx.createBiquadFilter();
  node.type = type; node.frequency.value = frequency; node.Q.value = q;
  return node;
}

// Gunshot: supersonic crack + muzzle blast body + low thump.
function gunshot({ crack = 1, body = 1, low = 1, bodyFreq = 900, lowFreq = 70, decay = 0.18, length = 0.7 }) {
  return render(length, (ctx, out) => {
    const crackSrc = noiseSource(ctx, 0.05);
    const crackHp = filter(ctx, 'highpass', 2500);
    crackSrc.connect(crackHp);
    envelope(ctx, crackHp, [[0, crack], [0.004, crack * 0.8], [0.035, 0.0001]]).connect(out);

    const bodySrc = noiseSource(ctx, length);
    const bodyBp = filter(ctx, 'lowpass', bodyFreq * 2.4, 0.6);
    const bodyPeak = filter(ctx, 'peaking', bodyFreq, 1.2); bodyPeak.gain.value = 6;
    bodySrc.connect(bodyBp); bodyBp.connect(bodyPeak);
    envelope(ctx, bodyPeak, [[0, body], [0.012, body * 0.7], [decay, body * 0.08], [length, 0.0001]]).connect(out);

    const thump = ctx.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(lowFreq * 2.2, 0);
    thump.frequency.exponentialRampToValueAtTime(lowFreq * 0.6, 0.12);
    thump.start(0);
    envelope(ctx, thump, [[0, low], [0.03, low * 0.6], [0.22, 0.0001]]).connect(out);
  });
}

const IMPACT_RECIPES = {
  concrete: { freq: 2400, q: 0.9, decay: 0.09, debris: 0.35 },
  brick: { freq: 1800, q: 0.9, decay: 0.1, debris: 0.4 },
  metal: { freq: 3400, q: 9, decay: 0.28, ring: 1 },
  vehicle: { freq: 2600, q: 7, decay: 0.24, ring: 0.8 },
  wood: { freq: 900, q: 2, decay: 0.08, debris: 0.2 },
  sandbag: { freq: 500, q: 1, decay: 0.07 },
  dirt: { freq: 380, q: 0.8, decay: 0.08, debris: 0.25 },
  flesh: { freq: 260, q: 1.2, decay: 0.07 },
};

function impact(recipe) {
  return render(0.45, (ctx, out) => {
    const src = noiseSource(ctx, 0.45);
    const bp = filter(ctx, 'bandpass', recipe.freq, recipe.q);
    src.connect(bp);
    envelope(ctx, bp, [[0, 1.4], [recipe.decay, 0.05], [0.4, 0.0001]]).connect(out);
    if (recipe.ring) {
      const osc = ctx.createOscillator(); osc.type = 'triangle';
      osc.frequency.setValueAtTime(recipe.freq * 0.9, 0); osc.frequency.exponentialRampToValueAtTime(recipe.freq * 0.82, 0.3);
      osc.start(0);
      envelope(ctx, osc, [[0, 0.22 * recipe.ring], [0.35, 0.0001]]).connect(out);
    }
    if (recipe.debris) {
      const d = noiseSource(ctx, 0.45);
      const hp = filter(ctx, 'bandpass', 3800, 1.5);
      d.connect(hp);
      const g = envelope(ctx, hp, [[0, 0.0001], [0.03, recipe.debris], [0.3, 0.0001]]);
      g.connect(out);
    }
  });
}

class AudioManager {
  constructor() {
    this.ctx = null;
    this.initialized = false;
    this.buffers = {};
    this.sfxVolume = 0.8;
    this.ambienceVolume = 0.5;
    this.masterVolume = 0.7;
    this.ambience = null;
    this.distantTimer = null;
  }

  init() {
    if (this.initialized) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) { console.warn('AudioManager: Web Audio API not available'); return; }
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.masterVolume;
    const limiter = this.ctx.createDynamicsCompressor();
    limiter.threshold.value = -10; limiter.ratio.value = 8; limiter.attack.value = 0.002; limiter.release.value = 0.2;
    this.master.connect(limiter); limiter.connect(this.ctx.destination);
    this.sfx = this.ctx.createGain(); this.sfx.gain.value = this.sfxVolume; this.sfx.connect(this.master);
    this.ambienceBus = this.ctx.createGain(); this.ambienceBus.gain.value = this.ambienceVolume; this.ambienceBus.connect(this.master);
    // Outdoor reverb: sparse early reflections plus a short diffuse tail.
    this.reverb = this.ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(1.8);
    this.reverbSend = this.ctx.createGain(); this.reverbSend.gain.value = 0.32;
    this.reverbSend.connect(this.reverb); this.reverb.connect(this.sfx);
    this.initialized = true;
    this.renderBank();
  }

  makeImpulse(seconds) {
    const length = Math.ceil(seconds * this.ctx.sampleRate);
    const buffer = this.ctx.createBuffer(2, length, this.ctx.sampleRate);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i += 1) {
        const t = i / this.ctx.sampleRate;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3.2) * (t < 0.02 ? 0 : 0.5);
      }
      // Discrete slap-back echoes off nearby walls and hills.
      for (const [time, gain] of [[0.045, 0.7], [0.11, 0.45], [0.23, 0.3], [0.41, 0.18]]) {
        const index = Math.floor((time + channel * 0.007) * this.ctx.sampleRate);
        for (let k = 0; k < 220; k += 1) data[index + k] += (Math.random() * 2 - 1) * gain * (1 - k / 220);
      }
    }
    return buffer;
  }

  async renderBank() {
    try {
      const jobs = {
        rifle: gunshot({ crack: 0.9, body: 1, low: 0.7, bodyFreq: 1100, lowFreq: 80, decay: 0.12, length: 0.5 }),
        ak: gunshot({ crack: 0.8, body: 1.1, low: 0.85, bodyFreq: 760, lowFreq: 65, decay: 0.15, length: 0.55 }),
        shotgun: gunshot({ crack: 0.5, body: 1.3, low: 1.2, bodyFreq: 520, lowFreq: 55, decay: 0.24, length: 0.8 }),
        sniper: gunshot({ crack: 1.2, body: 1.2, low: 1.1, bodyFreq: 680, lowFreq: 50, decay: 0.3, length: 1 }),
        distant: gunshot({ crack: 0.05, body: 0.8, low: 0.9, bodyFreq: 280, lowFreq: 45, decay: 0.35, length: 1 }),
        whiz: render(0.25, (ctx, out) => {
          const src = noiseSource(ctx, 0.25);
          const bp = filter(ctx, 'bandpass', 3000, 3);
          bp.frequency.setValueAtTime(5200, 0); bp.frequency.exponentialRampToValueAtTime(1400, 0.2);
          src.connect(bp);
          envelope(ctx, bp, [[0, 0.0001], [0.03, 1.6], [0.2, 0.0001]]).connect(out);
          const crack = noiseSource(ctx, 0.02); const hp = filter(ctx, 'highpass', 3000); crack.connect(hp);
          envelope(ctx, hp, [[0, 1], [0.012, 0.0001]]).connect(out);
        }),
        step: render(0.18, (ctx, out) => {
          const src = noiseSource(ctx, 0.18);
          const lp = filter(ctx, 'lowpass', 700, 0.8); src.connect(lp);
          envelope(ctx, lp, [[0, 0.9], [0.02, 0.6], [0.15, 0.0001]]).connect(out);
          const grit = noiseSource(ctx, 0.18); const bp = filter(ctx, 'bandpass', 2600, 1.2); grit.connect(bp);
          envelope(ctx, bp, [[0, 0.0001], [0.02, 0.25], [0.12, 0.0001]]).connect(out);
        }),
        click: render(0.06, (ctx, out) => {
          const src = noiseSource(ctx, 0.06); const bp = filter(ctx, 'bandpass', 3200, 4); src.connect(bp);
          envelope(ctx, bp, [[0, 1.5], [0.03, 0.0001]]).connect(out);
        }),
        magOut: render(0.2, (ctx, out) => {
          const src = noiseSource(ctx, 0.2); const bp = filter(ctx, 'bandpass', 1400, 3); src.connect(bp);
          envelope(ctx, bp, [[0, 1.2], [0.05, 0.2], [0.18, 0.0001]]).connect(out);
        }),
        magIn: render(0.2, (ctx, out) => {
          const src = noiseSource(ctx, 0.2); const bp = filter(ctx, 'bandpass', 2000, 2.5); src.connect(bp);
          envelope(ctx, bp, [[0, 1.6], [0.02, 0.9], [0.15, 0.0001]]).connect(out);
        }),
        bolt: render(0.3, (ctx, out) => {
          for (const [t, f] of [[0, 1800], [0.12, 2600]]) {
            const src = noiseSource(ctx, 0.3); const bp = filter(ctx, 'bandpass', f, 5); src.connect(bp);
            const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, 0); g.gain.setValueAtTime(1.3, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
            bp.connect(g); g.connect(out);
          }
        }),
        thud: render(0.5, (ctx, out) => {
          const src = noiseSource(ctx, 0.5); const lp = filter(ctx, 'lowpass', 260, 0.9); src.connect(lp);
          envelope(ctx, lp, [[0, 1.4], [0.05, 0.6], [0.4, 0.0001]]).connect(out);
        }),
        hitmarker: render(0.08, (ctx, out) => {
          const osc = ctx.createOscillator(); osc.type = 'square'; osc.frequency.value = 2200; osc.start(0);
          const bp = filter(ctx, 'bandpass', 2400, 6); osc.connect(bp);
          envelope(ctx, bp, [[0, 0.5], [0.05, 0.0001]]).connect(out);
        }),
      };
      for (const [surface, recipe] of Object.entries(IMPACT_RECIPES)) jobs[`impact_${surface}`] = impact(recipe);
      const names = Object.keys(jobs);
      const buffers = await Promise.all(Object.values(jobs));
      names.forEach((name, i) => { this.buffers[name] = buffers[i]; });
    } catch (error) {
      console.error('AudioManager: failed to synthesise sound bank', error);
    }
  }

  ensureContext() {
    if (!this.initialized) this.init();
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  setMasterVolume(v) { this.masterVolume = v; if (this.master) this.master.gain.value = v; }

  setSfxVolume(v) { this.sfxVolume = Math.max(0, Math.min(1, v)); if (this.sfx) this.sfx.gain.value = this.sfxVolume; }

  setAmbienceVolume(v) { this.ambienceVolume = v; if (this.ambienceBus) this.ambienceBus.gain.value = v; }

  /** Moves the Web Audio listener to the camera every frame. */
  updateListener(camera) {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    const p = camera.position;
    const f = _forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    const u = _upv.set(0, 1, 0).applyQuaternion(camera.quaternion);
    if (l.positionX) {
      const t = this.ctx.currentTime;
      l.positionX.setTargetAtTime(p.x, t, 0.01); l.positionY.setTargetAtTime(p.y, t, 0.01); l.positionZ.setTargetAtTime(p.z, t, 0.01);
      l.forwardX.setTargetAtTime(f.x, t, 0.01); l.forwardY.setTargetAtTime(f.y, t, 0.01); l.forwardZ.setTargetAtTime(f.z, t, 0.01);
      l.upX.setTargetAtTime(u.x, t, 0.01); l.upY.setTargetAtTime(u.y, t, 0.01); l.upZ.setTargetAtTime(u.z, t, 0.01);
    } else {
      l.setPosition(p.x, p.y, p.z);
      l.setOrientation(f.x, f.y, f.z, u.x, u.y, u.z);
    }
    this.listenerPosition = p;
  }

  /**
   * Plays a buffer at a world position (or non-positional when omitted).
   * Far sources lose high frequencies, as they do outdoors.
   */
  play(name, { position = null, volume = 1, rate = 1, reverb = 0.25, refDistance = 4, maxDistance = 220, delay = 0 } = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const buffer = this.buffers[name];
    if (!buffer) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    let node = source;
    if (position && this.listenerPosition) {
      const distance = Math.hypot(position.x - this.listenerPosition.x, position.y - this.listenerPosition.y, position.z - this.listenerPosition.z);
      if (distance > maxDistance) return;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = Math.max(900, 18000 / (1 + distance * 0.06));
      node.connect(lp); node = lp;
      const panner = this.ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = refDistance;
      panner.maxDistance = maxDistance;
      panner.rolloffFactor = 1.1;
      if (panner.positionX) { panner.positionX.value = position.x; panner.positionY.value = position.y; panner.positionZ.value = position.z; } else panner.setPosition(position.x, position.y, position.z);
      node.connect(panner); node = panner;
    }
    node.connect(gain);
    gain.connect(this.sfx);
    if (reverb > 0) {
      const send = this.ctx.createGain(); send.gain.value = reverb;
      gain.connect(send); send.connect(this.reverbSend);
    }
    source.start(this.ctx.currentTime + delay);
  }

  gunshot(sound, position, { isPlayer = false } = {}) {
    this.ensureContext();
    const variation = 0.94 + Math.random() * 0.12;
    this.play(sound, { position: isPlayer ? null : position, volume: isPlayer ? 0.55 : 0.9, rate: variation, reverb: isPlayer ? 0.45 : 0.6, refDistance: 6, maxDistance: 400 });
  }

  impact(surface, position) {
    this.play(`impact_${surface}`, { position, volume: 0.5, rate: 0.9 + Math.random() * 0.2, reverb: 0.1, refDistance: 2, maxDistance: 70 });
  }

  whiz(position) {
    this.play('whiz', { position, volume: 0.7, rate: 0.85 + Math.random() * 0.3, reverb: 0.05, refDistance: 1.5, maxDistance: 20 });
  }

  footstep(position, { isPlayer = false, speed = 3 } = {}) {
    const volume = (isPlayer ? 0.16 : 0.32) * Math.min(1.4, 0.5 + speed * 0.18);
    this.play('step', { position: isPlayer ? null : position, volume, rate: 0.85 + Math.random() * 0.3, reverb: 0.05, refDistance: 2, maxDistance: 35 });
  }

  /** Mechanical reload sequence spread over the reload duration. */
  reload(duration, position = null, kind = 'rifle') {
    this.ensureContext();
    const opts = { position, volume: position ? 0.4 : 0.32, reverb: 0.05, refDistance: 2, maxDistance: 30 };
    if (kind === 'shotgun') {
      for (let i = 0; i < 4; i += 1) this.play('magIn', { ...opts, rate: 1.3, delay: 0.35 + i * (duration * 0.17) });
      this.play('bolt', { ...opts, delay: duration * 0.88 });
      return;
    }
    this.play('magOut', { ...opts, delay: duration * 0.12 });
    this.play('magIn', { ...opts, delay: duration * 0.55 });
    this.play('bolt', { ...opts, delay: duration * 0.8 });
  }

  bolt() { this.play('bolt', { volume: 0.28, reverb: 0.05, delay: 0.35 }); }

  dryFire() { this.ensureContext(); this.play('click', { volume: 0.35, reverb: 0 }); }

  hitmarker(kill = false) { this.play('hitmarker', { volume: kill ? 0.3 : 0.18, rate: kill ? 0.7 : 1, reverb: 0 }); }

  bodyFall(position) { this.play('thud', { position, volume: 0.8, reverb: 0.15, refDistance: 3, maxDistance: 60 }); }

  /** Wind bed plus occasional distant gunfire bursts from beyond the area. */
  startAmbience() {
    this.ensureContext();
    if (!this.ctx || this.ambience) return;
    const source = this.ctx.createBufferSource();
    source.buffer = noiseBuffer(this.ctx, 6);
    source.loop = true;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.4;
    const gain = this.ctx.createGain(); gain.gain.value = 0.12;
    const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoGain = this.ctx.createGain(); lfoGain.gain.value = 180;
    lfo.connect(lfoGain); lfoGain.connect(lp.frequency); lfo.start();
    source.connect(lp); lp.connect(gain); gain.connect(this.ambienceBus);
    source.start();
    this.ambience = { source, lfo };
    const scheduleDistant = () => {
      this.distantTimer = setTimeout(() => {
        if (!this.ambience) return;
        const p = this.listenerPosition;
        if (p) {
          const angle = Math.random() * Math.PI * 2;
          const distance = 180 + Math.random() * 160;
          const position = { x: p.x + Math.cos(angle) * distance, y: 4, z: p.z + Math.sin(angle) * distance };
          const shots = 3 + Math.floor(Math.random() * 6);
          for (let i = 0; i < shots; i += 1) {
            this.play('distant', { position, volume: 0.9, rate: 0.85 + Math.random() * 0.1, reverb: 0.9, refDistance: 40, maxDistance: 600, delay: i * (0.09 + Math.random() * 0.05) });
          }
        }
        scheduleDistant();
      }, 6000 + Math.random() * 14000);
    };
    scheduleDistant();
  }

  stopAmbience() {
    clearTimeout(this.distantTimer);
    if (!this.ambience) return;
    try { this.ambience.source.stop(); this.ambience.lfo.stop(); } catch { /* already stopped */ }
    this.ambience = null;
  }
}

const _forward = new THREE.Vector3();
const _upv = new THREE.Vector3();

export const audioManager = new AudioManager();
