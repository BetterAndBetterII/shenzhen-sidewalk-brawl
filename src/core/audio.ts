// WebAudio chiptune synth: music sequencer + procedural SFX. No audio files.
import { MUSIC, Track } from './music';

const NOTE_IDX: Record<string, number> = { c: 0, 'c#': 1, d: 2, 'd#': 3, e: 4, f: 5, 'f#': 6, g: 7, 'g#': 8, a: 9, 'a#': 10, b: 11 };
export function noteMidi(n: string): number {
  const m = /^([a-g]#?)(\d)$/.exec(n);
  if (!m) return -1;
  return NOTE_IDX[m[1]] + 12 * (parseInt(m[2]) + 1);
}
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

const CHORD_Q: Record<string, number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  sus4: [0, 5, 7],
  dim: [0, 3, 6],
  '5': [0, 7, 12],
};
function parseChord(c: string): { root: number; tones: number[] } {
  const m = /^([A-G])(#|b)?(.*)$/.exec(c.trim());
  if (!m) return { root: 9, tones: [0, 3, 7] };
  let root = NOTE_IDX[m[1].toLowerCase()];
  if (m[2] === '#') root += 1;
  if (m[2] === 'b') root -= 1;
  root = (root + 12) % 12;
  return { root, tones: CHORD_Q[m[3]] ?? [0, 4, 7] };
}

class Audio {
  ctx: AudioContext | null = null;
  master!: GainNode;
  musicGain!: GainNode;
  sfxGain!: GainNode;
  noise!: AudioBuffer;
  waves: Record<string, PeriodicWave> = {};
  muted = false;
  musicVol = 0.55;
  sfxVol = 0.8;
  current: Track | null = null;
  currentName = '';
  private step = 0;
  private nextTime = 0;
  private timer: number | null = null;
  private onEnd: (() => void) | null = null;
  private lastPlay: Record<string, number> = {};

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.7;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = this.musicVol * 0.5;
    this.musicGain.connect(this.master);
    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = this.sfxVol;
    this.sfxGain.connect(this.master);
    const len = ctx.sampleRate * 1;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    for (const [k, duty] of [
      ['sq12', 0.125],
      ['sq25', 0.25],
      ['sq50', 0.5],
    ] as [string, number][]) {
      const N = 32;
      const real = new Float32Array(N);
      const imag = new Float32Array(N);
      for (let n = 1; n < N; n++) real[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
      this.waves[k] = ctx.createPeriodicWave(real, imag);
    }
    if (this.currentName) {
      const n = this.currentName;
      this.currentName = '';
      this.playMusic(n);
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.02);
  }
  setVolumes(music: number, sfx: number) {
    this.musicVol = music;
    this.sfxVol = sfx;
    if (this.ctx) {
      this.musicGain.gain.value = music * 0.5;
      this.sfxGain.gain.value = sfx;
    }
  }

  // ---------- music ----------
  playMusic(name: string, onEnd?: () => void) {
    if (this.currentName === name && this.timer !== null) return;
    this.stopMusic();
    this.currentName = name;
    this.onEnd = onEnd || null;
    const t = MUSIC[name];
    if (!t || !this.ctx) return;
    this.current = t;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.timer = window.setInterval(() => this.schedule(), 25);
    this.schedule();
  }
  stopMusic() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.current = null;
    this.currentName = '';
  }
  fadeMusic() {
    if (!this.ctx) return;
    const g = this.musicGain.gain;
    g.setTargetAtTime(0, this.ctx.currentTime, 0.3);
    setTimeout(() => {
      this.stopMusic();
      if (this.ctx) g.setTargetAtTime(this.musicVol * 0.5, this.ctx.currentTime, 0.01);
    }, 1200);
  }

  private schedule() {
    const ctx = this.ctx;
    const t = this.current;
    if (!ctx || !t) return;
    const stepDur = 60 / t.bpm / 4; // 16th
    const totalSteps = t.chords.length * 16;
    while (this.nextTime < ctx.currentTime + 0.12) {
      if (this.step >= totalSteps) {
        if (t.loop === false) {
          const cb = this.onEnd;
          this.stopMusic();
          if (cb) setTimeout(cb, 50);
          return;
        }
        this.step = t.loopStart ? t.loopStart * 16 : 0;
      }
      this.playStep(t, this.step, this.nextTime, stepDur);
      this.step++;
      this.nextTime += stepDur * (t.swing && this.step % 2 === 1 ? 1 + t.swing : t.swing && this.step % 2 === 0 ? 1 - t.swing : 1);
    }
  }

  private playStep(t: Track, s: number, time: number, sd: number) {
    const bar = Math.floor(s / 16);
    const inBar = s % 16;
    const ch = parseChord(t.chords[bar]);
    // melody: tokens per 8th
    if (inBar % 2 === 0) {
      const mi = bar * 8 + inBar / 2;
      const tok = t.melody[mi];
      if (tok && tok !== '.' && tok !== '-') {
        let len = 1;
        while (t.melody[mi + len] === '.') len++;
        const m = noteMidi(tok);
        if (m > 0) this.tone(t.lead || 'sq25', mtof(m), time, len * sd * 2 * 0.92, 0.16, true, this.musicGain);
      }
      if (t.harmony) {
        const ht = t.harmony[mi];
        if (ht && ht !== '.' && ht !== '-') {
          let len = 1;
          while (t.harmony[mi + len] === '.') len++;
          const m = noteMidi(ht);
          if (m > 0) this.tone('sq12', mtof(m), time, len * sd * 2 * 0.9, 0.07, false, this.musicGain);
        }
      }
    }
    // bass
    const root = 36 + ch.root + (t.bassUp ? 12 : 0);
    const bs = t.bass || 'drive';
    let bn = -1;
    if (bs === 'drive' && inBar % 2 === 0) bn = inBar % 4 === 0 ? root : root + 12;
    else if (bs === 'walk' && inBar % 4 === 0) bn = root + [0, 7, 12, 7][inBar / 4];
    else if (bs === 'half' && inBar % 8 === 0) bn = root;
    else if (bs === 'syncop' && [0, 3, 6, 10, 12].includes(inBar)) bn = root + (inBar === 6 ? 12 : inBar === 10 ? 7 : 0);
    else if (bs === 'gallop' && [0, 3, 4, 8, 11, 12].includes(inBar)) bn = root + (inBar >= 8 ? 0 : 0);
    if (bn > 0) this.tone('triangle', mtof(bn), time, sd * (bs === 'half' ? 7 : 1.8), 0.32, false, this.musicGain);
    // arp
    const ar = t.arp || 'none';
    if (ar !== 'none') {
      const tones = ch.tones;
      let note = -1;
      if (ar === 'up') note = tones[inBar % tones.length] + 12 * Math.floor((inBar % 6) / 3);
      else if (ar === 'updown') {
        const seq = [...tones, ...tones.slice(1, -1).reverse()];
        note = seq[inBar % seq.length];
      } else if (ar === 'stab' && [2, 6, 10, 14].includes(inBar)) {
        for (const tt of tones.slice(0, 3)) this.tone('sq12', mtof(60 + ch.root + tt), time, sd * 0.8, 0.05, false, this.musicGain);
      } else if (ar === 'fast') note = tones[inBar % tones.length] + (inBar % 8 >= 4 ? 12 : 0);
      if (note >= 0) this.tone('sq12', mtof(60 + ch.root + note + (t.arpOct || 0) * 12), time, sd * 0.9, 0.045, false, this.musicGain);
    }
    // drums
    const dr = DRUMS[t.drums || 'rock'];
    if (dr) {
      if (dr.k[inBar] === 'x') this.kick(time);
      if (dr.s[inBar] === 'x') this.snare(time, 0.22);
      if (dr.s[inBar] === 'o') this.snare(time, 0.08);
      if (dr.h[inBar] === 'x') this.hat(time, 0.05);
      if (dr.h[inBar] === 'o') this.hat(time, 0.1, 0.12);
    }
  }

  // ---------- primitives ----------
  tone(type: string, freq: number, time: number, dur: number, vol: number, vib = false, dest?: AudioNode, slideTo?: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const o = ctx.createOscillator();
    if (this.waves[type]) o.setPeriodicWave(this.waves[type]);
    else o.type = type as OscillatorType;
    o.frequency.setValueAtTime(freq, time);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), time + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.005);
    g.gain.setValueAtTime(vol, time + Math.max(0.006, dur * 0.6));
    g.gain.linearRampToValueAtTime(0, time + dur);
    if (vib && dur > 0.2) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = 6;
      lg.gain.setValueAtTime(0, time);
      lg.gain.linearRampToValueAtTime(freq * 0.012, time + dur);
      lfo.connect(lg).connect(o.frequency);
      lfo.start(time);
      lfo.stop(time + dur + 0.05);
    }
    o.connect(g).connect(dest || this.sfxGain);
    o.start(time);
    o.stop(time + dur + 0.05);
  }
  noiseHit(time: number, dur: number, vol: number, filterType: BiquadFilterType, freq: number, dest?: AudioNode, freqEnd?: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.setValueAtTime(freq, time);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, time + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    src.connect(f).connect(g).connect(dest || this.sfxGain);
    src.start(time, Math.random() * 0.5);
    src.stop(time + dur + 0.02);
  }
  kick(time: number) {
    this.tone('sine', 150, time, 0.12, 0.55, false, this.musicGain, 40);
  }
  snare(time: number, v: number) {
    this.noiseHit(time, 0.12, v, 'highpass', 1200, this.musicGain);
    this.tone('triangle', 220, time, 0.05, v * 0.6, false, this.musicGain, 120);
  }
  hat(time: number, v: number, d = 0.03) {
    this.noiseHit(time, d, v, 'highpass', 7000, this.musicGain);
  }

  // ---------- sfx ----------
  sfx(name: string, opt: { pitch?: number; vol?: number } = {}) {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    // rate limit identical sfx
    if (this.lastPlay[name] && now - this.lastPlay[name] < 0.03) return;
    this.lastPlay[name] = now;
    const p = opt.pitch ?? 1;
    const v = opt.vol ?? 1;
    const T = now + 0.001;
    switch (name) {
      case 'whoosh':
        this.noiseHit(T, 0.09, 0.18 * v, 'bandpass', 1800 * p, undefined, 600);
        break;
      case 'hit':
        this.noiseHit(T, 0.08, 0.5 * v, 'lowpass', 2600 * p);
        this.tone('square', 180 * p, T, 0.06, 0.25 * v, false, undefined, 60);
        break;
      case 'hitHeavy':
        this.noiseHit(T, 0.18, 0.7 * v, 'lowpass', 1800 * p, undefined, 200);
        this.tone('square', 120 * p, T, 0.14, 0.35 * v, false, undefined, 40);
        this.tone('sine', 80, T, 0.2, 0.5 * v, false, undefined, 30);
        break;
      case 'counter':
        this.tone('sq25', 880, T, 0.06, 0.2 * v);
        this.tone('sq25', 1320, T + 0.06, 0.12, 0.2 * v);
        this.noiseHit(T, 0.15, 0.5, 'lowpass', 2000);
        break;
      case 'honk':
        this.tone('sq50', 520 * p, T, 0.12, 0.13 * v);
        this.tone('sq50', 660 * p, T, 0.12, 0.1 * v);
        this.tone('sq50', 520 * p, T + 0.16, 0.16, 0.13 * v);
        this.tone('sq50', 660 * p, T + 0.16, 0.16, 0.1 * v);
        break;
      case 'bell':
        this.tone('sine', 2100, T, 0.25, 0.15 * v);
        this.tone('sine', 2100, T + 0.12, 0.3, 0.15 * v);
        break;
      case 'rev':
        this.tone('sawtooth', 90 * p, T, 0.5, 0.08 * v, false, undefined, 420 * p);
        this.tone('sq25', 180 * p, T, 0.5, 0.04 * v, false, undefined, 840 * p);
        break;
      case 'zoom':
        this.tone('sawtooth', 600 * p, T, 0.3, 0.06 * v, false, undefined, 220);
        this.noiseHit(T, 0.3, 0.12 * v, 'bandpass', 2500, undefined, 500);
        break;
      case 'crash':
        this.noiseHit(T, 0.45, 0.6 * v, 'lowpass', 3000, undefined, 300);
        this.tone('square', 300, T, 0.1, 0.15 * v, false, undefined, 90);
        this.tone('square', 1700, T + 0.05, 0.08, 0.07 * v);
        this.tone('square', 1300, T + 0.12, 0.08, 0.06 * v);
        break;
      case 'break':
        this.noiseHit(T, 0.25, 0.5 * v, 'bandpass', 900, undefined, 300);
        this.tone('square', 220, T, 0.08, 0.15 * v, false, undefined, 110);
        break;
      case 'jump':
        this.tone('sq25', 260, T, 0.12, 0.12 * v, false, undefined, 520);
        break;
      case 'land':
        this.noiseHit(T, 0.06, 0.2 * v, 'lowpass', 600);
        break;
      case 'dodge':
        this.noiseHit(T, 0.18, 0.2 * v, 'bandpass', 3000, undefined, 800);
        break;
      case 'perfect':
        [0, 4, 7, 12].forEach((n, i) => this.tone('sq12', mtof(84 + n), T + i * 0.04, 0.12, 0.12 * v));
        break;
      case 'hurt':
        this.tone('square', 300, T, 0.18, 0.2 * v, false, undefined, 90);
        this.noiseHit(T, 0.15, 0.4 * v, 'lowpass', 1500);
        break;
      case 'pickup':
        this.tone('sq25', 660, T, 0.07, 0.15 * v);
        this.tone('sq25', 990, T + 0.07, 0.1, 0.15 * v);
        break;
      case 'heal':
        [0, 4, 7, 12, 16].forEach((n, i) => this.tone('sq25', mtof(72 + n), T + i * 0.05, 0.1, 0.12 * v));
        break;
      case 'coin':
        this.tone('sq50', 988, T, 0.08, 0.15 * v);
        this.tone('sq50', 1319, T + 0.08, 0.35, 0.15 * v);
        break;
      case 'menu':
        this.tone('sq25', 880, T, 0.04, 0.09 * v);
        break;
      case 'select':
        this.tone('sq25', 660, T, 0.05, 0.12 * v);
        this.tone('sq25', 1320, T + 0.05, 0.1, 0.12 * v);
        break;
      case 'back':
        this.tone('sq25', 520, T, 0.05, 0.1 * v);
        this.tone('sq25', 330, T + 0.05, 0.08, 0.1 * v);
        break;
      case 'charge':
        this.tone('sq12', 200 * p, T, 0.12, 0.06 * v, false, undefined, 260 * p);
        break;
      case 'chargeFull':
        this.tone('sq25', 1046, T, 0.08, 0.1 * v);
        this.tone('sq25', 1568, T + 0.08, 0.15, 0.1 * v);
        break;
      case 'blast':
        this.tone('sawtooth', 900, T, 0.5, 0.12 * v, false, undefined, 80);
        this.noiseHit(T, 0.6, 0.45 * v, 'lowpass', 4000, undefined, 200);
        this.tone('sine', 120, T, 0.4, 0.5 * v, false, undefined, 40);
        break;
      case 'energy':
        this.tone('sq25', 400, T, 0.15, 0.12 * v, false, undefined, 1400);
        this.noiseHit(T, 0.2, 0.3 * v, 'bandpass', 2400, undefined, 6000);
        break;
      case 'super':
        for (let i = 0; i < 6; i++) this.tone('sq25', mtof(60 + i * 5), T + i * 0.05, 0.1, 0.12 * v);
        this.noiseHit(T + 0.3, 1.0, 0.6 * v, 'lowpass', 5000, undefined, 100);
        this.tone('sine', 90, T + 0.3, 0.8, 0.6 * v, false, undefined, 30);
        break;
      case 'ko':
        this.noiseHit(T, 0.8, 0.7 * v, 'lowpass', 2500, undefined, 80);
        this.tone('square', 200, T, 0.6, 0.2 * v, false, undefined, 30);
        break;
      case 'glitch':
        for (let i = 0; i < 5; i++) this.tone('square', 100 + Math.random() * 1500, T + i * 0.03, 0.03, 0.08 * v);
        break;
      case 'beep':
        this.tone('sq50', 1200, T, 0.06, 0.1 * v);
        break;
      case 'go':
        this.tone('sq25', 784, T, 0.08, 0.13 * v);
        this.tone('sq25', 1046, T + 0.1, 0.12, 0.13 * v);
        break;
      case 'thunder':
        this.noiseHit(T, 1.6, 0.6 * v, 'lowpass', 900, undefined, 60);
        break;
      case 'splash':
        this.noiseHit(T, 0.3, 0.3 * v, 'bandpass', 1500, undefined, 400);
        break;
      case 'throw':
        this.noiseHit(T, 0.2, 0.25 * v, 'bandpass', 1000, undefined, 3000);
        break;
      case 'block':
        this.tone('square', 1500, T, 0.05, 0.1 * v);
        this.tone('triangle', 900, T, 0.15, 0.2 * v);
        break;
      case 'type':
        this.tone('sq50', 600 + Math.random() * 300, T, 0.02, 0.04 * v);
        break;
      case 'grab':
        this.noiseHit(T, 0.08, 0.3 * v, 'lowpass', 900);
        break;
      case 'laser':
        this.tone('sawtooth', 1800, T, 0.4, 0.06 * v, false, undefined, 300);
        break;
      case 'alarm':
        this.tone('sq50', 880, T, 0.15, 0.1 * v);
        this.tone('sq50', 660, T + 0.15, 0.15, 0.1 * v);
        break;
      case 'shout':
        this.tone('sawtooth', 320 * p, T, 0.25, 0.1 * v, true, undefined, 220 * p);
        break;
    }
  }
}

const DRUMS: Record<string, { k: string; s: string; h: string }> = {
  rock: { k: 'x.......x.x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
  four: { k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.' },
  half: { k: 'x.........x.....', s: '........x.......', h: 'x...x...x...x...' },
  break: { k: 'x.....x...x.....', s: '....x..o.o..x...', h: 'x.xxx.x.x.xxx.x.' },
  fast: { k: 'x...x...x...x...', s: '....x..o....x.o.', h: 'xxxxxxxxxxxxxxxx' },
  funk: { k: 'x..x..x...x..x..', s: '....x..o.o..x..o', h: 'x.x.x.o.x.x.x.o.' },
  none: { k: '................', s: '................', h: '................' },
  soft: { k: 'x.......x.......', s: '................', h: '..x...x...x...x.' },
};

export const audio = new Audio();
