import { Howl } from 'howler';
import { useSettingsStore } from '@/store/settingsStore';

type SfxKey =
  | 'click'
  | 'pickup'
  | 'place'
  | 'placeGood'
  | 'wobble'
  | 'collapse'
  | 'powerup'
  | 'levelup'
  | 'gameover'
  | 'milestone';

/**
 * Procedurally synthesized audio using Web Audio API → encoded to data URI WAV → Howler.
 * Avoids needing external audio assets while still providing satisfying SFX.
 */

const SAMPLE_RATE = 44100;

function makeWavDataUri(samples: Float32Array): string {
  const buffer = encodeWav(samples, SAMPLE_RATE);
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  // base64
  return 'data:audio/wav;base64,' + btoa(binary);
}

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const length = samples.length * 2 + 44;
  const buf = new ArrayBuffer(length);
  const v = new DataView(buf);
  let p = 0;
  const writeStr = (s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(p++, s.charCodeAt(i));
  };
  writeStr('RIFF');
  v.setUint32(p, length - 8, true); p += 4;
  writeStr('WAVE');
  writeStr('fmt ');
  v.setUint32(p, 16, true); p += 4;
  v.setUint16(p, 1, true); p += 2;
  v.setUint16(p, 1, true); p += 2;
  v.setUint32(p, sampleRate, true); p += 4;
  v.setUint32(p, sampleRate * 2, true); p += 4;
  v.setUint16(p, 2, true); p += 2;
  v.setUint16(p, 16, true); p += 2;
  writeStr('data');
  v.setUint32(p, samples.length * 2, true); p += 4;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(p, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    p += 2;
  }
  return buf;
}

interface SynthOpts {
  duration: number;
  startFreq: number;
  endFreq?: number;
  type?: 'sine' | 'square' | 'triangle' | 'sawtooth' | 'noise';
  attack?: number;
  decay?: number;
  vibrato?: number;
}

function synth(opts: SynthOpts): Float32Array {
  const {
    duration,
    startFreq,
    endFreq = startFreq,
    type = 'sine',
    attack = 0.01,
    decay = 0.1,
    vibrato = 0,
  } = opts;
  const total = Math.floor(SAMPLE_RATE * duration);
  const out = new Float32Array(total);
  let phase = 0;
  for (let i = 0; i < total; i++) {
    const t = i / SAMPLE_RATE;
    const k = i / total;
    const freq = startFreq + (endFreq - startFreq) * k;
    const vib = vibrato > 0 ? Math.sin(t * 22) * vibrato * freq : 0;
    phase += ((freq + vib) * 2 * Math.PI) / SAMPLE_RATE;
    let s = 0;
    switch (type) {
      case 'square': s = Math.sign(Math.sin(phase)); break;
      case 'triangle': s = (2 / Math.PI) * Math.asin(Math.sin(phase)); break;
      case 'sawtooth': s = (2 * (phase / (2 * Math.PI) - Math.floor(phase / (2 * Math.PI) + 0.5))); break;
      case 'noise': s = Math.random() * 2 - 1; break;
      default: s = Math.sin(phase);
    }
    let env = 1;
    if (t < attack) env = t / attack;
    else if (t > duration - decay) env = Math.max(0, (duration - t) / decay);
    out[i] = s * env * 0.5;
  }
  return out;
}

function mix(...buffers: Float32Array[]): Float32Array {
  const max = Math.max(...buffers.map((b) => b.length));
  const out = new Float32Array(max);
  for (const b of buffers) {
    for (let i = 0; i < b.length; i++) out[i] += b[i] / buffers.length;
  }
  return out;
}

