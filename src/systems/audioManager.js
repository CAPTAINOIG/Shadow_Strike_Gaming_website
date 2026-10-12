// Shadow Strike: Last Stand - Audio Manager
import { Howl, Howler } from 'howler';

const SOUND_FILES = {
  assault_rifle: '/assets/audio/weapons/assault_rifle.ogg',
  shotgun: '/assets/audio/weapons/shotgun.ogg',
  sniper: '/assets/audio/weapons/sniper.ogg',
  reload: '/assets/audio/weapons/reload.ogg',
  footsteps: '/assets/audio/player/footsteps.ogg',
  enemy_alert: '/assets/audio/enemies/alert.ogg',
  swamp: '/assets/audio/ambience/swamp_loop.ogg',
  snow: '/assets/audio/ambience/snow_city_loop.ogg',
  combat_music: '/assets/audio/music/combat_loop.ogg',
  boss_music: '/assets/audio/music/boss_loop.ogg',
  vehicle_engine: '/assets/audio/vehicles/engine.ogg',
};

class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.initialized = false;
    this.sounds = new Map();
    this.loopIds = new Map();
    this.sfxVolume = 0.8;
  }

  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
      this.loadAssetSounds();
    } catch (e) {
      console.warn('AudioManager: Web Audio API not available');
    }
  }

  loadAssetSounds() {
    Object.entries(SOUND_FILES).forEach(([key, path]) => {
      if (this.sounds.has(key)) return;
      const sound = new Howl({
        src: [path],
        preload: true,
        pannerAttr: { panningModel: 'HRTF', distanceModel: 'inverse', refDistance: 3, maxDistance: 80, rolloffFactor: 1 },
        onloaderror: () => {
          this.sounds.delete(key);
          console.info(`Optional audio unavailable: ${path}`);
        },
      });
      this.sounds.set(key, sound);
    });
  }

  playAsset(key, volume = 0.5, position) {
    const sound = this.sounds.get(key);
    if (!sound || sound.state() !== 'loaded') return false;
    const id = sound.play();
    sound.volume(volume * this.sfxVolume, id);
    if (position) sound.pos(position.x, position.y, position.z, id);
    return true;
  }

  playLoop(key, volume = 0.35) {
    const sound = this.sounds.get(key);
    if (!sound) return false;
    if (sound.state() !== 'loaded') {
      sound.once('load', () => this.playLoop(key, volume));
      return false;
    }
    if (this.loopIds.has(key)) return true;
    const id = sound.play();
    sound.loop(true, id);
    sound.volume(volume, id);
    this.loopIds.set(key, id);
    return true;
  }

  stopLoop(key) {
    const id = this.loopIds.get(key);
    if (id === undefined) return;
    this.sounds.get(key)?.stop(id);
    this.loopIds.delete(key);
  }

  playLevelAmbience(level, volume = 0.25) {
    this.stopLoop(level === 'snow' ? 'swamp' : 'snow');
    this.playLoop(level === 'snow' ? 'snow' : 'swamp', volume);
  }

  stopAmbientAndMusic() {
    ['swamp', 'snow', 'combat_music', 'boss_music'].forEach((key) => this.stopLoop(key));
  }

  ensureContext() {
    if (!this.initialized) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMasterVolume(v) {
    Howler.volume(v);
    if (this.masterGain) this.masterGain.gain.value = v * 0.3;
  }

  setSfxVolume(v) { this.sfxVolume = Math.max(0, Math.min(1, v)); }

  // Procedural gunshot sound
  playGunshot(volume = 0.5, position, weapon = 'assault_rifle') {
    this.ensureContext();
    if (this.playAsset(weapon, volume, position)) return;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // White noise burst for the crack
    const duration = 0.08;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    // Low frequency thump
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);

    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(volume * 0.4, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(volume, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    // Bandpass filter for character
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800;
    filter.Q.value = 1.5;

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    noise.start(t);
    noise.stop(t + duration);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  // Impact/hit sound
  playImpact(volume = 0.3) {
    this.ensureContext();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.05);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  // Reload click
  playReload(volume = 0.3) {
    this.ensureContext();
    if (this.playAsset('reload', volume)) return;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Click sound
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.03);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.08);
    // Second click after a delay
    setTimeout(() => {
      if (!this.ctx) return;
      const t2 = this.ctx.currentTime;
      const osc2 = this.ctx.createOscillator();
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(800, t2);
      osc2.frequency.exponentialRampToValueAtTime(400, t2 + 0.04);
      const gain2 = this.ctx.createGain();
      gain2.gain.setValueAtTime(volume * 0.7, t2);
      gain2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.06);
      osc2.connect(gain2);
      gain2.connect(this.masterGain);
      osc2.start(t2);
      osc2.stop(t2 + 0.06);
    }, 200);
  }

  // Death sound
  playDeath(volume = 0.4) {
    this.ensureContext();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.4);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.5);
  }
}

export const audioManager = new AudioManager();