const sfxBuilders: Record<SfxKey, () => Float32Array> = {
  click: () =>
    synth({ duration: 0.06, startFreq: 720, endFreq: 540, type: 'square', attack: 0.005, decay: 0.04 }),
  pickup: () =>
    mix(
      synth({ duration: 0.12, startFreq: 540, endFreq: 880, type: 'triangle', attack: 0.01, decay: 0.08 }),
      synth({ duration: 0.08, startFreq: 220, endFreq: 440, type: 'sine', attack: 0.005, decay: 0.06 }),
    ),
  place: () =>
    synth({ duration: 0.18, startFreq: 220, endFreq: 110, type: 'triangle', attack: 0.005, decay: 0.16 }),
  placeGood: () =>
    mix(
      synth({ duration: 0.22, startFreq: 660, endFreq: 990, type: 'triangle', attack: 0.01, decay: 0.18 }),
      synth({ duration: 0.18, startFreq: 220, endFreq: 110, type: 'sine', attack: 0.005, decay: 0.16 }),
    ),
  wobble: () =>
    synth({ duration: 0.18, startFreq: 240, endFreq: 180, type: 'triangle', attack: 0.01, decay: 0.14, vibrato: 0.04 }),
  collapse: () =>
    mix(
      synth({ duration: 0.5, startFreq: 320, endFreq: 60, type: 'sawtooth', attack: 0.01, decay: 0.4 }),
      synth({ duration: 0.5, startFreq: 1, endFreq: 1, type: 'noise', attack: 0.01, decay: 0.4 }),
    ),
  powerup: () =>
    mix(
      synth({ duration: 0.32, startFreq: 440, endFreq: 1320, type: 'square', attack: 0.01, decay: 0.28 }),
      synth({ duration: 0.32, startFreq: 220, endFreq: 660, type: 'sine', attack: 0.01, decay: 0.28 }),
    ),
  levelup: () =>
    mix(
      synth({ duration: 0.4, startFreq: 523, endFreq: 1046, type: 'triangle', attack: 0.01, decay: 0.36 }),
      synth({ duration: 0.4, startFreq: 392, endFreq: 784, type: 'sine', attack: 0.01, decay: 0.36 }),
    ),
  gameover: () =>
    synth({ duration: 0.7, startFreq: 320, endFreq: 90, type: 'triangle', attack: 0.02, decay: 0.6 }),
  milestone: () =>
    mix(
      synth({ duration: 0.45, startFreq: 660, endFreq: 990, type: 'square', attack: 0.01, decay: 0.4 }),
      synth({ duration: 0.45, startFreq: 880, endFreq: 1320, type: 'triangle', attack: 0.05, decay: 0.4 }),
    ),
};

const cache: Partial<Record<SfxKey, Howl>> = {};
let inited = false;

export function ensureAudio() {
  if (inited) return;
  inited = true;
  for (const key of Object.keys(sfxBuilders) as SfxKey[]) {
    try {
      const samples = sfxBuilders[key]();
      const src = makeWavDataUri(samples);
      cache[key] = new Howl({ src: [src], format: ['wav'], preload: true, volume: 1.0 });
    } catch {
      // Audio init failures shouldn't break the game
    }
  }
}

export function playSfx(key: SfxKey, vol = 1) {
  try {
    if (!inited) ensureAudio();
    const h = cache[key];
    if (!h) return;
    const settings = useSettingsStore.getState();
    h.volume(Math.max(0, Math.min(1, settings.sfxVolume * vol)));
    h.play();
  } catch {
    /* noop */
  }
}

// --- Background music: simple looping arpeggio ---
function musicTrack(): Float32Array {
  const bpm = 96;
  const beat = 60 / bpm;
  const bars = 8;
  const total = Math.floor(SAMPLE_RATE * beat * 4 * bars);
  const out = new Float32Array(total);
  // Chord progression in C minor
  const progression: Array<[number, number, number]> = [
    [261.63, 311.13, 392.0], // Cm
    [349.23, 415.3, 523.25], // Fm
    [311.13, 392.0, 466.16], // Eb
    [392.0, 466.16, 587.33], // G
  ];
  let cursor = 0;
  for (let bar = 0; bar < bars; bar++) {
    const chord = progression[bar % progression.length];
    for (let n = 0; n < 8; n++) {
      const note = chord[n % chord.length];
      const dur = beat / 2;
      const samples = synth({
        duration: dur,
        startFreq: note,
        endFreq: note,
        type: 'triangle',
        attack: 0.02,
        decay: dur * 0.6,
      });
      for (let i = 0; i < samples.length; i++) {
        if (cursor + i < total) out[cursor + i] += samples[i] * 0.25;
      }
      cursor += Math.floor(SAMPLE_RATE * dur);
    }
  }
  return out;
}

let musicHowl: Howl | null = null;
export function startMusic() {
  if (musicHowl) {
    musicHowl.play();
    return;
  }
  try {
    const samples = musicTrack();
    const src = makeWavDataUri(samples);
    musicHowl = new Howl({ src: [src], format: ['wav'], loop: true, volume: 0.0 });
    const v = useSettingsStore.getState().musicVolume;
    musicHowl.fade(0, v * 0.6, 1500);
    musicHowl.play();
  } catch {
    /* noop */
  }
}

export function stopMusic() {
  if (!musicHowl) return;
  try {
    musicHowl.fade(musicHowl.volume(), 0, 600);
    setTimeout(() => musicHowl?.stop(), 700);
  } catch {
    /* noop */
  }
}

export function setMusicVolume(v: number) {
  if (musicHowl) musicHowl.volume(Math.max(0, Math.min(1, v * 0.6)));
}

export function vibrate(ms = 14) {
  try {
    if (!useSettingsStore.getState().hapticsEnabled) return;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      (navigator as Navigator).vibrate?.(ms);
    }
  } catch {
    /* noop */
  }
}
