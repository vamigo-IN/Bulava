#!/usr/bin/env node
/**
 * Bulava Originals: the in-house background music, composed and synthesised here
 * so the platform owns every track outright (no samples, no downloads, no web
 * audio: synthesis only). The script is a small synthesis engine (instruments,
 * a Freeverb-style reverb, a stereo widener, a BS.1770 loudness meter and a
 * look-ahead true-peak limiter) and a track catalogue (data objects: a raga or
 * scale, a tempo and meter, sections with drone or chord roots and written
 * phrases, the instruments and their levels).
 *
 *   node infrastructure/scripts/compose-music.mjs [--only key,key] [--out packages/database/seed-assets/music] [--wav] [--stems] [--notes] [--list] [--calibrate]
 *
 * Every track is one loop, because invitations play the file with <audio loop>: it
 * is a whole number of bars long, its first beat comes a quarter of a second in,
 * its last chord rings to the end of the file, and whatever rings past the end
 * (notes and reverb) is folded back onto the start, so the seam carries on the
 * sound instead of falling silent. The fades at both ends are a fraction of a
 * second, only so the seam never clicks.
 *
 * Mastering: integrated loudness to -16 LUFS (BS.1770-4: K-weighted, gated) with a
 * gentle air shelf, a look-ahead limiter on the 4x oversampled (true) peak, then the
 * AAC file is decoded again and measured. AAC overshoots the peaks it is given, so
 * when the decoded true peak is above -1.2 dBTP the limiter's ceiling comes down
 * and the track is encoded again.
 *
 * It writes <slug>.m4a per track (AAC 128 kbps stereo 44.1 kHz through the FFmpeg
 * that ships with Remotion; the WAV stays only with --wav), prints the duration,
 * loudness, true peak before and after encoding, RMS, the spectral balance and
 * the loop seam of each track, and draws a spectrogram and waveform picture into
 * node_modules/.cache/signature3d/music/<slug>.png. --stems prints every
 * instrument's level in the mix, --notes the rhythm, range and harmony checks of
 * every part, --calibrate one note of every instrument (the instrument levels are
 * set so these match), --list the catalogue.
 *
 * Everything is deterministic: a seeded PRNG only, so a run on one machine yields
 * byte-identical files (regenerate on one machine: Math.sin and friends may differ
 * between V8 versions). Node >= 22, no dependencies. docs/templates.md "In-house music".
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, v, i, all) => (v.startsWith('--') ? [...acc, [v.slice(2), all[i + 1] === undefined || all[i + 1].startsWith('--') ? true : all[i + 1]]] : acc), []),
);
const OUT_DIR = path.resolve(ROOT, typeof args.out === 'string' ? args.out : 'packages/database/seed-assets/music');
const PICTURE_DIR = path.join(ROOT, 'node_modules/.cache/signature3d/music');
/** Intermediate PCM for the encoder and the decoded check (kept off the system drive). */
const WORK_DIR = path.join(ROOT, 'node_modules/.cache/compose-music');
const ONLY = typeof args.only === 'string' ? args.only.split(',').map((k) => k.trim()).filter(Boolean) : null;

export const RATE = 44100;
const TAU = 2 * Math.PI;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, x) => a + (b - a) * x;
const dB = (v) => (v > 0 ? 20 * Math.log10(v) : -Infinity);
const fromDb = (d) => Math.pow(10, d / 20);

// ───────────────────────────── Seeded randomness ─────────────────────────────

/** mulberry32: small, fast and deterministic. One per track, seeded from its key. */
class Rng {
  constructor(seed) {
    this.s = seed >>> 0;
  }
  next() {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(lo, hi) {
    return lo + (hi - lo) * this.next();
  }
  /** Roughly normal (sum of three uniforms), mean 0, sd 1. */
  gauss() {
    return (this.next() + this.next() + this.next() - 1.5) * 2;
  }
  pick(list) {
    return list[Math.floor(this.next() * list.length) % list.length];
  }
}

function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

// ───────────────────────────── Pitch and scales ─────────────────────────────

const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** 'C#3' → MIDI number (C4 = 60). */
function midi(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note name ${name}`);
  return 12 * (Number(m[3]) + 1) + NOTE_INDEX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
const hz = (midiNumber) => 440 * Math.pow(2, (midiNumber - 69) / 12);

/** Scales as semitone sets from the tonic (Sa). Ragas are written as their thaat-like sets. */
export const SCALES = {
  yaman: [0, 2, 4, 6, 7, 9, 11], // S R G M# P D N (Kalyan; Lydian)
  bhairavi: [0, 1, 3, 5, 7, 8, 10], // S r g m P d n (Phrygian)
  bilawal: [0, 2, 4, 5, 7, 9, 11], // major
  khamaj: [0, 2, 4, 5, 7, 9, 10], // S R G m P D n (Mixolydian)
  ahirBhairav: [0, 1, 4, 5, 7, 9, 10], // S r G m P D n
  bhairav: [0, 1, 4, 5, 7, 8, 11], // S r G m P d N
  durga: [0, 2, 5, 7, 9], // S R m P D
  majorPentatonic: [0, 2, 4, 7, 9], // Bhupali
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
};
const MAJOR = SCALES.major;
/** Western tracks have their melodies checked against the chords (--notes). */
const WESTERN = new Set(['major', 'minor']);

/** Scale degree (1-based, `+`/`-` octaves) → semitones from the tonic. */
function degreeToSemitones(scale, degree, octaves = 0, alter = 0) {
  const n = scale.length;
  const d = degree - 1;
  const oct = Math.floor(d / n);
  const idx = ((d % n) + n) % n;
  return scale[idx] + 12 * (oct + octaves) + alter;
}

// ───────────────────────────── Wavetables ─────────────────────────────

const TABLE_SIZE = 4096;

/**
 * A periodic waveform from harmonic amplitudes, in mip levels so that reading it
 * at any pitch never puts a harmonic above ~18 kHz (no aliasing).
 */
class Wavetable {
  constructor(ampOf, maxHarmonics = 64) {
    this.levels = [];
    for (let h = maxHarmonics; h >= 1; h = Math.floor(h / 2)) {
      const table = new Float32Array(TABLE_SIZE + 1);
      let peak = 0;
      for (let i = 0; i < TABLE_SIZE; i++) {
        const x = i / TABLE_SIZE;
        let v = 0;
        for (let k = 1; k <= h; k++) v += ampOf(k) * Math.sin(TAU * k * x);
        table[i] = v;
        peak = Math.max(peak, Math.abs(v));
      }
      if (peak > 0) for (let i = 0; i < TABLE_SIZE; i++) table[i] /= peak;
      table[TABLE_SIZE] = table[0];
      this.levels.push({ maxFreq: 18000 / h, table });
      if (h === 1) break;
    }
    // pushed from the most harmonics (the lowest maxFreq) up: already ascending, which read() relies on
  }
  /** phase in cycles (any real), freq for the mip choice: the level with the most harmonics that all stay under ~18 kHz. */
  read(phase, freq) {
    let level = this.levels[this.levels.length - 1];
    for (let i = 0; i < this.levels.length; i++) {
      if (freq <= this.levels[i].maxFreq) {
        level = this.levels[i];
        break;
      }
    }
    // Too high for every level: a sine.
    if (freq > level.maxFreq) return Math.sin(TAU * phase);
    const p = (phase - Math.floor(phase)) * TABLE_SIZE;
    const i = p | 0;
    const f = p - i;
    const t = level.table;
    return t[i] + (t[i + 1] - t[i]) * f;
  }
}

const WAVES = {
  saw: new Wavetable((k) => 1 / k, 64),
  /** Reedy: strong odd harmonics with the evens present (harmonium reeds). */
  reed: new Wavetable((k) => (k % 2 ? 1 / k : 0.6 / k), 40),
  /** Double reed (shehnai): bright and nasal, nearly flat to the 10th harmonic. */
  doubleReed: new Wavetable((k) => (k <= 10 ? 1 / Math.sqrt(k) : 3.16 / k), 48),
  /** Principal pipe: a round tone with a string of soft upper harmonics. */
  principal: new Wavetable((k) => [0, 1, 0.5, 0.3, 0.2, 0.13, 0.09, 0.06, 0.04][k] ?? 0, 8),
  /** Flute body. */
  flute: new Wavetable((k) => [0, 1, 0.42, 0.2, 0.12, 0.07, 0.045, 0.03, 0.02, 0.013, 0.008][k] ?? 0, 10),
  /** Brass: a bright saw with a rounded top. */
  brass: new Wavetable((k) => (k <= 12 ? 1 / Math.pow(k, 0.8) : 7 / (k * k)), 48),
};

// ───────────────────────────── Filters ─────────────────────────────

/** One-pole lowpass over a buffer segment (in place). */
function onePoleLowpass(buf, from, to, cutoff) {
  const a = Math.exp((-TAU * cutoff) / RATE);
  let y = 0;
  for (let i = from; i < to; i++) {
    y = buf[i] * (1 - a) + y * a;
    buf[i] = y;
  }
}

/** RBJ biquad coefficients (shelves take `q` as their slope: 0.707 is the cookbook's S = 1). */
function biquadCoefficients(type, f0, q, gainDb = 0) {
  const w0 = (TAU * Math.min(f0, RATE * 0.45)) / RATE;
  const cosw = Math.cos(w0);
  const sinw = Math.sin(w0);
  const alpha = sinw / (2 * q);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'bandpass') {
    // constant 0 dB peak gain
    b0 = alpha;
    b1 = 0;
    b2 = -alpha;
    a0 = 1 + alpha;
    a1 = -2 * cosw;
    a2 = 1 - alpha;
  } else if (type === 'lowpass') {
    b0 = (1 - cosw) / 2;
    b1 = 1 - cosw;
    b2 = (1 - cosw) / 2;
    a0 = 1 + alpha;
    a1 = -2 * cosw;
    a2 = 1 - alpha;
  } else if (type === 'highpass') {
    b0 = (1 + cosw) / 2;
    b1 = -(1 + cosw);
    b2 = (1 + cosw) / 2;
    a0 = 1 + alpha;
    a1 = -2 * cosw;
    a2 = 1 - alpha;
  } else if (type === 'peak') {
    const A = Math.pow(10, gainDb / 40);
    b0 = 1 + alpha * A;
    b1 = -2 * cosw;
    b2 = 1 - alpha * A;
    a0 = 1 + alpha / A;
    a1 = -2 * cosw;
    a2 = 1 - alpha / A;
  } else if (type === 'highshelf' || type === 'lowshelf') {
    const A = Math.pow(10, gainDb / 40);
    const sq = 2 * Math.sqrt(A) * alpha;
    if (type === 'highshelf') {
      b0 = A * (A + 1 + (A - 1) * cosw + sq);
      b1 = -2 * A * (A - 1 + (A + 1) * cosw);
      b2 = A * (A + 1 + (A - 1) * cosw - sq);
      a0 = A + 1 - (A - 1) * cosw + sq;
      a1 = 2 * (A - 1 - (A + 1) * cosw);
      a2 = A + 1 - (A - 1) * cosw - sq;
    } else {
      b0 = A * (A + 1 - (A - 1) * cosw + sq);
      b1 = 2 * A * (A - 1 - (A + 1) * cosw);
      b2 = A * (A + 1 - (A - 1) * cosw - sq);
      a0 = A + 1 + (A - 1) * cosw + sq;
      a1 = -2 * (A - 1 + (A + 1) * cosw);
      a2 = A + 1 + (A - 1) * cosw - sq;
    }
  } else throw new Error(`unknown biquad ${type}`);
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

/** Run a biquad over a segment (in place), optionally mixing it with the dry signal. */
function biquad(buf, from, to, type, f0, q, { gainDb = 0, mix = 1, gain = 1 } = {}) {
  runBiquad(buf, from, to, biquadCoefficients(type, f0, q, gainDb), mix, gain);
}

function runBiquad(buf, from, to, c, mix = 1, gain = 1) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = from; i < to; i++) {
    const x = buf[i];
    const y = c.b0 * x + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    buf[i] = x * (1 - mix) + y * gain * mix;
  }
}

/** Several bandpass resonances in parallel (formants), replacing the segment. */
function formants(buf, from, to, list) {
  const n = to - from;
  const src = buf.slice(from, to);
  const out = new Float32Array(n);
  for (const f of list) {
    const c = biquadCoefficients('bandpass', f.freq, f.q);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < n; i++) {
      const x = src[i];
      const y = c.b0 * x + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
      x2 = x1;
      x1 = x;
      y2 = y1;
      y1 = y;
      out[i] += y * f.gain;
    }
  }
  for (let i = 0; i < n; i++) buf[from + i] = out[i];
}

// ───────────────────────────── Envelopes ─────────────────────────────

/** Attack / release with a sustain body; `t` in seconds from the note start, `dur` the held length. */
function ar(t, dur, attack, release) {
  const a = attack > 0 ? Math.min(1, t / attack) : 1;
  const r = t > dur ? Math.max(0, 1 - (t - dur) / release) : 1;
  return a * a * (2 - a) * r * r;
}

/** A tiny per-note scratch buffer pool so instruments can filter their own note before mixing. */
let scratch = new Float32Array(RATE * 12);
function takeScratch(n) {
  if (scratch.length < n) scratch = new Float32Array(n);
  scratch.fill(0, 0, n);
  return scratch;
}

/** White noise through a one-pole highpass and lowpass: breath, bow and reed noise. */
function bandNoise(rng, hp, lp) {
  const ah = Math.exp((-TAU * hp) / RATE);
  const al = Math.exp((-TAU * lp) / RATE);
  let x1 = 0, yh = 0, yl = 0;
  return () => {
    const x = rng.next() * 2 - 1;
    yh = ah * (yh + x - x1);
    x1 = x;
    yl = yh * (1 - al) + yl * al;
    return yl;
  };
}

// ───────────────────────────── Stems ─────────────────────────────

/**
 * Every instrument renders into its own mono stem; the mix-down filters it (cuts
 * and EQ), pans it, offsets one channel by a few samples (the widener), sends part
 * of it to the reverb and sums it into the bus. Instruments write straight into `buf`.
 */
class Stem {
  constructor(name, samples, cfg = {}) {
    this.name = name;
    this.buf = new Float32Array(samples);
    this.gain = cfg.gain ?? 0.5;
    this.pan = cfg.pan ?? 0;
    this.width = cfg.width ?? 0; // samples: >0 delays the right channel, <0 the left
    this.send = cfg.send ?? 0.2; // reverb send
    this.lowCut = cfg.lowCut ?? 0; // highpass (Hz) applied to the stem, 0 = none
    this.highCut = cfg.highCut ?? 0; // lowpass (Hz), 0 = none
    this.eq = cfg.eq ?? []; // [type, freq, q, gainDb] (peak, highshelf, lowshelf)
  }
  /** The sample range a note at `t` lasting `len` seconds covers, clipped to the buffer. */
  span(t, len) {
    const from = Math.max(0, Math.floor(t * RATE));
    const to = Math.min(this.buf.length, Math.floor((t + len) * RATE));
    return [from, to];
  }
}

/** Mixes a scratch segment into the stem. */
function blend(stem, from, to, src, gain = 1) {
  const buf = stem.buf;
  for (let i = from, j = 0; i < to; i++, j++) buf[i] += src[j] * gain;
}

/** Frequency at time `t` of a note gliding from `from` to `freq` over `glide` seconds (meend / portamento). */
function glideFreq(note, t, glide) {
  if (!note.from || note.from === note.freq || glide <= 0) return note.freq;
  const x = Math.min(1, t / glide);
  const s = x * x * (3 - 2 * x);
  return note.from * Math.pow(note.freq / note.from, s);
}

/**
 * Vibrato multiplier: depth grows in over `onset` seconds. Gamak is a wide, faster
 * oscillation; andolan a slow sway on a komal note (Bhairav's re and dha).
 */
function vibrato(note, t, rate, depth, onset, phase = 0) {
  if (note.andolan) return 1 + 0.016 * Math.min(1, t / 0.3) * Math.sin(TAU * 2.2 * t + phase);
  const d = note.gamak ? Math.max(depth * 3.5, 0.015) : depth;
  const r = note.gamak ? rate * 1.15 : rate;
  const grow = Math.min(1, t / onset);
  return 1 + d * grow * Math.sin(TAU * r * t + phase);
}

// ───────────────────────────── Instruments A ─────────────────────────────

/**
 * Tanpura: a rich pluck with jawari shimmer. The curved bridge lets the string
 * graze it, so a bright band of harmonics swells and then sweeps down through the
 * series after the pluck instead of simply decaying (the tanpura's "ji"); each
 * harmonic also beats slowly. Harmonics run as rotating phasors (no sine calls).
 */
function tanpura(stem, note) {
  const { freq, vel, rng } = note;
  const [from, to] = stem.span(note.t, 5.5);
  if (to <= from) return;
  const n = to - from;
  const buf = stem.buf;
  const H = Math.max(1, Math.min(30, Math.floor(15000 / freq)));
  const amp = new Float64Array(H), env = new Float64Array(H), decay = new Float64Array(H), gain = new Float64Array(H);
  const c = new Float64Array(H), s = new Float64Array(H), cr = new Float64Array(H), sr = new Float64Array(H);
  const jawRate = new Float64Array(H), jawPhase = new Float64Array(H);
  for (let k = 0; k < H; k++) {
    const h = k + 1;
    amp[k] = 1 / Math.pow(h, 0.7);
    env[k] = 1;
    decay[k] = Math.exp(-1 / ((3.2 / (1 + 0.1 * h)) * RATE));
    const w = (TAU * freq * h * (1 + 0.0001 * h * h)) / RATE;
    cr[k] = Math.cos(w);
    sr[k] = Math.sin(w);
    const p0 = rng.range(0, TAU);
    c[k] = Math.cos(p0);
    s[k] = Math.sin(p0);
    jawRate[k] = TAU * (0.5 + 0.17 * h + rng.range(-0.05, 0.05));
    jawPhase[k] = rng.range(0, TAU);
  }
  const block = 64;
  for (let i0 = 0; i0 < n; i0 += block) {
    const t = i0 / RATE;
    const centre = 3.5 + 13 * Math.exp(-t / 1.3);
    for (let k = 0; k < H; k++) {
      const d = (k + 1 - centre) / 3;
      gain[k] = amp[k] * (1 + 1.6 * Math.exp(-d * d) * (0.75 + 0.25 * Math.sin(jawRate[k] * t + jawPhase[k])));
    }
    const end = Math.min(n, i0 + block);
    for (let i = i0; i < end; i++) {
      let v = 0;
      for (let k = 0; k < H; k++) {
        const nc = c[k] * cr[k] - s[k] * sr[k];
        s[k] = s[k] * cr[k] + c[k] * sr[k];
        c[k] = nc;
        env[k] *= decay[k];
        v += gain[k] * env[k] * s[k];
      }
      const onset = i < 260 ? i / 260 : 1;
      const tail = n - i < 2205 ? (n - i) / 2205 : 1;
      buf[from + i] += vel * 0.1 * onset * tail * v;
    }
  }
  // a brief bridge buzz at the pluck
  const m = Math.min(n, Math.floor(0.05 * RATE));
  if (m > 0) {
    const sc = takeScratch(m);
    for (let i = 0; i < m; i++) sc[i] = (rng.next() * 2 - 1) * Math.exp(-i / (0.012 * RATE));
    biquad(sc, 0, m, 'bandpass', 3000, 2);
    blend(stem, from, from + m, sc, vel * 0.06);
  }
}

/**
 * Karplus-Strong plucked string with fractional tuning, a damping filter, a
 * pitch bend for meend and an optional detuned partner string.
 *   opts: brightness 0..1 (pluck colour), decay (seconds to -60 dB), bend (glide seconds),
 *   partner (ratio), partnerGain, pick (plectrum or hammer click), buzz (jawari: a bright
 *   band that dies faster than the string), body (a resonance in Hz), halo (sympathetic strings)
 */
function ksPluck(stem, note, opts = {}) {
  const { freq, vel, rng } = note;
  const length = Math.min(opts.maxLength ?? 3, Math.max(0.4, note.dur + (opts.ring ?? 1.2)));
  const [from, to] = stem.span(note.t, length);
  if (to <= from) return;
  const n = to - from;
  const brightness = opts.brightness ?? 0.6;
  const rho = 0.08 + 0.45 * (1 - brightness); // damping lowpass coefficient
  const decaySeconds = opts.decay ?? 1.6;
  const voices = [{ ratio: 1, gain: 1 }];
  if (opts.partner) voices.push({ ratio: opts.partner, gain: opts.partnerGain ?? 0.5 });
  const out = takeScratch(n);
  const bendGlide = note.from ? (opts.bend ?? 0.25) : 0;
  for (const voice of voices) {
    const f0 = (note.from ?? freq) * voice.ratio;
    const f1 = freq * voice.ratio;
    const periodMax = RATE / Math.min(f0, f1);
    const size = Math.ceil(periodMax) + 8;
    const line = new Float32Array(size);
    // excitation: a noise burst one period long, coloured by the pluck position
    const exciteLen = Math.max(2, Math.round(RATE / f1));
    let lp = 0;
    const colour = Math.exp((-TAU * (900 + 7000 * brightness)) / RATE);
    for (let i = 0; i < exciteLen && i < size; i++) {
      const w = rng.next() * 2 - 1;
      lp = w * (1 - colour) + lp * colour;
      line[i] = lp;
    }
    // remove the DC of the burst
    let mean = 0;
    for (let i = 0; i < exciteLen; i++) mean += line[i];
    mean /= exciteLen;
    for (let i = 0; i < exciteLen; i++) line[i] -= mean;
    let w = exciteLen % size;
    let y1 = 0;
    const g = Math.pow(0.001, 1 / (decaySeconds * f1)); // per period loss → per sample via period below
    for (let i = 0; i < n; i++) {
      const t = i / RATE;
      let f = f1;
      if (bendGlide > 0 && t < bendGlide) {
        const x = t / bendGlide;
        const s = x * x * (3 - 2 * x);
        f = f0 * Math.pow(f1 / f0, s);
      }
      const period = RATE / f;
      const D = period - 0.5 - rho / (1 - rho);
      const rp = w - D;
      const ri = Math.floor(rp);
      const frac = rp - ri;
      const i0 = ((ri % size) + size) % size;
      const i1 = (i0 + 1) % size;
      const im = (i0 - 1 + size) % size;
      const d0 = line[im] + (line[i0] - line[im]) * frac;
      const d1 = line[i0] + (line[i1] - line[i0]) * frac;
      const avg = 0.5 * (d0 + d1);
      y1 = avg * (1 - rho) + y1 * rho;
      const sample = y1 * Math.pow(g, 1 / period);
      line[w] = sample;
      w = (w + 1) % size;
      out[i] += sample * voice.gain;
    }
  }
  if (opts.pick) {
    const m = Math.min(n, Math.floor(0.008 * RATE));
    for (let i = 0; i < m; i++) out[i] += (rng.next() * 2 - 1) * opts.pick * Math.exp(-i / (0.0015 * RATE));
  }
  if (opts.buzz) {
    const hp = out.slice(0, n);
    biquad(hp, 0, n, 'highpass', 1800, 0.7);
    const tauBuzz = (opts.buzzDecay ?? 0.6) * RATE;
    for (let i = 0; i < n; i++) out[i] += hp[i] * opts.buzz * Math.exp(-i / tauBuzz);
  }
  if (opts.body) biquad(out, 0, n, 'peak', opts.body, 1.2, { gainDb: opts.bodyDb ?? 6 });
  if (opts.halo) {
    // sympathetic strings: a faint, slow ring an octave and a twelfth up
    for (let i = 0; i < n; i++) {
      const t = i / RATE;
      const sw = Math.min(1, t / 0.08) * Math.exp(-t / 1.4);
      out[i] += opts.halo * sw * (Math.sin(TAU * freq * 2.002 * t) + 0.6 * Math.sin(TAU * freq * 3.004 * t));
    }
  }
  // soften the very end so a cut note never clicks
  const tail = Math.min(n, Math.floor(0.03 * RATE));
  for (let i = 0; i < tail; i++) out[n - 1 - i] *= i / tail;
  blend(stem, from, to, out, vel * (opts.level ?? 0.5));
}

const sitar = (stem, note) => ksPluck(stem, note, { brightness: 0.88, decay: 2.4, partner: 1.0045, partnerGain: 0.35, ring: 1.8, bend: 0.3, buzz: 0.9, pick: 0.2, halo: 0.05, level: 0.44 });
const rabab = (stem, note) => ksPluck(stem, note, { brightness: 0.62, decay: 1.0, ring: 0.8, body: 420, bodyDb: 5, buzz: 0.35, pick: 0.3, level: 0.54, maxLength: 2 });
const ukulele = (stem, note) => ksPluck(stem, note, { brightness: 0.72, decay: 1.2, ring: 0.9, pick: 0.15, level: 0.62, maxLength: 2 });
const folkPluck = (stem, note) => ksPluck(stem, note, { brightness: 0.86, decay: 1.25, partner: 2.003, partnerGain: 0.2, ring: 1.0, bend: 0.15, buzz: 0.5, pick: 0.25, level: 0.55, maxLength: 2.2 });
/** Swarmandal (and harp): many bright strings left to ring; strummed as sweeps. */
const swarmandal = (stem, note) => ksPluck(stem, note, { brightness: 0.93, decay: 3.2, partner: 1.0031, partnerGain: 0.45, ring: 2.6, pick: 0.12, level: 0.5, maxLength: 4 });
/** Upright bass: a round, warm pluck. */
const bassPluck = (stem, note) => ksPluck(stem, note, { brightness: 0.34, decay: 1.8, ring: 0.5, body: 140, bodyDb: 4, pick: 0.08, level: 0.71, maxLength: 2.6 });
/** A short, bright pluck with an octave shimmer (arpeggios). */
const pluck = (stem, note) => ksPluck(stem, note, { brightness: 0.95, decay: 0.6, partner: 2.0, partnerGain: 0.22, ring: 0.45, pick: 0.1, level: 0.55, maxLength: 1.2 });

/** Santoor: a hammered dulcimer; a held note is a tremolo of strikes on three slightly detuned strings. */
function santoor(stem, note) {
  const strike = (t, vel) => ksPluck(stem, { ...note, t, vel, from: undefined }, { brightness: 0.95, decay: 1.4, partner: 1.0022, partnerGain: 0.6, ring: 1.2, pick: 0.28, level: 0.42, maxLength: 2.2 });
  if (note.dur < 0.85) {
    strike(note.t, note.vel);
    return;
  }
  const rate = 13.5; // strikes per second
  const count = Math.max(2, Math.floor((note.dur - 0.1) * rate));
  for (let k = 0; k < count; k++) {
    const t = note.t + k / rate + (k ? note.rng.gauss() * 0.004 : 0);
    const shape = k === 0 ? 1 : 0.55 + 0.25 * Math.sin((k / count) * Math.PI); // a swell inside the tremolo
    strike(t, note.vel * shape);
  }
}

/** Bansuri: a flute body with breath noise (and a chiff at the onset), vibrato and portamento between notes. */
function bansuri(stem, note) {
  const { vel, rng } = note;
  const attack = 0.06, release = 0.2, glide = 0.11;
  const [from, to] = stem.span(note.t, note.dur + release);
  if (to <= from) return;
  const n = to - from;
  const s = takeScratch(n);
  const vibPhase = rng.range(0, TAU);
  const breath = bandNoise(rng, 1500, 9000);
  let phase = rng.range(0, 1);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const f = glideFreq(note, t, glide) * vibrato(note, t, 5.2, 0.0042, 0.4, vibPhase);
    phase += f / RATE;
    const env = ar(t, note.dur, attack, release);
    const body = WAVES.flute.read(phase, f);
    const chiff = 1 + 2.4 * Math.exp(-t / 0.05);
    s[i] = env * (body + 0.1 * vel * Math.sin(TAU * 2 * phase) + breath() * 0.3 * chiff * (0.85 + 0.15 * body));
  }
  blend(stem, from, to, s, vel * 0.31);
}

/** Shehnai: a double reed, its bright spectrum shaped by three broad formants (the nasal bite); strong vibrato and meend. */
function shehnai(stem, note) {
  const { vel, rng } = note;
  const attack = 0.03, release = 0.09, glide = 0.14;
  const [from, to] = stem.span(note.t, note.dur + release);
  if (to <= from) return;
  const n = to - from;
  const s = takeScratch(n);
  const vibPhase = rng.range(0, TAU);
  const reed = bandNoise(rng, 2000, 9000);
  let phase = rng.range(0, 1);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const f = glideFreq(note, t, glide) * vibrato(note, t, 5.9, 0.006, 0.25, vibPhase);
    phase += f / RATE;
    s[i] = ar(t, note.dur, attack, release) * (WAVES.doubleReed.read(phase, f) + reed() * 0.05 * (1 + 3 * Math.exp(-t / 0.04)));
  }
  const dry = s.slice(0, n);
  biquad(dry, 0, n, 'lowpass', 7500, 0.7);
  formants(s, 0, n, [
    { freq: 1050, q: 3.2, gain: 1.0 },
    { freq: 2300, q: 4, gain: 0.8 },
    { freq: 3600, q: 5, gain: 0.45 },
  ]);
  for (let i = 0; i < n; i++) s[i] = s[i] * 1.5 + dry[i] * 0.45;
  blend(stem, from, to, s, vel * 0.47);
}

/** Sarangi: a bowed string with a skin belly (formants), sympathetic strings, a vocal vibrato and long meend. */
function sarangi(stem, note) {
  const { vel, rng } = note;
  const attack = 0.09, release = 0.18, glide = 0.16;
  const [from, to] = stem.span(note.t, note.dur + release);
  if (to <= from) return;
  const n = to - from;
  const s = takeScratch(n);
  const vibPhase = rng.range(0, TAU);
  const bow = bandNoise(rng, 2500, 8000);
  let p1 = rng.range(0, 1), p2 = rng.range(0, 1);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const f = glideFreq(note, t, glide) * vibrato(note, t, 5.3, 0.0065, 0.35, vibPhase);
    p1 += f / RATE;
    p2 += (f * 1.0021) / RATE;
    const env = ar(t, note.dur, attack, release) * (0.9 + 0.1 * Math.sin(TAU * 0.7 * t + vibPhase));
    s[i] = env * (WAVES.saw.read(p1, f) + 0.3 * WAVES.saw.read(p2, f) + bow() * 0.08);
  }
  const dry = s.slice(0, n);
  onePoleLowpass(dry, 0, n, 4000);
  formants(s, 0, n, [
    { freq: 600, q: 3.5, gain: 1.0 },
    { freq: 1400, q: 4.5, gain: 0.75 },
    { freq: 2900, q: 5.5, gain: 0.5 },
    { freq: 4500, q: 6, gain: 0.25 },
  ]);
  for (let i = 0; i < n; i++) s[i] = s[i] * 1.4 + dry[i] * 0.2;
  blend(stem, from, to, s, vel * 0.425);
}

/** Harmonium: three detuned reeds per note with a slow bellows swell and the reeds' nasal bite. */
function harmonium(stem, note) {
  const { freq, vel, rng } = note;
  const attack = 0.12, release = 0.24;
  const [from, to] = stem.span(note.t, note.dur + release);
  if (to <= from) return;
  const n = to - from;
  const s = takeScratch(n);
  const reeds = [1, 1.0026, 0.9977];
  const phases = reeds.map(() => rng.range(0, 1));
  const bellowsPhase = rng.range(0, TAU);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const bellows = 1 + 0.06 * Math.sin(TAU * 0.33 * t + bellowsPhase);
    let v = 0;
    for (let r = 0; r < reeds.length; r++) {
      const f = freq * reeds[r];
      phases[r] += f / RATE;
      v += WAVES.reed.read(phases[r], f);
    }
    s[i] = ar(t, note.dur, attack, release) * bellows * v;
  }
  biquad(s, 0, n, 'lowpass', 6000, 0.7);
  biquad(s, 0, n, 'peak', 1900, 1.2, { gainDb: 3 });
  blend(stem, from, to, s, vel * 0.128);
}

/** Pipe organ: principal ranks (16', 8', 4', 2 2/3', 2') and a soft mixture in chorus, with a slow attack and a little chiff. */
function organ(stem, note) {
  const { freq, vel, rng } = note;
  const attack = 0.09, release = 0.3;
  const [from, to] = stem.span(note.t, note.dur + release);
  if (to <= from) return;
  const n = to - from;
  const s = takeScratch(n);
  const ranks = [
    { ratio: 1, gain: 1 },
    { ratio: 2, gain: 0.55 },
    { ratio: 0.5, gain: freq < 240 ? 0.45 : 0.25 },
    { ratio: 3, gain: 0.16 },
    { ratio: 4, gain: 0.24 },
    { ratio: 6, gain: 0.1 },
    { ratio: 8, gain: 0.08 },
    { ratio: 12, gain: 0.04 },
  ];
  const chorus = [0.9992, 1.0009];
  const phases = ranks.flatMap(() => chorus.map(() => rng.range(0, 1)));
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    let v = 0;
    let p = 0;
    for (const rank of ranks) {
      for (const c of chorus) {
        const f = freq * rank.ratio * c;
        phases[p] += f / RATE;
        v += rank.gain * WAVES.principal.read(phases[p], f);
        p++;
      }
    }
    const chiff = (rng.next() * 2 - 1) * Math.exp(-t / 0.02) * 0.35;
    s[i] = ar(t, note.dur, attack, release) * (v + chiff);
  }
  blend(stem, from, to, s, vel * 0.16);
}

// ───────────────────────────── Instruments B ─────────────────────────────

/**
 * Strings: detuned saws (five desks, or two for a solo line) through a lowpass that
 * opens with the bow pressure, a slight vibrato per desk and a little bite.
 */
function strings(stem, note, opts = {}) {
  const { vel, rng } = note;
  const attack = opts.attack ?? 0.32, release = opts.release ?? 0.55;
  const [from, to] = stem.span(note.t, note.dur + release);
  if (to <= from) return;
  const n = to - from;
  const s = takeScratch(n);
  // a section is five desks a little apart in pitch and in time; a solo line is one player (with a faint sympathetic ring)
  const detunes = opts.solo ? [1, 1.0012] : [0.9951, 0.9978, 1, 1.0025, 1.0052];
  const weights = opts.solo ? [1, 0.25] : detunes.map(() => 1);
  const delays = detunes.map((_, k) => (opts.solo || k === 2 ? 0 : rng.range(0, 0.03)));
  const depth = opts.solo ? 0.0045 : 0.003;
  const vibRates = detunes.map(() => rng.range(4.8, 5.6));
  const vibPhases = detunes.map(() => rng.range(0, TAU));
  const phases = detunes.map(() => rng.range(0, 1));
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const g = glideFreq(note, t, 0.08);
    let v = 0;
    for (let k = 0; k < detunes.length; k++) {
      const f = g * detunes[k] * (1 + depth * Math.min(1, t / 0.5) * Math.sin(TAU * vibRates[k] * t + vibPhases[k]));
      phases[k] += f / RATE;
      const onset = t < delays[k] ? 0 : Math.min(1, (t - delays[k]) / 0.04);
      v += WAVES.saw.read(phases[k], f) * weights[k] * onset;
    }
    s[i] = ar(t, note.dur, attack, release) * v;
  }
  biquad(s, 0, n, 'lowpass', Math.min(10000, (opts.cutoff ?? 4200) + 3000 * vel), 0.75);
  biquad(s, 0, n, 'highpass', opts.lowCut ?? 70, 0.7);
  // the body: a little warmth, less nasal honk, the bridge's bite
  biquad(s, 0, n, 'peak', 500, 1.2, { gainDb: 1.5 });
  biquad(s, 0, n, 'peak', 1500, 1.4, { gainDb: -2 });
  biquad(s, 0, n, 'peak', 2800, 1, { gainDb: 2.5 });
  blend(stem, from, to, s, vel * (opts.level ?? 0.106) * (opts.solo ? 2 : 1));
}

/**
 * Soft pad: detuned saws under a slow filter sweep; `formant` turns it into the
 * low, chant-like voice (vowel resonances over a sub-octave).
 */
function pad(stem, note, opts = {}) {
  const { freq, vel, rng } = note;
  const attack = opts.attack ?? 1.0, release = opts.release ?? 1.5;
  const [from, to] = stem.span(note.t, note.dur + release);
  if (to <= from) return;
  const n = to - from;
  const s = takeScratch(n);
  const detunes = [0.9962, 0.9988, 1.0014, 1.0041];
  const phases = detunes.map(() => rng.range(0, 1));
  const lfoPhase = rng.range(0, TAU);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    let v = 0;
    for (let k = 0; k < detunes.length; k++) {
      const f = freq * detunes[k];
      phases[k] += f / RATE;
      v += WAVES.saw.read(phases[k], f);
    }
    if (opts.formant) v += 1.6 * Math.sin(TAU * (freq / 2) * t) * (1 + 0.1 * Math.sin(TAU * 0.4 * t + lfoPhase));
    s[i] = ar(t, note.dur, attack, release) * v;
  }
  if (opts.formant) {
    const dry = s.slice(0, n);
    formants(s, 0, n, [
      { freq: 430, q: 7, gain: 1.0 },
      { freq: 820, q: 8, gain: 0.7 },
      { freq: 2250, q: 10, gain: 0.3 },
    ]);
    onePoleLowpass(dry, 0, n, 420);
    for (let i = 0; i < n; i++) s[i] = s[i] * 1.4 + dry[i] * 0.9;
  } else {
    const cutoff = (opts.cutoff ?? 2400) * (1 + 0.25 * Math.sin(lfoPhase));
    biquad(s, 0, n, 'lowpass', cutoff, 0.8);
  }
  biquad(s, 0, n, 'highpass', 55, 0.7);
  blend(stem, from, to, s, vel * (opts.level ?? 0.195));
}

/** Choir: an ensemble of voices singing "aa" (detuned saws, each with its own vibrato, through vowel formants). */
function choir(stem, note, opts = {}) {
  const { vel, rng } = note;
  const attack = opts.attack ?? 0.3, release = opts.release ?? 0.6;
  const [from, to] = stem.span(note.t, note.dur + release);
  if (to <= from) return;
  const n = to - from;
  const s = takeScratch(n);
  const detunes = [0.9965, 0.9988, 1.0009, 1.0031, 1.0052];
  const rates = detunes.map(() => rng.range(4.9, 6.1));
  const vph = detunes.map(() => rng.range(0, TAU));
  const phases = detunes.map(() => rng.range(0, 1));
  // singers never start together
  const delays = detunes.map((_, k) => (k === 2 ? 0 : rng.range(0, 0.04)));
  const breath = bandNoise(rng, 1800, 6000);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const g = glideFreq(note, t, 0.1);
    let v = 0;
    for (let k = 0; k < detunes.length; k++) {
      const f = g * detunes[k] * (1 + 0.0045 * Math.min(1, t / 0.4) * Math.sin(TAU * rates[k] * t + vph[k]));
      phases[k] += f / RATE;
      const onset = t < delays[k] ? 0 : Math.min(1, (t - delays[k]) / 0.06);
      v += WAVES.saw.read(phases[k], f) * onset;
    }
    s[i] = ar(t, note.dur, attack, release) * (v + breath() * 0.5);
  }
  const vowel = opts.vowel ?? [
    { freq: 800, q: 5, gain: 1.0 },
    { freq: 1150, q: 6, gain: 0.7 },
    { freq: 2800, q: 8, gain: 0.32 },
    { freq: 3500, q: 9, gain: 0.18 },
  ];
  formants(s, 0, n, vowel);
  biquad(s, 0, n, 'highpass', 90, 0.7);
  blend(stem, from, to, s, vel * (opts.level ?? 0.4));
}

/** Brass swell: a bright additive wave whose lowpass opens with the breath (two one-poles swept per sample). */
function brass(stem, note) {
  const { freq, vel, rng } = note;
  // short notes speak quickly (a fanfare's sixteenths), long ones swell
  const attack = Math.min(0.14, 0.25 * note.dur + 0.02), release = 0.28;
  const opening = Math.min(0.22, 0.4 * note.dur + 0.03);
  const [from, to] = stem.span(note.t, note.dur + release);
  if (to <= from) return;
  const n = to - from;
  const s = takeScratch(n);
  const detunes = [0.998, 1, 1.0021];
  const phases = detunes.map(() => rng.range(0, 1));
  const vibPhase = rng.range(0, TAU);
  let y1 = 0, y2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const open = 1 - Math.exp(-t / opening);
    const f0 = freq * (1 + 0.0025 * Math.min(1, Math.max(0, t - 0.35) / 0.5) * Math.sin(TAU * 5 * t + vibPhase));
    let v = 0;
    for (let k = 0; k < detunes.length; k++) {
      const f = f0 * detunes[k];
      phases[k] += f / RATE;
      v += WAVES.brass.read(phases[k], f);
    }
    const cutoff = 500 + (1300 + 3800 * vel) * open;
    const a = Math.exp((-TAU * cutoff) / RATE);
    y1 = v * (1 - a) + y1 * a;
    y2 = y1 * (1 - a) + y2 * a;
    s[i] = ar(t, note.dur, attack, release) * y2;
  }
  blend(stem, from, to, s, vel * 0.19);
}

/**
 * Piano: additive partials with string inharmonicity, a bright hammer whose upper
 * partials die first, a two-stage decay, a damper at release and a faint
 * sympathetic ring an octave and a twelfth above. A note held past the longest
 * the string can ring is damped before it ends, never cut.
 */
function piano(stem, note) {
  const { freq, vel, rng } = note;
  const release = 0.14;
  const tau0 = clamp(3.6 * Math.sqrt(110 / freq), 0.5, 4.5);
  const length = Math.min(note.dur + release + 0.1, tau0 * 2.2 + 0.3);
  const [from, to] = stem.span(note.t, length);
  if (to <= from) return;
  const n = to - from;
  const s = takeScratch(n);
  const dampAt = Math.min(note.dur, length - release - 0.1);
  const B = freq < 200 ? 0.00018 : freq < 800 ? 0.00035 : 0.0009;
  const H = Math.min(freq > 1200 ? 8 : freq > 400 ? 14 : 20, Math.floor(16000 / freq));
  const strike = 0.12; // hammer position along the string
  const brightness = 1.35 - 0.5 * vel;
  for (let k = 1; k <= H; k++) {
    const amp = Math.abs(Math.sin(Math.PI * k * strike)) / Math.pow(k, brightness) + (k === 1 ? 0.3 : 0);
    const tau = tau0 / (1 + 0.22 * (k - 1));
    // stop this partial once it is inaudible
    const cut = Math.min(n, Math.floor(RATE * Math.min(length, Math.max(0.05, tau * Math.log(amp / 0.0004)))));
    if (cut <= 0) continue;
    const fk = freq * k * Math.sqrt(1 + B * k * k);
    const phase0 = rng.range(0, TAU);
    for (let i = 0; i < cut; i++) {
      const t = i / RATE;
      const env = 0.72 * Math.exp(-t / tau) + 0.28 * Math.exp(-t / (2.6 * tau));
      const damper = t > dampAt ? Math.exp(-(t - dampAt) / 0.06) : 1;
      s[i] += amp * env * damper * Math.sin(TAU * fk * t + phase0);
    }
  }
  // hammer noise and the sympathetic strings
  const hammer = Math.min(n, Math.floor(0.012 * RATE));
  for (let i = 0; i < hammer; i++) s[i] += (rng.next() * 2 - 1) * 0.5 * vel * Math.exp(-i / (0.004 * RATE));
  const symLen = Math.min(n, Math.floor(RATE * Math.min(length, 1.8)));
  for (let i = 0; i < symLen; i++) {
    const t = i / RATE;
    const swell = Math.min(1, t / 0.12) * Math.exp(-t / 0.9) * (t > dampAt ? Math.exp(-(t - dampAt) / 0.1) : 1);
    s[i] += 0.035 * swell * (Math.sin(TAU * freq * 2.004 * t) + 0.6 * Math.sin(TAU * freq * 3.01 * t));
  }
  const onset = Math.min(n, 40);
  for (let i = 0; i < onset; i++) s[i] *= i / onset;
  blend(stem, from, to, s, vel * 0.226);
}

/**
 * Modal strike: a struck bar, bell or comb tooth as a set of inharmonic partials
 * with their own decays, plus a mallet transient. Used for the music box, celesta,
 * bells, temple bell, marimba, xylophone and timpani presets below.
 */
function modalStrike(stem, note, spec) {
  const { freq, vel, rng } = note;
  const longest = Math.max(...spec.partials.map((p) => p.tau));
  const length = Math.min(spec.maxLength ?? 8, longest * 5);
  const [from, to] = stem.span(note.t, length);
  if (to <= from) return;
  const n = to - from;
  const s = takeScratch(n);
  for (const p of spec.partials) {
    const f = freq * p.ratio;
    if (f > 17000) continue;
    const cut = Math.min(n, Math.floor(RATE * Math.min(length, p.tau * Math.log(Math.max(p.amp, 1e-3) / 0.0003))));
    const phase0 = rng.range(0, TAU);
    const beat = p.beat ? TAU * p.beat : 0;
    const onset = p.onset ?? 0.002;
    for (let i = 0; i < cut; i++) {
      const t = i / RATE;
      const env = Math.exp(-t / p.tau) * Math.min(1, t / onset);
      const b = beat ? 0.5 + 0.5 * Math.cos(beat * t) : 1;
      s[i] += p.amp * env * b * Math.sin(TAU * f * t + phase0);
    }
  }
  if (spec.mallet) {
    const m = spec.mallet;
    const len = Math.min(n, Math.floor(m.length * RATE));
    const hit = new Float32Array(len);
    for (let i = 0; i < len; i++) hit[i] = (rng.next() * 2 - 1) * Math.exp(-i / (m.length * 0.3 * RATE));
    if (m.lowpass) onePoleLowpass(hit, 0, len, m.lowpass);
    if (m.bandpass) biquad(hit, 0, len, 'bandpass', m.bandpass, 1.2);
    for (let i = 0; i < len; i++) s[i] += hit[i] * m.gain * vel;
  }
  // a note cut by `maxLength` fades over its last 40 ms
  const fade = Math.min(n, Math.floor(0.04 * RATE));
  for (let i = 0; i < fade; i++) s[n - 1 - i] *= i / fade;
  blend(stem, from, to, s, vel * spec.level);
}

const PRESETS = {
  musicBox: {
    level: 0.26,
    partials: [
      { ratio: 1, amp: 1, tau: 1.5 },
      { ratio: 2.78, amp: 0.42, tau: 0.6 },
      { ratio: 5.42, amp: 0.22, tau: 0.35 },
      { ratio: 8.9, amp: 0.1, tau: 0.18 },
      { ratio: 12.6, amp: 0.05, tau: 0.09 },
    ],
    mallet: { length: 0.004, gain: 0.3, bandpass: 6000 },
  },
  celesta: {
    level: 0.32,
    partials: [
      { ratio: 1, amp: 1, tau: 1.3 },
      { ratio: 2.01, amp: 0.3, tau: 0.8 },
      { ratio: 4.08, amp: 0.12, tau: 0.45 },
      { ratio: 6.3, amp: 0.05, tau: 0.2 },
      { ratio: 9.7, amp: 0.04, tau: 0.08 },
    ],
    mallet: { length: 0.006, gain: 0.2, lowpass: 6000 },
  },
  bells: {
    level: 0.22,
    partials: [
      { ratio: 1, amp: 1, tau: 1.9, beat: 0.9 },
      { ratio: 2.41, amp: 0.5, tau: 1.4 },
      { ratio: 3.02, amp: 0.3, tau: 1.0 },
      { ratio: 4.5, amp: 0.22, tau: 0.7 },
      { ratio: 6.3, amp: 0.1, tau: 0.4 },
    ],
    mallet: { length: 0.005, gain: 0.3, bandpass: 4200 },
  },
  templeBell: {
    level: 0.146,
    maxLength: 11,
    partials: [
      { ratio: 0.5, amp: 0.55, tau: 7.5, onset: 0.03 },
      { ratio: 1, amp: 1, tau: 5.5, beat: 0.35 },
      { ratio: 1.19, amp: 0.5, tau: 4.2 },
      { ratio: 1.5, amp: 0.55, tau: 3.6 },
      { ratio: 2.0, amp: 0.45, tau: 3.0, beat: 0.6 },
      { ratio: 2.51, amp: 0.3, tau: 2.2 },
      { ratio: 2.66, amp: 0.25, tau: 2.0 },
      { ratio: 3.01, amp: 0.2, tau: 1.6 },
      { ratio: 4.17, amp: 0.12, tau: 1.0 },
      { ratio: 5.43, amp: 0.07, tau: 0.7 },
      { ratio: 6.8, amp: 0.06, tau: 0.5 },
      { ratio: 8.6, amp: 0.04, tau: 0.35 },
      { ratio: 10.9, amp: 0.025, tau: 0.25 },
    ],
    mallet: { length: 0.012, gain: 0.7, bandpass: 3500 },
  },
  marimba: {
    level: 0.31,
    partials: [
      { ratio: 1, amp: 1, tau: 0.45 },
      { ratio: 3.98, amp: 0.38, tau: 0.15 },
      { ratio: 10.1, amp: 0.14, tau: 0.06 },
    ],
    mallet: { length: 0.014, gain: 0.5, lowpass: 3000 },
  },
  xylophone: {
    level: 0.35,
    partials: [
      { ratio: 1, amp: 1, tau: 0.26 },
      { ratio: 3.0, amp: 0.45, tau: 0.11 },
      { ratio: 6.05, amp: 0.2, tau: 0.05 },
    ],
    mallet: { length: 0.008, gain: 0.6, bandpass: 3600 },
  },
  timpani: {
    level: 0.275,
    partials: [
      { ratio: 1, amp: 1, tau: 1.5 },
      { ratio: 1.504, amp: 0.5, tau: 1.0 },
      { ratio: 1.742, amp: 0.22, tau: 0.7 },
      { ratio: 2.0, amp: 0.28, tau: 0.8 },
      { ratio: 2.245, amp: 0.12, tau: 0.45 },
    ],
    mallet: { length: 0.03, gain: 0.5, lowpass: 900 },
  },
};
const musicBox = (stem, note) => modalStrike(stem, note, PRESETS.musicBox);
const celesta = (stem, note) => modalStrike(stem, note, PRESETS.celesta);
const bells = (stem, note) => modalStrike(stem, note, PRESETS.bells);
const templeBell = (stem, note) => modalStrike(stem, note, PRESETS.templeBell);
const marimba = (stem, note) => modalStrike(stem, note, PRESETS.marimba);
const xylophone = (stem, note) => modalStrike(stem, note, PRESETS.xylophone);
const timpani = (stem, note) => modalStrike(stem, note, PRESETS.timpani);

/** Conch (shankh): a low tone that swells in with breath, wavers, and fades. */
function conch(stem, note) {
  const { freq, vel, rng } = note;
  const attack = 1.1, release = 1.2;
  const [from, to] = stem.span(note.t, note.dur + release);
  if (to <= from) return;
  const n = to - from;
  const s = takeScratch(n);
  let phase = 0;
  let lp = 0;
  const colour = Math.exp((-TAU * 2400) / RATE);
  const breath = bandNoise(rng, 1500, 6000);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const rise = 0.975 + 0.025 * Math.min(1, t / 0.7);
    const waver = 1 + 0.004 * Math.sin(TAU * 0.6 * t) + 0.0015 * Math.sin(TAU * 4.3 * t);
    const f = freq * rise * waver;
    phase += f / RATE;
    const env = ar(t, note.dur, attack, release);
    const w = rng.next() * 2 - 1;
    lp = w * (1 - colour) + lp * colour;
    const tone = Math.sin(TAU * phase) + 0.5 * Math.sin(TAU * 2 * phase) + 0.25 * Math.sin(TAU * 3 * phase) + 0.12 * Math.sin(TAU * 4 * phase) + 0.06 * Math.sin(TAU * 5 * phase);
    s[i] = env * (tone + lp * 0.2 * (1.5 - env) + breath() * 0.25);
  }
  biquad(s, 0, n, 'peak', freq * 3, 2, { gainDb: 4 });
  blend(stem, from, to, s, vel * 0.26);
}

// ───────────────────────────── Percussion ─────────────────────────────

/** A pitched thump whose pitch falls (or rises) over `slide` seconds. */
function thump(stem, t, vel, { f0, f1, slide, tau, gain, harmonic = 0 }) {
  const [from, to] = stem.span(t, tau * 6);
  let phase = 0;
  for (let i = from; i < to; i++) {
    const x = (i - from) / RATE;
    const f = x < slide ? f0 + (f1 - f0) * (x / slide) : f1;
    phase += f / RATE;
    const env = Math.exp(-x / tau) * Math.min(1, x / 0.0015);
    stem.buf[i] += vel * gain * env * (Math.sin(TAU * phase) + harmonic * Math.sin(TAU * 2 * phase));
  }
}

/** A shaped noise burst, optionally bandpassed and highpassed; `attack` in seconds softens its start. */
function burst(stem, t, vel, rng, { length, tau, gain, bandpass, q = 1.2, highpass, lowpass, attack = 0.0007 }) {
  const [from, to] = stem.span(t, length);
  const n = to - from;
  if (n <= 0) return;
  const s = takeScratch(n);
  const a = Math.max(1, attack * RATE);
  for (let i = 0; i < n; i++) s[i] = (rng.next() * 2 - 1) * Math.exp(-i / (tau * RATE)) * Math.min(1, i / a);
  if (lowpass) onePoleLowpass(s, 0, n, lowpass);
  if (bandpass) biquad(s, 0, n, 'bandpass', bandpass, q);
  if (highpass) biquad(s, 0, n, 'highpass', highpass, 0.8);
  blend(stem, from, to, s, vel * gain);
}

/** Ringing partials (drum heads, cymbals, jingles): `freq` × each partial's ratio. */
function ring(stem, t, vel, freq, partials, gain, rng) {
  const longest = Math.max(...partials.map((p) => p.tau));
  const [from, to] = stem.span(t, longest * 5);
  for (const p of partials) {
    const phase0 = rng.range(0, TAU);
    for (let i = from; i < to; i++) {
      const x = (i - from) / RATE;
      stem.buf[i] += vel * gain * p.amp * Math.exp(-x / p.tau) * Math.min(1, x / 0.001) * Math.sin(TAU * freq * p.ratio * x + phase0);
    }
  }
}

/**
 * Drum strokes. `tabla` is a pair tuned to the track's Sa: the dayan rings on
 * na / tin / tun and is damped on te / ke; the bayan's ghe slides up under the heel.
 * Every sound takes (stem, t, vel, rng, ctx) with ctx = { sa, spb }.
 */
const PERC = {
  // tabla
  ge: (stem, t, vel, rng) => {
    thump(stem, t, vel, { f0: 92, f1: 128, slide: 0.22, tau: 0.3, gain: 0.36, harmonic: 0.18 });
    burst(stem, t, vel, rng, { length: 0.03, tau: 0.008, gain: 0.12, lowpass: 900 });
  },
  ke: (stem, t, vel, rng) => burst(stem, t, vel, rng, { length: 0.04, tau: 0.01, gain: 0.8, lowpass: 1600 }),
  na: (stem, t, vel, rng, ctx) => {
    ring(stem, t, vel, ctx.sa, [{ ratio: 2, amp: 1, tau: 0.3 }, { ratio: 3.02, amp: 0.6, tau: 0.22 }, { ratio: 4.1, amp: 0.45, tau: 0.14 }, { ratio: 5.05, amp: 0.3, tau: 0.1 }, { ratio: 6.1, amp: 0.2, tau: 0.07 }, { ratio: 7.2, amp: 0.12, tau: 0.05 }, { ratio: 8.3, amp: 0.08, tau: 0.04 }], 0.28, rng);
    burst(stem, t, vel, rng, { length: 0.02, tau: 0.004, gain: 0.4, bandpass: 4000, q: 0.9 });
    burst(stem, t, vel, rng, { length: 0.015, tau: 0.003, gain: 0.3, bandpass: 6500, q: 1.2 });
  },
  tin: (stem, t, vel, rng, ctx) => {
    ring(stem, t, vel, ctx.sa, [{ ratio: 1, amp: 0.55, tau: 0.5 }, { ratio: 2, amp: 1, tau: 0.6 }, { ratio: 3.01, amp: 0.5, tau: 0.4 }, { ratio: 4.02, amp: 0.3, tau: 0.25 }, { ratio: 5.03, amp: 0.18, tau: 0.15 }, { ratio: 6.05, amp: 0.1, tau: 0.1 }], 0.26, rng);
    burst(stem, t, vel, rng, { length: 0.015, tau: 0.003, gain: 0.22, bandpass: 5500, q: 1.2 });
  },
  tun: (stem, t, vel, rng, ctx) => ring(stem, t, vel, ctx.sa, [{ ratio: 1, amp: 1, tau: 0.75 }, { ratio: 2.0, amp: 0.4, tau: 0.5 }], 0.36, rng),
  te: (stem, t, vel, rng, ctx) => {
    burst(stem, t, vel, rng, { length: 0.03, tau: 0.006, gain: 0.4, bandpass: 3400, q: 0.9 });
    burst(stem, t, vel, rng, { length: 0.02, tau: 0.004, gain: 0.16, highpass: 6000 });
    ring(stem, t, vel, ctx.sa, [{ ratio: 2, amp: 0.5, tau: 0.035 }], 0.2, rng);
  },
  // dhol: the dagga (bass head) booms and the tilli (treble) cracks
  dholBass: (stem, t, vel, rng) => {
    thump(stem, t, vel, { f0: 96, f1: 60, slide: 0.15, tau: 0.26, gain: 0.36, harmonic: 0.3 });
    burst(stem, t, vel, rng, { length: 0.025, tau: 0.007, gain: 0.15, lowpass: 1500 });
  },
  dholTreble: (stem, t, vel, rng) => {
    burst(stem, t, vel, rng, { length: 0.05, tau: 0.011, gain: 0.7, bandpass: 2000, q: 1.1 });
    burst(stem, t, vel, rng, { length: 0.03, tau: 0.006, gain: 0.25, highpass: 5000 });
    ring(stem, t, vel, 560, [{ ratio: 1, amp: 1, tau: 0.045 }, { ratio: 1.6, amp: 0.4, tau: 0.03 }], 0.28, rng);
  },
  // daf: a frame drum with jingles inside the rim
  dum: (stem, t, vel, rng) => {
    thump(stem, t, vel, { f0: 118, f1: 84, slide: 0.12, tau: 0.22, gain: 0.42, harmonic: 0.1 });
    burst(stem, t, vel, rng, { length: 0.12, tau: 0.035, gain: 0.1, highpass: 5000 });
  },
  tak: (stem, t, vel, rng) => {
    burst(stem, t, vel, rng, { length: 0.035, tau: 0.007, gain: 0.62, bandpass: 2600, q: 1.5 });
    burst(stem, t, vel, rng, { length: 0.1, tau: 0.03, gain: 0.18, highpass: 5500 });
  },
  // tasha: a crisp kettle drum
  tasha: (stem, t, vel, rng) => {
    burst(stem, t, vel, rng, { length: 0.07, tau: 0.016, gain: 0.5, bandpass: 1250, q: 0.8 });
    burst(stem, t, vel, rng, { length: 0.04, tau: 0.01, gain: 0.28, highpass: 3500 });
    ring(stem, t, vel, 880, [{ ratio: 1, amp: 1, tau: 0.04 }], 0.2, rng);
  },
  /** Hand claps: a few hands never land together; a short early-reflection tail is part of the sound. */
  clap: (stem, t, vel, rng) => {
    const offsets = [0, 0.009, 0.019, 0.031];
    for (const o of offsets) {
      const jitter = rng.gauss() * 0.0015;
      burst(stem, t + o + Math.abs(jitter), vel * (o === 0 ? 1 : 0.7), rng, { length: 0.03, tau: 0.006, gain: 1.1, bandpass: 1500, q: 0.9, highpass: 700 });
    }
    const taps = [0.026, 0.041, 0.057, 0.078, 0.102, 0.131];
    taps.forEach((d, k) => burst(stem, t + d, vel * 0.5 * Math.pow(0.72, k), rng, { length: 0.04, tau: 0.012, gain: 0.6, bandpass: 1300, q: 0.8, lowpass: 4000 }));
  },
  // manjira: two small bronze cymbals, struck open (ting) or pressed together (chik)
  ting: (stem, t, vel, rng) => {
    ring(stem, t, vel, 1, [
      { ratio: 2310, amp: 1, tau: 0.85 },
      { ratio: 2323, amp: 0.8, tau: 0.8 },
      { ratio: 3450, amp: 0.6, tau: 0.6 },
      { ratio: 4980, amp: 0.45, tau: 0.45 },
      { ratio: 6640, amp: 0.3, tau: 0.32 },
      { ratio: 8420, amp: 0.18, tau: 0.22 },
    ], 0.07, rng);
    burst(stem, t, vel, rng, { length: 0.015, tau: 0.003, gain: 0.3, highpass: 4500 });
  },
  chik: (stem, t, vel, rng) => {
    burst(stem, t, vel, rng, { length: 0.07, tau: 0.02, gain: 0.32, highpass: 5000 });
    ring(stem, t, vel, 1, [{ ratio: 3450, amp: 1, tau: 0.03 }, { ratio: 4980, amp: 0.6, tau: 0.025 }], 0.06, rng);
  },
  // chimta: fire tongs with jingles; jing shakes the jingles, clack strikes the arms
  jing: (stem, t, vel, rng) => {
    for (let k = 0; k < 4; k++) burst(stem, t + k * 0.009 + Math.abs(rng.gauss()) * 0.002, vel * Math.pow(0.68, k), rng, { length: 0.05, tau: 0.012, gain: 0.32, highpass: 4500 });
    ring(stem, t, vel, 1, [{ ratio: 5900, amp: 1, tau: 0.09 }, { ratio: 7450, amp: 0.7, tau: 0.07 }, { ratio: 9300, amp: 0.45, tau: 0.05 }], 0.06, rng);
  },
  clack: (stem, t, vel, rng) => burst(stem, t, vel, rng, { length: 0.03, tau: 0.006, gain: 1.0, bandpass: 2000, q: 1.6 }),
  // shaker and ghungroo (ankle bells)
  shake: (stem, t, vel, rng) => burst(stem, t, vel, rng, { length: 0.1, tau: 0.035, gain: 0.3, highpass: 5200, attack: 0.012 }),
  ghungroo: (stem, t, vel, rng) => {
    for (let k = 0; k < 6; k++) {
      const dt = Math.abs(rng.gauss()) * 0.012;
      ring(stem, t + dt, vel * rng.range(0.4, 1), 1, [{ ratio: rng.range(4200, 8800), amp: 1, tau: rng.range(0.05, 0.12) }], 0.05, rng);
    }
    burst(stem, t, vel, rng, { length: 0.06, tau: 0.02, gain: 0.18, highpass: 6000 });
  },
  // tambourine: the jingles and a little skin
  tamb: (stem, t, vel, rng) => {
    for (let k = 0; k < 3; k++) burst(stem, t + k * 0.007, vel * Math.pow(0.7, k), rng, { length: 0.08, tau: 0.025, gain: 0.3, highpass: 5000 });
    ring(stem, t, vel, 1, [{ ratio: 6800, amp: 1, tau: 0.12 }, { ratio: 8100, amp: 0.7, tau: 0.1 }, { ratio: 4700, amp: 0.4, tau: 0.08 }], 0.05, rng);
    burst(stem, t, vel, rng, { length: 0.03, tau: 0.008, gain: 0.15, bandpass: 900, q: 1 });
  },
  // a suspended cymbal: a crash, or a mallet roll that swells for two beats into the next downbeat
  crash: (stem, t, vel, rng) => {
    burst(stem, t, vel, rng, { length: 2.4, tau: 0.8, gain: 0.2, highpass: 3500 });
    ring(stem, t, vel, 1, [{ ratio: 3120, amp: 0.6, tau: 1.2 }, { ratio: 4470, amp: 0.5, tau: 1.0 }, { ratio: 5890, amp: 0.4, tau: 0.8 }, { ratio: 7730, amp: 0.3, tau: 0.6 }], 0.025, rng);
  },
  swell: (stem, t, vel, rng, ctx) => {
    const rise = 2 * ctx.spb;
    const [from, to] = stem.span(t, rise + 1.2);
    const n = to - from;
    if (n <= 0) return;
    const s = takeScratch(n);
    for (let i = 0; i < n; i++) {
      const x = i / RATE;
      const env = x < rise ? Math.pow(x / rise, 2.2) : Math.exp(-(x - rise) / 0.35);
      s[i] = (rng.next() * 2 - 1) * env;
    }
    biquad(s, 0, n, 'highpass', 3000, 0.7);
    biquad(s, 0, n, 'peak', 6000, 0.8, { gainDb: 4 });
    blend(stem, from, to, s, vel * 0.2);
  },
  // a soft modern kit
  kick: (stem, t, vel, rng) => {
    thump(stem, t, vel, { f0: 120, f1: 48, slide: 0.06, tau: 0.16, gain: 0.55 });
    burst(stem, t, vel, rng, { length: 0.01, tau: 0.002, gain: 0.12, lowpass: 3000 });
  },
  rim: (stem, t, vel, rng) => {
    burst(stem, t, vel, rng, { length: 0.04, tau: 0.008, gain: 0.7, bandpass: 1700, q: 2 });
    ring(stem, t, vel, 1, [{ ratio: 1700, amp: 1, tau: 0.03 }, { ratio: 2950, amp: 0.4, tau: 0.02 }], 0.12, rng);
  },
  hat: (stem, t, vel, rng) => burst(stem, t, vel, rng, { length: 0.05, tau: 0.012, gain: 0.25, highpass: 7000 }),
};

// ───────────────────────────── Mix-down and effects ─────────────────────────────

/**
 * Freeverb (Schroeder): eight parallel feedback combs with damping into four
 * series allpasses per channel, the right channel's delays spread by 23 samples,
 * a pre-delay before the tank and a width control on the wet pair.
 */
function freeverb(inL, inR, outL, outR, { room = 0.84, damp = 0.25, wet = 0.3, preDelay = 0.02, width = 1 }) {
  const n = inL.length;
  const combTunings = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
  const allpassTunings = [556, 441, 341, 225];
  const spread = 23;
  const pre = Math.round(preDelay * RATE);
  const makeChannel = (offset) => ({
    combs: combTunings.map((len) => ({ buf: new Float32Array(len + offset), i: 0, store: 0 })),
    allpasses: allpassTunings.map((len) => ({ buf: new Float32Array(len + offset), i: 0 })),
  });
  const channels = [makeChannel(0), makeChannel(spread)];
  const feedback = clamp(room, 0.5, 0.98);
  const damp1 = clamp(damp, 0, 0.95);
  const damp2 = 1 - damp1;
  const wetL = new Float32Array(n);
  const wetR = new Float32Array(n);
  const outs = [wetL, wetR];
  for (let c = 0; c < 2; c++) {
    const ch = channels[c];
    const out = outs[c];
    for (let s = 0; s < n; s++) {
      const src = s - pre;
      const input = src >= 0 ? (inL[src] + inR[src]) * 0.5 : 0;
      let acc = 0;
      for (const comb of ch.combs) {
        const y = comb.buf[comb.i];
        comb.store = y * damp2 + comb.store * damp1;
        comb.buf[comb.i] = input + comb.store * feedback;
        comb.i = comb.i + 1 === comb.buf.length ? 0 : comb.i + 1;
        acc += y;
      }
      for (const ap of ch.allpasses) {
        const b = ap.buf[ap.i];
        const y = -acc + b;
        ap.buf[ap.i] = acc + b * 0.5;
        ap.i = ap.i + 1 === ap.buf.length ? 0 : ap.i + 1;
        acc = y;
      }
      out[s] = acc;
    }
  }
  const wet1 = wet * (width / 2 + 0.5) * 0.06;
  const wet2 = wet * ((1 - width) / 2) * 0.06;
  for (let s = 0; s < n; s++) {
    outL[s] += wetL[s] * wet1 + wetR[s] * wet2;
    outR[s] += wetR[s] * wet1 + wetL[s] * wet2;
  }
}

/** Filters, pans and widens every stem into the stereo bus and the reverb send, then adds the reverb. */
function mixdown(stems, n, reverbCfg) {
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const sendL = new Float32Array(n);
  const sendR = new Float32Array(n);
  for (const stem of stems) {
    if (stem.lowCut) biquad(stem.buf, 0, n, 'highpass', stem.lowCut, 0.7);
    if (stem.highCut) biquad(stem.buf, 0, n, 'lowpass', stem.highCut, 0.7);
    for (const [type, freq, q, gainDb] of stem.eq) biquad(stem.buf, 0, n, type, freq, q, { gainDb });
    const angle = ((stem.pan + 1) * Math.PI) / 4;
    const gl = Math.cos(angle) * stem.gain;
    const gr = Math.sin(angle) * stem.gain;
    const dl = stem.width < 0 ? -stem.width : 0;
    const dr = stem.width > 0 ? stem.width : 0;
    const buf = stem.buf;
    for (let i = 0; i < n; i++) {
      const vl = (i >= dl ? buf[i - dl] : 0) * gl;
      const vr = (i >= dr ? buf[i - dr] : 0) * gr;
      L[i] += vl;
      R[i] += vr;
      sendL[i] += vl * stem.send;
      sendR[i] += vr * stem.send;
    }
  }
  // the room hears the send without its lows (no mud) and without its harshest highs
  for (const send of [sendL, sendR]) {
    biquad(send, 0, n, 'highpass', reverbCfg.lowCut ?? 200, 0.7);
    biquad(send, 0, n, 'lowpass', reverbCfg.highCut ?? 11000, 0.7);
  }
  freeverb(sendL, sendR, L, R, reverbCfg);
  return { L, R };
}

/**
 * One loop: everything that rings past the end of the file (the last chord, the
 * reverb) is added back onto its start, as it would sound the second time round.
 */
function foldLoop(L, R, period) {
  const outL = L.slice(0, period);
  const outR = R.slice(0, period);
  for (let i = period; i < L.length; i++) {
    const j = i % period;
    outL[j] += L[i];
    outR[j] += R[i];
  }
  return { L: outL, R: outR };
}

// ───────────────────────────── Loudness, true peak and the limiter ─────────────────────────────

/** BS.1770-4 K-weighting for any rate (after libebur128): the head's high shelf, then the RLB highpass. */
function kWeighting() {
  let f0 = 1681.974450955533;
  const G = 3.999843853973347;
  let Q = 0.7071752369554196;
  let K = Math.tan((Math.PI * f0) / RATE);
  const Vh = Math.pow(10, G / 20);
  const Vb = Math.pow(Vh, 0.4996667741545416);
  let a0 = 1 + K / Q + K * K;
  const shelf = { b0: (Vh + (Vb * K) / Q + K * K) / a0, b1: (2 * (K * K - Vh)) / a0, b2: (Vh - (Vb * K) / Q + K * K) / a0, a1: (2 * (K * K - 1)) / a0, a2: (1 - K / Q + K * K) / a0 };
  f0 = 38.13547087602444;
  Q = 0.5003270373238773;
  K = Math.tan((Math.PI * f0) / RATE);
  a0 = 1 + K / Q + K * K;
  const highpass = { b0: 1, b1: -2, b2: 1, a1: (2 * (K * K - 1)) / a0, a2: (1 - K / Q + K * K) / a0 };
  return [shelf, highpass];
}
const K_WEIGHTING = kWeighting();

/**
 * Integrated loudness (LUFS) and loudness range (LU), BS.1770-4 / EBU Tech 3342:
 * K-weighted mean square in 400 ms blocks every 100 ms, gated at -70 LUFS and
 * 10 LU under the ungated mean; the range from 3 s blocks gated 20 LU under.
 */
function loudness(L, R) {
  const n = L.length;
  const sums = new Float64Array(n + 1);
  const weighted = [L, R].map((ch) => {
    const y = Float32Array.from(ch);
    for (const c of K_WEIGHTING) runBiquad(y, 0, n, c);
    return y;
  });
  for (let i = 0; i < n; i++) sums[i + 1] = sums[i] + weighted[0][i] * weighted[0][i] + weighted[1][i] * weighted[1][i];
  const lk = (z) => (z > 0 ? -0.691 + 10 * Math.log10(z) : -Infinity);
  const gated = (len, relative) => {
    const blocks = [];
    for (let s = 0; s + len <= n; s += Math.round(0.1 * RATE)) blocks.push((sums[s + len] - sums[s]) / len);
    const above = blocks.filter((z) => lk(z) > -70);
    if (!above.length) return [];
    const gate = lk(above.reduce((a, z) => a + z, 0) / above.length) + relative;
    return above.filter((z) => lk(z) > gate);
  };
  const blocks = gated(Math.round(0.4 * RATE), -10);
  const integrated = blocks.length ? lk(blocks.reduce((a, z) => a + z, 0) / blocks.length) : -Infinity;
  const short = gated(3 * RATE, -20).map(lk).sort((a, b) => a - b);
  const pct = (p) => short[Math.min(short.length - 1, Math.max(0, Math.round(p * (short.length - 1))))];
  return { integrated, range: short.length ? pct(0.95) - pct(0.1) : 0 };
}

/** 4x interpolation filters (Hann-windowed sinc, 24 taps per phase) for the true-peak meter and the limiter. */
const TP_TAPS = 24;
const TP_PHASES = [0.25, 0.5, 0.75].map((frac) => {
  const h = new Float64Array(TP_TAPS);
  let sum = 0;
  for (let k = 0; k < TP_TAPS; k++) {
    const x = k - TP_TAPS / 2 + 1 - frac;
    const sinc = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
    const win = 0.5 + 0.5 * Math.cos((Math.PI * x) / (TP_TAPS / 2));
    h[k] = sinc * win;
    sum += h[k];
  }
  for (let k = 0; k < TP_TAPS; k++) h[k] /= sum;
  return h;
});

/** The interpolated value of `ch` a fraction of a sample after `i`. */
function interpolate(ch, i, h) {
  const n = ch.length;
  const base = i - TP_TAPS / 2 + 1;
  let v = 0;
  if (base >= 0 && base + TP_TAPS <= n) for (let k = 0; k < TP_TAPS; k++) v += ch[base + k] * h[k];
  else
    for (let k = 0; k < TP_TAPS; k++) {
      const idx = base + k;
      if (idx >= 0 && idx < n) v += ch[idx] * h[k];
    }
  return v;
}

/**
 * The peak magnitude at every sample and between it and the next (4x oversampled),
 * maxed into `out`. Between samples it only looks where a neighbour is within 6 dB
 * of `floor`: an inter-sample peak far above both neighbours does not occur in music.
 */
function samplePeaks(ch, out, floor) {
  const n = ch.length;
  const near = floor * 0.5;
  for (let i = 0; i < n; i++) {
    const a = Math.abs(ch[i]);
    let m = a;
    if (a > near || (i + 1 < n && Math.abs(ch[i + 1]) > near)) {
      for (const h of TP_PHASES) {
        const v = Math.abs(interpolate(ch, i, h));
        if (v > m) m = v;
      }
    }
    if (m > out[i]) out[i] = m;
  }
}

/** True peak (linear) of a stereo pair: the largest sample or 4x interpolated value. */
function truePeak(L, R) {
  let peak = 0;
  for (const ch of [L, R]) for (let i = 0; i < ch.length; i++) peak = Math.max(peak, Math.abs(ch[i]));
  const tp = new Float32Array(L.length);
  samplePeaks(L, tp, peak * 0.7);
  samplePeaks(R, tp, peak * 0.7);
  for (let i = 0; i < tp.length; i++) if (tp[i] > peak) peak = tp[i];
  return peak;
}

/**
 * Look-ahead limiter on the true peak, one gain for both channels (the image never
 * shifts): a soft knee below the ceiling, the gain falls over the 3 ms before a peak
 * (a sliding minimum, then a moving average that ends on the peak, so the peak itself
 * is always under the ceiling) and recovers with `release`.
 */
function limiter(L, R, ceiling, { knee = 0.8, lookahead = 0.003, release = 0.12 } = {}) {
  const n = L.length;
  const la = Math.max(1, Math.round(lookahead * RATE));
  const kneeStart = ceiling * knee;
  const peak = new Float32Array(n);
  samplePeaks(L, peak, kneeStart);
  samplePeaks(R, peak, kneeStart);
  const target = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = peak[i];
    target[i] = p > kneeStart ? (kneeStart + (p - kneeStart) / (1 + (p - kneeStart) / (ceiling - kneeStart))) / p : 1;
  }
  // sliding minimum over [i, i + la] (a monotonic deque)
  const min = new Float32Array(n);
  const deque = new Int32Array(n);
  let head = 0, tail = 0;
  for (let i = n - 1; i >= 0; i--) {
    while (tail > head && target[deque[tail - 1]] >= target[i]) tail--;
    deque[tail++] = i;
    while (deque[head] > i + la) head++;
    min[i] = target[deque[head]];
  }
  // release: fall at once, rise slowly
  const rel = Math.exp(-1 / (release * RATE));
  let r = 1;
  for (let i = 0; i < n; i++) {
    r = min[i] < r ? min[i] : min[i] + (r - min[i]) * rel;
    min[i] = r;
  }
  // a moving average over the la + 1 samples ending at i
  let reduction = 0;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += min[i];
    if (i > la) acc -= min[i - la - 1];
    const g = i >= la ? acc / (la + 1) : (acc + (la - i)) / (la + 1);
    L[i] *= g;
    R[i] *= g;
    if (1 - g > reduction) reduction = 1 - g;
  }
  return reduction;
}

/** Raised-sine fades at both ends of the loop (fractions of a second: they only keep the seam from clicking). */
function fades(L, R, fadeIn, fadeOut) {
  const n = L.length;
  const fi = Math.round(fadeIn * RATE);
  const fo = Math.round(fadeOut * RATE);
  for (let i = 0; i < fi && i < n; i++) {
    const x = Math.sin((Math.PI / 2) * (i / fi));
    L[i] *= x * x;
    R[i] *= x * x;
  }
  for (let i = 0; i < fo && i < n; i++) {
    const x = Math.sin((Math.PI / 2) * (i / fo));
    L[n - 1 - i] *= x * x;
    R[n - 1 - i] *= x * x;
  }
}

export const MASTER = { target: -16, air: 1.5, presence: -11, maxPresence: 6, fadeIn: 0.12, fadeOut: 0.3 };

/** Long-term spectral balance: the power below 250 Hz, from 250 Hz to 2 kHz and above, as fractions of the whole. */
function bandBalance(L, R) {
  const avg = new Float64Array(FFT_SIZE / 2);
  for (let c = FFT_SIZE / 2; c < L.length - FFT_SIZE / 2; c += RATE / 2) {
    const p = spectrumAt(L, R, c);
    for (let i = 0; i < p.length; i++) avg[i] += p[i];
  }
  let total = 0, low = 0, mid = 0, high = 0;
  for (let i = 1; i < avg.length; i++) {
    const f = (i * RATE) / FFT_SIZE;
    total += avg[i];
    if (f < 250) low += avg[i];
    else if (f < 2000) mid += avg[i];
    else high += avg[i];
  }
  return { avg, total, low: low / (total || 1), mid: mid / (total || 1), high: high / (total || 1) };
}

/**
 * The master: a subsonic highpass, a presence shelf that lifts a dark mix's upper
 * band toward `presence` dB under its mids (never more than `maxPresence` dB, never
 * a cut), a gentle air shelf, the loop's short fades, gain to the loudness target and
 * the true-peak limiter at `ceiling` (dBTP), repeated until the integrated loudness
 * lands within 0.1 LU of the target. Returns new buffers, so a track can be mastered
 * again at a lower ceiling.
 */
function master(L, R, ceilingDb, { target = MASTER.target, air = MASTER.air, presence = MASTER.presence, fadeIn = MASTER.fadeIn, fadeOut = MASTER.fadeOut } = {}) {
  const n = L.length;
  const l = Float32Array.from(L);
  const r = Float32Array.from(R);
  const balance = bandBalance(L, R);
  const tilt = clamp(presence - 10 * Math.log10(Math.max(balance.high, 1e-9) / Math.max(balance.mid, 1e-9)), 0, MASTER.maxPresence);
  for (const ch of [l, r]) {
    biquad(ch, 0, n, 'highpass', 30, 0.7);
    if (tilt > 0.05) biquad(ch, 0, n, 'highshelf', 3000, 0.6, { gainDb: tilt });
    if (air) biquad(ch, 0, n, 'highshelf', 8000, 0.7, { gainDb: air });
  }
  fades(l, r, fadeIn, fadeOut);
  const ceiling = fromDb(ceilingDb);
  let gain = fromDb(target - loudness(l, r).integrated);
  let out = null;
  for (let pass = 0; pass < 5; pass++) {
    const a = l.map((v) => v * gain);
    const b = r.map((v) => v * gain);
    const reduction = limiter(a, b, ceiling);
    // the gain's smoothing can leave a peak a hair over the ceiling: trim it
    const tp = truePeak(a, b);
    if (tp > ceiling) {
      const trim = ceiling / tp;
      for (let i = 0; i < n; i++) {
        a[i] *= trim;
        b[i] *= trim;
      }
    }
    const measured = loudness(a, b);
    out = { L: a, R: b, loudness: measured.integrated, range: measured.range, reduction, gainDb: dB(gain), tilt };
    if (Math.abs(measured.integrated - target) < 0.1) break;
    gain *= fromDb(target - measured.integrated);
  }
  return out;
}

// ───────────────────────────── Analysis ─────────────────────────────

/** In-place radix-2 complex FFT. */
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -TAU / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const ur = re[i + j], ui = im[i + j];
        const vr = re[i + j + len / 2] * cr - im[i + j + len / 2] * ci;
        const vi = re[i + j + len / 2] * ci + im[i + j + len / 2] * cr;
        re[i + j] = ur + vr;
        im[i + j] = ui + vi;
        re[i + j + len / 2] = ur - vr;
        im[i + j + len / 2] = ui - vi;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
}

const FFT_SIZE = 4096;
const HANN = new Float32Array(FFT_SIZE).map((_, i) => 0.5 - 0.5 * Math.cos((TAU * i) / FFT_SIZE));

/** Power spectrum (FFT_SIZE/2 bins) of the mono mix around sample `centre`. */
function spectrumAt(L, R, centre) {
  const re = new Float32Array(FFT_SIZE);
  const im = new Float32Array(FFT_SIZE);
  const start = centre - FFT_SIZE / 2;
  for (let i = 0; i < FFT_SIZE; i++) {
    const idx = start + i;
    re[i] = idx >= 0 && idx < L.length ? (L[idx] + R[idx]) * 0.5 * HANN[i] : 0;
  }
  fft(re, im);
  const power = new Float32Array(FFT_SIZE / 2);
  for (let i = 0; i < FFT_SIZE / 2; i++) power[i] = re[i] * re[i] + im[i] * im[i];
  return power;
}

function rmsOf(L, R, from, to) {
  let e = 0;
  for (let i = from; i < to; i++) e += L[i] * L[i] + R[i] * R[i];
  return Math.sqrt(e / Math.max(1, 2 * (to - from)));
}

/** Peak, RMS, the quietest second, the loop seam and the spectral balance of a master. */
function analyse(L, R) {
  const n = L.length;
  let peak = 0, clipped = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.abs(L[i]), b = Math.abs(R[i]);
    if (a > peak) peak = a;
    if (b > peak) peak = b;
    if (a >= 0.999 || b >= 0.999) clipped++;
  }
  const rms = rmsOf(L, R, 0, n);
  // the quietest second (dead air shows up here); the loop has no silent ends to skip
  let quietest = Infinity, quietestAt = 0;
  for (let s = 0; (s + 1) * RATE <= n; s++) {
    const r = rmsOf(L, R, s * RATE, (s + 1) * RATE);
    if (r < quietest) {
      quietest = r;
      quietestAt = s;
    }
  }
  // the seam: the last and first second against the whole
  const lastSecond = dB(rmsOf(L, R, n - RATE, n) / rms);
  const firstSecond = dB(rmsOf(L, R, 0, RATE) / rms);
  // the average spectrum, every half second
  const { avg, total, low, mid, high } = bandBalance(L, R);
  const binHz = RATE / FFT_SIZE;
  let weighted = 0;
  for (let i = 1; i < avg.length; i++) weighted += avg[i] * i * binHz;
  let acc = 0, rolloff = 0;
  for (let i = 1; i < avg.length; i++) {
    acc += avg[i];
    if (acc >= 0.85 * total) {
      rolloff = i * binHz;
      break;
    }
  }
  return {
    peakDb: dB(peak),
    rmsDb: dB(rms),
    clipped,
    quietestDb: dB(quietest / rms),
    quietestAt,
    lastSecond,
    firstSecond,
    centroid: total ? weighted / total : 0,
    bands: { low, mid, high },
    rolloff,
  };
}

// ───────────────────────────── PNG (spectrogram + waveform) ─────────────────────────────

const CRC_TABLE = new Uint32Array(256).map((_, k) => {
  let c = k;
  for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
/** An 8-bit RGB PNG from a width×height×3 byte array. */
function encodePng(width, height, rgb) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    raw.set(rgb.subarray(y * width * 3, (y + 1) * width * 3), y * (width * 3 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const HEAT = [
  [0, [10, 8, 28]],
  [0.25, [58, 20, 112]],
  [0.5, [184, 48, 82]],
  [0.75, [246, 150, 38]],
  [1, [255, 246, 205]],
];
function heat(x) {
  const v = clamp(x, 0, 1);
  for (let i = 1; i < HEAT.length; i++) {
    if (v <= HEAT[i][0]) {
      const [t0, c0] = HEAT[i - 1];
      const [t1, c1] = HEAT[i];
      const f = (v - t0) / (t1 - t0);
      return c0.map((a, k) => Math.round(a + (c1[k] - a) * f));
    }
  }
  return HEAT[HEAT.length - 1][1];
}

/** Spectrogram (log frequency 40 Hz – 12 kHz) above a waveform, with a tick every 10 s. */
function picture(L, R) {
  const W = 1200, HS = 300, GAP = 4, HW = 120;
  const H = HS + GAP + HW;
  const rgb = new Uint8Array(W * H * 3);
  const put = (x, y, c) => {
    const o = (y * W + x) * 3;
    rgb[o] = c[0];
    rgb[o + 1] = c[1];
    rgb[o + 2] = c[2];
  };
  const n = L.length;
  const fMin = 40, fMax = 12000;
  const binHz = RATE / FFT_SIZE;
  const columns = [];
  let maxPower = 1e-12;
  for (let x = 0; x < W; x++) {
    const p = spectrumAt(L, R, Math.floor(((x + 0.5) / W) * n));
    for (let i = 1; i < p.length; i++) if (p[i] > maxPower) maxPower = p[i];
    columns.push(p);
  }
  for (let x = 0; x < W; x++) {
    const p = columns[x];
    for (let y = 0; y < HS; y++) {
      const fHi = fMin * Math.pow(fMax / fMin, 1 - y / HS);
      const fLo = fMin * Math.pow(fMax / fMin, 1 - (y + 1) / HS);
      const bLo = fLo / binHz, bHi = fHi / binHz;
      let v;
      if (bHi - bLo < 1) {
        const i = Math.floor(bLo);
        const f = bLo - i;
        v = p[i] + (p[Math.min(i + 1, p.length - 1)] - p[i]) * f;
      } else {
        v = 0;
        for (let i = Math.floor(bLo); i <= Math.min(Math.ceil(bHi), p.length - 1); i++) if (p[i] > v) v = p[i];
      }
      const db = 10 * Math.log10(v / maxPower + 1e-12);
      put(x, y, heat((db + 72) / 72));
    }
  }
  for (let y = HS; y < HS + GAP; y++) for (let x = 0; x < W; x++) put(x, y, [30, 30, 40]);
  const base = [18, 20, 32];
  for (let y = HS + GAP; y < H; y++) for (let x = 0; x < W; x++) put(x, y, base);
  const mid = HS + GAP + HW / 2;
  for (let x = 0; x < W; x++) {
    const from = Math.floor((x / W) * n), to = Math.floor(((x + 1) / W) * n);
    let lo = 0, hi = 0, e = 0;
    for (let i = from; i < to; i++) {
      const v = (L[i] + R[i]) * 0.5;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
      e += v * v;
    }
    const rms = Math.sqrt(e / Math.max(1, to - from));
    for (let y = Math.round(mid - hi * (HW / 2)); y <= Math.round(mid - lo * (HW / 2)); y++) if (y >= HS + GAP && y < H) put(x, y, [92, 110, 170]);
    for (let y = Math.round(mid - rms * (HW / 2)); y <= Math.round(mid + rms * (HW / 2)); y++) if (y >= HS + GAP && y < H) put(x, y, [200, 215, 255]);
  }
  for (let s = 10; s < n / RATE; s += 10) {
    const x = Math.round((s * RATE * W) / n);
    for (let y = 0; y < H; y += 2) {
      const o = (y * W + x) * 3;
      rgb[o] = Math.min(255, rgb[o] + 70);
      rgb[o + 1] = Math.min(255, rgb[o + 1] + 70);
      rgb[o + 2] = Math.min(255, rgb[o + 2] + 70);
    }
  }
  return encodePng(W, H, rgb);
}

// ───────────────────────────── PCM, WAV and AAC ─────────────────────────────

/** Interleaved 32-bit float PCM: what the encoder reads, so nothing is rounded to 16 bits first. */
function encodeF32(L, R) {
  const n = L.length;
  const out = Buffer.alloc(n * 8);
  for (let i = 0, o = 0; i < n; i++, o += 8) {
    out.writeFloatLE(L[i], o);
    out.writeFloatLE(R[i], o + 4);
  }
  return out;
}

/** A 16-bit WAV, for listening (--wav). */
function encodeWav(L, R) {
  const n = L.length;
  const wav = Buffer.alloc(44 + n * 4);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + n * 4, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(2, 22);
  wav.writeUInt32LE(RATE, 24);
  wav.writeUInt32LE(RATE * 4, 28);
  wav.writeUInt16LE(4, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(n * 4, 40);
  for (let i = 0, o = 44; i < n; i++, o += 4) {
    wav.writeInt16LE(Math.round(clamp(L[i], -1, 1) * 32767), o);
    wav.writeInt16LE(Math.round(clamp(R[i], -1, 1) * 32767), o + 2);
  }
  return wav;
}

/** A stereo PCM WAV (16 or 24 bit) → two float channels. */
function readWav(file) {
  const buf = readFileSync(file);
  let pos = 12, channels = 2, bits = 16, data = null;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('latin1', pos, pos + 4);
    let size = buf.readUInt32LE(pos + 4);
    if (id === 'fmt ') {
      channels = buf.readUInt16LE(pos + 10);
      bits = buf.readUInt16LE(pos + 22);
    }
    if (id === 'data') {
      if (pos + 8 + size > buf.length) size = buf.length - pos - 8;
      data = buf.subarray(pos + 8, pos + 8 + size);
      break;
    }
    pos += 8 + size + (size & 1);
  }
  if (!data || channels !== 2 || (bits !== 16 && bits !== 24)) throw new Error(`${file}: not a 16 or 24 bit stereo WAV`);
  const bytes = bits / 8;
  const frames = Math.floor(data.length / (bytes * 2));
  const L = new Float32Array(frames);
  const R = new Float32Array(frames);
  const scale = bits === 24 ? 8388608 : 32768;
  for (let f = 0, o = 0; f < frames; f++, o += bytes * 2) {
    L[f] = data.readIntLE(o, bytes) / scale;
    R[f] = data.readIntLE(o + bytes, bytes) / scale;
  }
  return { L, R };
}

/**
 * The FFmpeg (and ffprobe) that ships with Remotion's compositor for this platform
 * and architecture (a compositor for another platform may be installed too).
 */
function findFfmpeg(tool = 'ffmpeg') {
  if (process.env.FFMPEG_PATH) {
    if (tool === 'ffmpeg') return process.env.FFMPEG_PATH;
    const dir = path.dirname(process.env.FFMPEG_PATH);
    for (const exe of [`${tool}.exe`, tool]) if (existsSync(path.join(dir, exe))) return path.join(dir, exe);
  }
  const root = path.join(ROOT, 'node_modules/.pnpm');
  const prefix = `@remotion+compositor-${process.platform}-${process.arch}`;
  const dirs = readdirSync(root)
    .filter((d) => d.startsWith(prefix))
    .sort();
  for (const dir of dirs) {
    const pkg = path.join(root, dir, 'node_modules', '@remotion', dir.replace('@remotion+', '').replace(/@[^@]+$/, ''));
    for (const exe of [`${tool}.exe`, tool]) if (existsSync(path.join(pkg, exe))) return path.join(pkg, exe);
  }
  throw new Error(`${tool} not found: no Remotion compositor for ${process.platform}-${process.arch}; install the dependencies or set FFMPEG_PATH`);
}

let aacEncoder = null;
function pickAacEncoder(ffmpeg) {
  if (aacEncoder) return aacEncoder;
  const list = spawnSync(ffmpeg, ['-hide_banner', '-encoders'], { encoding: 'utf8' }).stdout ?? '';
  aacEncoder = /\blibfdk_aac\b/.test(list) ? 'libfdk_aac' : 'aac';
  return aacEncoder;
}

const BITRATE = '128k';

/** 32-bit float PCM → AAC-LC in MP4 (no metadata, bit-exact: the same input gives the same file). */
function encodeAac(pcmPath, outPath) {
  const ffmpeg = findFfmpeg('ffmpeg');
  const encoder = pickAacEncoder(ffmpeg);
  const ff = spawnSync(
    ffmpeg,
    ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'f32le', '-ar', String(RATE), '-ac', '2', '-i', pcmPath, '-map_metadata', '-1', '-fflags', '+bitexact', '-c:a', encoder, '-b:a', BITRATE, '-ar', String(RATE), '-ac', '2', '-movflags', '+faststart', '-f', 'mp4', outPath],
    { stdio: 'inherit' },
  );
  if (ff.status !== 0) throw new Error(`ffmpeg failed for ${outPath}`);
  return encoder;
}

/** The AAC file decoded again (FFmpeg's decoder, as browsers built on it play it). */
function decodeAac(m4aPath, wavPath) {
  const ff = spawnSync(findFfmpeg('ffmpeg'), ['-hide_banner', '-loglevel', 'error', '-y', '-i', m4aPath, '-c:a', 'pcm_s24le', '-f', 'wav', wavPath], { stdio: 'inherit' });
  if (ff.status !== 0) throw new Error(`ffmpeg could not decode ${m4aPath}`);
  const pcm = readWav(wavPath);
  rmSync(wavPath);
  return pcm;
}

/** An independent check: FFmpeg's own loudness meter (loudnorm's first pass) on the file. */
function ffmpegLoudness(file) {
  const ff = spawnSync(findFfmpeg('ffmpeg'), ['-hide_banner', '-nostats', '-i', file, '-af', 'loudnorm=print_format=json', '-f', 'null', '-'], { encoding: 'utf8' });
  const json = /\{[^{}]*"input_i"[^{}]*\}/.exec(ff.stderr ?? '');
  if (!json) return null;
  const j = JSON.parse(json[0]);
  return { integrated: Number(j.input_i), truePeak: Number(j.input_tp), range: Number(j.input_lra) };
}

function probeDuration(file) {
  const probe = spawnSync(findFfmpeg('ffprobe'), ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  const seconds = Number.parseFloat(probe.stdout);
  return Number.isFinite(seconds) ? seconds : null;
}

// ───────────────────────────── Composition engine ─────────────────────────────

/** Instruments a part can name, with the register (octaves above the tonic) they default to. */
const INSTRUMENTS = {
  tanpura: { play: tanpura, octave: 0 },
  shehnai: { play: shehnai, octave: 2, timing: 0.012, legato: 0.96 },
  sarangi: { play: sarangi, octave: 1, timing: 0.014, legato: 0.98 },
  bansuri: { play: bansuri, octave: 2, timing: 0.016, legato: 0.97 },
  santoor: { play: santoor, octave: 2, timing: 0.008, legato: 0.9 },
  sitar: { play: sitar, octave: 1, timing: 0.01, legato: 0.95 },
  rabab: { play: rabab, octave: 1, timing: 0.01, legato: 0.9 },
  folkPluck: { play: folkPluck, octave: 2, timing: 0.008, legato: 0.9 },
  ukulele: { play: ukulele, octave: 1, timing: 0.006, legato: 0.85 },
  swarmandal: { play: swarmandal, octave: 2, timing: 0.004, legato: 1 },
  bassPluck: { play: bassPluck, octave: -1, timing: 0.008, legato: 0.85 },
  pluck: { play: pluck, octave: 1, timing: 0.004, legato: 0.8 },
  harmonium: { play: harmonium, octave: 0, timing: 0.016, legato: 0.98 },
  organ: { play: organ, octave: 0, timing: 0.006, legato: 0.99 },
  strings: { play: strings, octave: 0, timing: 0.02, legato: 0.98 },
  highStrings: { play: (stem, note) => strings(stem, note, { attack: 0.4, release: 0.7, cutoff: 5200, level: 0.077 }), octave: 1, timing: 0.02, legato: 0.98 },
  violin: { play: (stem, note) => strings(stem, note, { solo: true, attack: 0.1, release: 0.3, cutoff: 5600, level: 0.129 }), octave: 1, timing: 0.012, legato: 0.97 },
  cello: { play: (stem, note) => strings(stem, note, { solo: true, attack: 0.12, release: 0.35, cutoff: 3600, level: 0.118, lowCut: 50 }), octave: -1, timing: 0.014, legato: 0.97 },
  pad: { play: pad, octave: 0, timing: 0.03, legato: 1.02 },
  chantPad: { play: (stem, note) => pad(stem, note, { formant: true, attack: 1.6, release: 2.2, level: 0.23 }), octave: -1, timing: 0.03, legato: 1.02 },
  choir: { play: choir, octave: 1, timing: 0.025, legato: 1 },
  brass: { play: brass, octave: 0, timing: 0.015, legato: 0.95 },
  piano: { play: piano, octave: 1, timing: 0.01, legato: 0.9 },
  musicBox: { play: musicBox, octave: 3, timing: 0.01, legato: 1 },
  celesta: { play: celesta, octave: 2, timing: 0.01, legato: 1 },
  bells: { play: bells, octave: 3, timing: 0.01, legato: 1 },
  templeBell: { play: templeBell, octave: 1, timing: 0.02, legato: 1 },
  marimba: { play: marimba, octave: 1, timing: 0.006, legato: 0.9 },
  xylophone: { play: xylophone, octave: 2, timing: 0.006, legato: 0.9 },
  timpani: { play: timpani, octave: -1, timing: 0.006, legato: 1 },
  conch: { play: conch, octave: 1, timing: 0.03, legato: 1 },
  pulse: { play: (stem, note) => modalStrike(stem, note, { level: 0.42, partials: [{ ratio: 1, amp: 1, tau: 0.16 }, { ratio: 2, amp: 0.15, tau: 0.05 }, { ratio: 3, amp: 0.05, tau: 0.03 }], mallet: { length: 0.004, gain: 0.08, lowpass: 2500 } }), octave: 0, timing: 0.004, legato: 0.5 },
};

/** Drum kits: a stroke name → the PERC sounds it fires. The tabla's dayan rings at the kit's Sa. */
const KITS = {
  tabla: { dha: ['ge', 'na'], dhin: ['ge', 'tin'], dhi: ['ge', 'tin'], ge: ['ge'], ghe: ['ge'], ke: ['ke'], ka: ['ke'], na: ['na'], ta: ['na'], tin: ['tin'], tun: ['tun'], tu: ['tun'], te: ['te'], ti: ['te'], tete: ['te'] },
  dhol: { dha: ['dholBass', 'dholTreble'], ge: ['dholBass'], dhin: ['dholBass'], na: ['dholTreble'], ta: ['dholTreble'], ti: ['dholTreble'] },
  daf: { dum: ['dum'], tak: ['tak'], ta: ['tak'], ti: ['tak'] },
  tasha: { ta: ['tasha'], x: ['tasha'] },
  claps: { x: ['clap'] },
  manjira: { ting: ['ting'], chik: ['chik'] },
  chimta: { jing: ['jing'], ka: ['clack'], jk: ['jing', 'clack'] },
  shaker: { sh: ['shake'] },
  ghungroo: { x: ['ghungroo'] },
  tambourine: { tam: ['tamb'], sh: ['shake'] },
  cymbal: { crash: ['crash'], swell: ['swell'] },
  kit: { kick: ['kick'], rim: ['rim'], hat: ['hat'], clap: ['clap'], kh: ['kick', 'hat'] },
};
const SOFT_STROKES = new Set(['ti', 'te', 'ke', 'ka', 'tete', 'chik', 'hat', 'sh']);

/**
 * Named rhythms: `sub` strokes per beat; `.` rests, `!` accents, `?` ghosts. A
 * `variation` plays every fourth cycle and a `fill` in a section's last cycle (a
 * tabla tihai lands on the next sam). Both are exactly as long as the cycle.
 */
const RHYTHMS = {
  tabla: {
    keherwa: {
      sub: 4,
      strokes: 'dha . ge . na . ti . na . ka . dhi . na .',
      variation: 'dha . ge . na . ti . na . ka . dhi na dhi na',
      fill: 'dha . ge . na . dha ti dha . dha ti dha . dha ti',
    },
    /** Keherwa for slow tempos: one cycle over two bars. */
    keherwaSlow: {
      sub: 2,
      strokes: 'dha . ge . na . ti . na . ka . dhi . na .',
      variation: 'dha . ge . na . ti . na . ka . dhi na dhi na',
      fill: 'dha . ge . na . dha ti dha . dha ti dha . dha ti',
    },
    /** Dadra in 6/8 (the written beat is the eighth). */
    dadra: {
      sub: 2,
      strokes: 'dha . dhi . na . dha . tu . na .',
      variation: 'dha . dhi . na . dha ti tu . na na',
      fill: 'dha . dha ti dha . dha ti dha . dha ti',
    },
    /** The lilting bhajan theka. */
    bhajani: {
      sub: 4,
      strokes: 'dha . . ge na . dhin . na . . ge dhin . na .',
      variation: 'dha . . ge na . dhin . na . ti te dhin . na na',
      fill: 'dha . . ge na . dha ti dha . dha ti dha . dha ti',
    },
  },
  dhol: {
    keherwa: {
      sub: 4,
      strokes: 'dha . ge . na . ta . na . ge . dha . na .',
      variation: 'dha . ge . na . ta ta na . ge . dha . na na',
      fill: 'dha . ta ta dha . ta ta dha ta dha ta dha! ta dha! ta',
    },
    chaal: {
      sub: 4,
      strokes: 'dha . . . na . dha . . . na . dha . na .',
      variation: 'dha . . . na . dha . . na na . dha . na na',
      fill: 'dha . na na dha . na na dha na dha na dha! na dha! na',
    },
    bhangra: {
      sub: 4,
      strokes: 'dha . na . na . dha . na . . . dha . na .',
      variation: 'dha . na . na . dha . na . na . dha na dha na',
      fill: 'dha na na dha na na dha na dha na dha na dha! . dha! .',
    },
  },
  daf: {
    soft: {
      sub: 4,
      strokes: 'dum . . . tak . . ti dum . tak . tak . . ti',
      variation: 'dum . . . tak . . ti dum . tak ti tak . tak ti',
      fill: 'dum . tak . dum . tak . dum tak dum tak dum! . . .',
    },
  },
  tasha: {
    roll: { sub: 4, strokes: 'ta . ta ta ta . ta ta ta ta . ta ta . ta ta', variation: 'ta ta ta ta ta ta ta ta ta . ta ta ta . ta ta' },
  },
  claps: {
    backbeat: { sub: 1, strokes: '. x . x' },
    offbeat: { sub: 2, strokes: '. . x . . . x .' },
    two: { sub: 1, strokes: '. x . x . x . .' },
    chaal: { sub: 2, strokes: 'x . . x . . x .' },
  },
  manjira: {
    bhajan: { sub: 2, strokes: 'ting . chik . ting . chik .' },
    aarti: { sub: 2, strokes: 'ting chik ting chik ting chik ting chik', variation: 'ting chik ting chik ting chik ting ting' },
    slow: { sub: 1, strokes: 'ting . chik .' },
    dadra: { sub: 1, strokes: 'ting . chik ting . chik' },
  },
  chimta: {
    folk: { sub: 2, strokes: 'jk . jing ka jing . jing ka' },
  },
  shaker: {
    eighths: { sub: 2, strokes: 'sh sh? sh sh? sh sh? sh sh?' },
    sixteenths: { sub: 4, strokes: 'sh! sh? sh sh? sh! sh? sh sh? sh! sh? sh sh? sh! sh? sh sh?' },
  },
  ghungroo: {
    eighths: { sub: 2, strokes: 'x x? x x? x x? x x?' },
  },
  tambourine: {
    backbeat: { sub: 2, strokes: 'sh sh tam sh sh sh tam sh' },
  },
  kit: {
    soft: { sub: 2, strokes: 'kick . hat . rim . hat . kick . kick hat rim . hat hat', variation: 'kick . hat . rim . hat . kick . kick hat rim . rim rim' },
  },
};

const TOKEN = /^([1-9])([+-]*)([#b]?)([\^v*~>'!?$&]*)(?::(\d+(?:\.\d+)?)(?:\/(\d+))?)?$/;
const REST = /^_(?::(\d+(?:\.\d+)?)(?:\/(\d+))?)?$/;
const beatsOf = (num, den) => (num === undefined ? 1 : Number(num) / (den === undefined ? 1 : Number(den)));

/** Phrase notation → tokens (see the catalogue for examples). */
function parsePhrase(text, where) {
  const tokens = [];
  for (const raw of text.split(/\s+/)) {
    if (!raw || raw === '|') continue;
    const rest = REST.exec(raw);
    if (rest) {
      tokens.push({ rest: true, dur: beatsOf(rest[1], rest[2]) });
      continue;
    }
    const m = TOKEN.exec(raw);
    if (!m) throw new Error(`${where}: cannot read "${raw}"`);
    const octs = (m[2].match(/\+/g) ?? []).length - (m[2].match(/-/g) ?? []).length;
    const o = m[4];
    tokens.push({
      degree: Number(m[1]),
      octaves: octs,
      alter: m[3] === '#' ? 1 : m[3] === 'b' ? -1 : 0,
      upperGrace: o.includes('^'),
      lowerGrace: o.includes('v'),
      murki: o.includes('*'),
      gamak: o.includes('~'),
      meend: o.includes('>'),
      staccato: o.includes("'"),
      accent: o.includes('!'),
      ghost: o.includes('?'),
      sweep: o.includes('$'),
      andolan: o.includes('&'),
      dur: beatsOf(m[5], m[6]),
    });
  }
  return tokens;
}

const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7 };
const NUMERAL = 'VII|VI|V|IV|III|II|I|vii|vi|v|iv|iii|ii|i';
const CHORD = new RegExp(`^([b#]?)(${NUMERAL})(o|h|\\+)?(maj7|7|sus2|sus4|sus|add9|9|6|5)?(?:/(${NUMERAL}))?(?:/([357]))?(?:@([1-7]))?(?::(\\d+(?:\\.\\d+)?))?$`);

/**
 * One chord symbol → semitones from the tonic. Roman numerals stack thirds on the
 * scale; the numeral's case can turn the third (iv in a major key is minor, II is
 * major: V/V). `b`/`#` move the root (bVII, bVI), `o` and `h` make it diminished or
 * half-diminished, `/V` `/vi` … build a secondary chord on another degree (V7/vi,
 * viio7/V), `/3` `/5` `/7` put that chord tone in the bass, `@n` holds a scale degree
 * under it (a pedal).
 */
function chordOf(scale, m) {
  const [, acc, numeral, mod, ext, secondary, inverted, pedal] = m;
  const upper = numeral === numeral.toUpperCase();
  const degree = ROMAN[numeral.toLowerCase()];
  const target = secondary ? ROMAN[secondary.toLowerCase()] : null;
  const inversion = inverted ? { 3: 1, 5: 2, 7: 3 }[inverted] : 0;
  const sus = ext === 'sus' || ext === 'sus4' ? 4 : ext === 'sus2' ? 2 : 0;
  const dim = mod === 'o' || mod === 'h';
  let tones;
  if (target || acc || scale.length !== 7) {
    // built from intervals: secondary chords, chromatic roots, chords over a pentatonic raga
    const root = target ? degreeToSemitones(scale, target) + MAJOR[degree - 1] : degreeToSemitones(scale, degree) + (acc === 'b' ? -1 : acc === '#' ? 1 : 0);
    const third = dim ? 3 : upper ? 4 : 3;
    const fifth = dim ? 6 : mod === '+' ? 8 : 7;
    tones = [root, root + (sus === 4 ? 5 : sus === 2 ? 2 : third), root + fifth];
    if (ext === '7') tones.push(root + (mod === 'o' ? 9 : 10));
    if (ext === '9') tones.push(root + 10, root + 14);
    if (ext === '6') tones.push(root + 9);
    if (ext === 'add9') tones.push(root + 14);
  } else {
    const at = (s) => degreeToSemitones(scale, degree + s);
    tones = [at(0), sus === 4 ? at(3) : sus === 2 ? at(1) : at(2), at(4)];
    if (dim) {
      tones[1] = tones[0] + 3;
      tones[2] = tones[0] + 6;
    } else if (!sus) {
      const third = tones[1] - tones[0];
      if (upper && third === 3) tones[1] += 1;
      if (!upper && third === 4) tones[1] -= 1;
      if (upper && tones[2] - tones[0] === 6) tones[2] += 1;
      if (mod === '+') tones[2] = tones[0] + 8;
    }
    if (ext === '7') tones.push(mod === 'o' ? tones[0] + 9 : at(6));
    if (ext === '9') tones.push(at(6), at(8));
    if (ext === '6') tones.push(at(5));
    if (ext === 'add9') tones.push(at(8));
  }
  if (ext === 'maj7') tones.push(tones[0] + 11);
  if (ext === '5') tones = [tones[0], tones[0] + 7];
  let bass = inversion ? (tones[inversion] ?? tones[0]) : tones[0];
  if (pedal) bass = degreeToSemitones(scale, Number(pedal));
  return { degree, root: tones[0], tones, bass };
}

/** 'I:4 IV:2 V7/V:2' → chords with durations in beats. */
function parseChords(text, scale, beatsPerBar, where) {
  const out = [];
  for (const raw of text.split(/\s+/)) {
    if (!raw || raw === '|') continue;
    const m = CHORD.exec(raw);
    if (!m) throw new Error(`${where}: cannot read chord "${raw}"`);
    out.push({ ...chordOf(scale, m), symbol: raw.replace(/:.*$/, ''), dur: m[8] ? Number(m[8]) : beatsPerBar });
  }
  return out;
}

/**
 * Voice leading: the voicing of `tones` (semitones from the tonic, any octave)
 * inside [lo, hi] that moves least from the previous voicing, with a penalty
 * for voices closer than a minor third.
 */
function voiceLead(prev, tones, lo, hi) {
  const options = tones.map((t) => {
    const list = [];
    for (let s = t - 48; s <= t + 48; s += 12) if (s >= lo && s <= hi) list.push(s);
    return list.length ? list : [clamp(t, lo, hi)];
  });
  let best = null, bestCost = Infinity;
  const walk = (k, acc) => {
    if (k === options.length) {
      const voicing = [...acc].sort((a, b) => a - b);
      if (new Set(voicing).size !== voicing.length) return;
      let cost = 0;
      if (prev) {
        for (let i = 0; i < voicing.length; i++) {
          let nearest = Infinity;
          for (const p of prev) nearest = Math.min(nearest, Math.abs(voicing[i] - p));
          cost += nearest;
        }
      } else {
        const centre = (lo + hi) / 2;
        for (const v of voicing) cost += Math.abs(v - centre) * 0.3;
      }
      for (let i = 1; i < voicing.length; i++) {
        const gap = voicing[i] - voicing[i - 1];
        if (gap < 3) cost += 4;
        if (gap > 12) cost += 2;
      }
      if (cost < bestCost) {
        bestCost = cost;
        best = voicing;
      }
      return;
    }
    for (const s of options[k]) walk(k + 1, [...acc, s]);
  };
  walk(0, []);
  return best;
}

const COMP_STYLES = new Set(['pad', 'sustain', 'chorale', 'root', 'bass', 'block', 'block2', 'waltz', 'alberti', 'arp', 'broken', 'strum', 'pulse', 'ballad', 'march', 'offbeat', 'pulse8', 'roll']);
/** Seconds rendered past the end of the loop before the tails are folded back (the longest ring, a temple bell, is 11 s). */
const TAIL_SECONDS = 12;
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

class Composer {
  constructor(track) {
    this.track = track;
    this.rng = new Rng(hashSeed(`${track.key}:${track.seed ?? 0}`));
    this.scale = typeof track.scale === 'string' ? SCALES[track.scale] : track.scale;
    if (!this.scale) throw new Error(`${track.key}: unknown scale ${track.scale}`);
    this.tonic = hz(midi(track.tonic));
    this.tonicPc = midi(track.tonic) % 12;
    this.spb = 60 / track.bpm;
    this.beatsPerBar = track.meter[0];
    this.lead = track.lead ?? 0.25;
    this.totalBeats = track.sections.reduce((s, sec) => s + sec.bars, 0) * this.beatsPerBar;
    this.period = Math.round((this.time(this.totalBeats) - this.lead) * RATE);
    this.duration = this.period / RATE;
    this.samples = this.period + Math.round((this.lead + TAIL_SECONDS) * RATE);
    this.stems = {};
    this.voicings = {};
    this.basses = {};
    this.droneClock = {};
    this.shift = 0;
    this.notes = [];
    this.chordLine = [];
    this.firstNote = Infinity;
    this.warnings = [];
    if (this.duration < 45 || this.duration > 72.4) this.warnings.push(`${track.key}: ${this.duration.toFixed(2)} s is outside 45-72 s`);
    for (const [name, cfg] of Object.entries(track.instruments)) {
      const base = name.replace(/\d+$/, '');
      if (!INSTRUMENTS[base] && !KITS[base]) throw new Error(`${track.key}: unknown instrument ${name}`);
      this.stems[name] = new Stem(name, this.samples, cfg);
    }
  }

  /** Seconds at a beat: the lead-in, the tempo, a closing ritardando (`rit`) and swing on the off-beat eighths. */
  time(beat) {
    let t = this.lead + beat * this.spb;
    const rit = this.track.rit;
    if (rit && beat > rit.from) {
      const span = this.totalBeats - rit.from;
      const x = Math.min(beat - rit.from, span);
      t += this.spb * (1 / rit.factor - 1) * ((x * x) / (2 * span) + Math.max(0, beat - rit.from - span));
    }
    const swing = this.track.swing;
    if (swing && Math.abs(beat - Math.floor(beat) - 0.5) < 1e-6) t += swing * this.spb;
    return t;
  }

  /** The dynamics curve (beats → level), linear between breakpoints. */
  level(beat) {
    const curve = this.track.dynamics ?? [[0, 1]];
    if (beat <= curve[0][0]) return curve[0][1];
    for (let i = 1; i < curve.length; i++) {
      if (beat <= curve[i][0]) {
        const [b0, l0] = curve[i - 1];
        const [b1, l1] = curve[i];
        return lerp(l0, l1, (beat - b0) / (b1 - b0));
      }
    }
    return curve[curve.length - 1][1];
  }

  freqOf(degree, octaves, alter, instOctave) {
    return this.tonic * Math.pow(2, (degreeToSemitones(this.scale, degree, octaves + instOctave, alter) + this.shift) / 12);
  }

  /** One note, humanised. */
  note(name, inst, cfg, { beat, t, dur, freq, vel, from, gamak, andolan }) {
    const stem = this.stems[name];
    const timing = cfg.timing ?? inst.timing ?? 0.01;
    const start = Math.max(0, (t ?? this.time(beat)) + this.rng.gauss() * timing);
    const v = clamp(vel * (1 + this.rng.gauss() * 0.06), 0.05, 1);
    if (start < this.firstNote) this.firstNote = start;
    inst.play(stem, { t: start, dur: Math.max(0.03, dur), freq, vel: v, from, gamak, andolan, rng: this.rng });
  }

  /** How long a note from `beat` lasting `len` beats sounds: the last notes of the track hold through the seam. */
  held(beat, len, legato) {
    const span = this.time(beat + len) - this.time(beat);
    return beat + len >= this.totalBeats - 1e-6 ? span + 0.1 : span * legato;
  }

  /** A written phrase: ornaments, meend between tied notes, dynamics, accents and a gentle contour. */
  phrase(name, text, startBeat, lengthBeats, section) {
    const base = name.replace(/\d+$/, '');
    const inst = INSTRUMENTS[base];
    const cfg = this.track.instruments[name];
    const where = `${this.track.key} / ${name} at bar ${startBeat / this.beatsPerBar + 1}`;
    const loop = text.startsWith('loop:');
    let tokens = parsePhrase(loop ? text.slice(5) : text, where);
    const octave = cfg.octave ?? inst.octave;
    const legato = cfg.legato ?? inst.legato ?? 0.92;
    const baseVel = (cfg.vel ?? 0.8) * (section.dyn ?? 1);
    const end = startBeat + lengthBeats;
    const total = tokens.reduce((s, tk) => s + tk.dur, 0);
    if (loop) {
      const times = Math.ceil(lengthBeats / total - 1e-9);
      tokens = Array.from({ length: times }, () => tokens).flat();
    } else if (Math.abs(total - lengthBeats) > 1e-6) {
      this.warnings.push(`${where}: a phrase of ${+total.toFixed(3)} beats in a section of ${lengthBeats}`);
    }
    // the contour: a phrase leans a little into its high notes
    const pitched = tokens.filter((tk) => !tk.rest);
    const mean = pitched.length ? pitched.reduce((s, tk) => s + degreeToSemitones(this.scale, tk.degree, tk.octaves, tk.alter), 0) / pitched.length : 0;
    let beat = startBeat;
    let prevFreq = null;
    for (let k = 0; k < tokens.length; k++) {
      const tk = tokens[k];
      if (beat >= end - 1e-6) break;
      const dur = Math.min(tk.dur, end - beat);
      if (tk.rest) {
        beat += dur;
        prevFreq = null;
        continue;
      }
      const semis = degreeToSemitones(this.scale, tk.degree, tk.octaves, tk.alter);
      const freq = this.freqOf(tk.degree, tk.octaves, tk.alter, octave);
      const next = tokens[k + 1];
      const tied = next && !next.rest && next.meend;
      let held = this.held(beat, dur, tied ? 1.02 : tk.staccato ? 0.45 : legato);
      const downbeat = Math.abs((beat - startBeat) % this.beatsPerBar) < 1e-6;
      const phraseEnd = !next || next.rest;
      const contour = 1 + clamp((semis - mean) / 30, -0.07, 0.07);
      const vel = baseVel * this.level(beat) * (downbeat ? 1.08 : 1) * (tk.staccato ? 0.9 : 1) * (tk.accent ? 1.2 : 1) * (tk.ghost ? 0.6 : 1) * (phraseEnd ? 0.93 : 1) * contour;
      let t = this.time(beat);
      const from = tk.meend && prevFreq ? prevFreq : undefined;
      if (tk.sweep) {
        // a run up the scale into the note, landing on the beat
        const count = 7, step = 0.032;
        for (let j = count; j >= 1; j--) this.note(name, inst, cfg, { t: t - j * step, dur: 0.3, freq: this.freqOf(tk.degree - j, tk.octaves, 0, octave), vel: vel * (0.4 + 0.4 * (1 - j / count)) });
      }
      if (tk.murki) {
        const step = Math.min(0.055, (this.time(beat + dur) - t) / 6);
        const up = this.freqOf(tk.degree + 1, tk.octaves, 0, octave);
        const down = this.freqOf(tk.degree - 1, tk.octaves, 0, octave);
        [up, freq, down].forEach((f, i) => this.note(name, inst, cfg, { t: t + i * step, dur: step * 0.95, freq: f, vel: vel * 0.75 }));
        t += 3 * step;
        held -= 3 * step;
      } else if (tk.upperGrace || tk.lowerGrace) {
        const graceDur = Math.min(0.075, held * 0.3);
        const g = this.freqOf(tk.degree + (tk.upperGrace ? 1 : -1), tk.octaves, 0, octave);
        this.note(name, inst, cfg, { t, dur: graceDur * 0.95, freq: g, vel: vel * 0.8, from });
        t += graceDur;
        held -= graceDur;
      }
      this.note(name, inst, cfg, { t, dur: held, freq, vel, from: tk.murki || tk.upperGrace || tk.lowerGrace ? undefined : from, gamak: tk.gamak, andolan: tk.andolan });
      this.notes.push({ part: name, beat, dur, semis: semis + 12 * octave + this.shift });
      prevFreq = freq;
      beat += dur;
    }
  }

  /** The tanpura cycle (Pa Sa Sa Sa by default), a pluck a second or so, free of the beat and unbroken across sections. */
  drone(name, startBeat, lengthBeats, section) {
    const cfg = this.track.instruments[name];
    const cycle = (section.drone ?? cfg.cycle ?? 'PSSS').split('');
    const interval = cfg.interval ?? clamp(this.spb * 1.3, 0.75, 1.3);
    const ratios = { P: 1.5 / 2, M: 4 / 3 / 2, S: 1, s: 0.5, N: 15 / 16 };
    const from = this.time(startBeat);
    const to = this.time(startBeat + lengthBeats);
    let t = Math.max(from, this.droneClock[name]?.t ?? from);
    let k = this.droneClock[name]?.k ?? 0;
    const octave = Math.pow(2, cfg.octave ?? 0);
    while (t < to - 1e-6) {
      const step = cycle[k % cycle.length];
      const last = k % cycle.length === cycle.length - 1;
      const ratio = ratios[step] ?? 1;
      const freq = this.tonic * octave * (last && step === 'S' ? 0.5 : ratio);
      this.note(name, INSTRUMENTS.tanpura, cfg, { t: t + this.rng.gauss() * 0.02, dur: 1, freq, vel: (cfg.vel ?? 0.8) * (section.dyn ?? 1) * this.level((t - this.lead) / this.spb) * (step === 'P' || step === 'M' ? 0.95 : 1) });
      t += interval;
      k++;
    }
    this.droneClock[name] = { t, k };
  }

  /** A drum pattern across the section (`once:` plays it a single time). */
  rhythm(name, content, startBeat, lengthBeats, section) {
    const cfg = this.track.instruments[name];
    const kitName = name.replace(/\d+$/, '');
    const kit = KITS[kitName];
    const where = `${this.track.key} / ${name}`;
    const once = content.startsWith('once:');
    const patternName = once ? content.slice(5).trim() : content;
    const named = RHYTHMS[kitName]?.[patternName];
    const pattern = named ?? { sub: cfg.sub ?? 2, strokes: patternName };
    const split = (s) => s.split(/\s+/).filter(Boolean);
    const strokes = split(pattern.strokes);
    const variation = pattern.variation ? split(pattern.variation) : null;
    const fill = pattern.fill && section.fill !== false ? split(pattern.fill) : null;
    for (const [label, list] of [['variation', variation], ['fill', fill]]) {
      if (list && list.length !== strokes.length) throw new Error(`${where}: the ${label} of "${patternName}" has ${list.length} strokes but its cycle has ${strokes.length}`);
    }
    const ctx = { sa: cfg.sa ? hz(midi(cfg.sa)) : this.tonic * 2, spb: this.spb };
    const stem = this.stems[name];
    const available = Math.floor(lengthBeats * pattern.sub + 1e-6);
    const totalStrokes = once ? Math.min(strokes.length, available) : available;
    const cycles = Math.floor(totalStrokes / strokes.length);
    const baseVel = (cfg.vel ?? 0.8) * (section.dyn ?? 1);
    for (let k = 0; k < totalStrokes; k++) {
      const cycle = Math.floor(k / strokes.length);
      let list = strokes;
      if (fill && cycles >= 2 && cycle === cycles - 1) list = fill;
      else if (variation && cycle % 4 === 3) list = variation;
      const token = list[k % strokes.length];
      if (token === '.' || token === '-') continue;
      const accent = token.endsWith('!') ? 1.25 : token.endsWith('?') ? 0.6 : 1;
      const stroke = token.replace(/[!?]$/, '');
      const sounds = kit[stroke];
      if (!sounds) throw new Error(`${where}: unknown stroke "${stroke}"`);
      const beat = startBeat + k / pattern.sub;
      const sam = k % strokes.length === 0 ? 1.12 : 1;
      const soft = SOFT_STROKES.has(stroke) ? 0.7 : 1;
      const t = Math.max(0, this.time(beat) + this.rng.gauss() * (cfg.timing ?? 0.004));
      if (t < this.firstNote) this.firstNote = t;
      const vel = clamp(baseVel * this.level(beat) * accent * sam * soft * (1 + this.rng.gauss() * 0.05), 0.05, 1);
      for (const sound of sounds) PERC[sound](stem, t, vel, this.rng, ctx);
    }
  }

  /** The bass note of a chord: the octave nearest the previous bass, in the octave and a half under the part's register. */
  bassNote(name, semis, octave) {
    const lo = 12 * octave - 19, hi = 12 * octave - 5;
    const prev = this.basses[name] ?? 12 * octave - 12;
    let best = null;
    for (let s = semis - 60; s <= semis + 60; s += 12) {
      if (s < lo || s > hi) continue;
      if (best === null || Math.abs(s - prev) < Math.abs(best - prev)) best = s;
    }
    this.basses[name] = best;
    return best;
  }

  /** Chord accompaniment in a style, voice-led from the previous chord. */
  comp(name, style, chords, startBeat, lengthBeats, section) {
    const base = name.replace(/\d+$/, '');
    const inst = INSTRUMENTS[base];
    const cfg = this.track.instruments[name];
    const octave = cfg.octave ?? inst.octave;
    const lo = (cfg.range?.[0] ?? -5) + 12 * octave;
    const hi = (cfg.range?.[1] ?? 14) + 12 * octave;
    const legato = cfg.legato ?? inst.legato ?? 0.9;
    const baseVel = (cfg.vel ?? 0.7) * (section.dyn ?? 1);
    const freqOfSemis = (s) => this.tonic * Math.pow(2, s / 12);
    const bpb = this.beatsPerBar;
    let beat = startBeat;
    const end = startBeat + lengthBeats;
    for (const chord of chords) {
      if (beat >= end - 1e-6) break;
      const dur = Math.min(chord.dur, end - beat);
      const tones = chord.tones.map((s) => s + this.shift);
      const voicing = voiceLead(this.voicings[name], tones, lo, hi);
      this.voicings[name] = voicing;
      const bass = this.bassNote(name, chord.bass + this.shift, octave);
      // the chord's tones stacked upwards from its bass (arpeggios)
      const pcs = [...new Set(tones.map((s) => ((s % 12) + 12) % 12))];
      const stack = [bass];
      for (let s = bass + 1; stack.length < 8; s++) if (pcs.includes(((s % 12) + 12) % 12)) stack.push(s);
      const vel = baseVel * this.level(beat);
      const play = (semis, b, len, v) => this.note(name, inst, cfg, { beat: b, dur: this.held(b, len, legato), freq: freqOfSemis(semis), vel: v });
      const playAt = (semis, t, len, v) => this.note(name, inst, cfg, { t, dur: len, freq: freqOfSemis(semis), vel: v });
      const until = (b) => beat + dur - b; // beats left in the chord from b (the pedal holds)
      switch (style) {
        case 'pad':
        case 'sustain':
          voicing.forEach((s) => play(s, beat, dur, vel));
          break;
        case 'chorale':
          voicing.forEach((s) => play(s, beat, dur, vel));
          play(bass, beat, dur, vel * 1.05);
          break;
        case 'root':
          play(bass, beat, dur, vel);
          break;
        case 'bass':
          for (let b = 0; b < dur - 1e-6; b += bpb) {
            play(bass, beat + b, Math.min(bpb >= 4 ? 2 : bpb, dur - b), vel);
            if (bpb >= 4 && b + 2 < dur) play(stack[2] ?? bass + 7, beat + b + 2, Math.min(2, dur - b - 2), vel * 0.85);
          }
          break;
        case 'block':
        case 'block2': {
          const every = style === 'block' ? 1 : 2;
          for (let b = 0; b < dur - 1e-6; b += every) {
            const strong = b % bpb === 0;
            voicing.forEach((s, i) => this.note(name, inst, cfg, { t: this.time(beat + b) + i * 0.006, dur: this.held(beat + b, Math.min(every, dur - b), 0.9), freq: freqOfSemis(s), vel: vel * (strong ? 1 : 0.82) }));
            if (strong) play(bass, beat + b, Math.min(every, dur - b), vel * 1.05);
          }
          break;
        }
        case 'waltz':
          for (let b = 0; b < dur - 1e-6; b += 3) {
            play(bass, beat + b, Math.min(3, dur - b), vel * 1.05);
            // Viennese lilt: the second beat leans early, the third is light
            voicing.forEach((s, i) => this.note(name, inst, cfg, { t: this.time(beat + b + 1) - 0.045 + i * 0.008, dur: 0.75 * this.spb, freq: freqOfSemis(s), vel: vel * 0.8 }));
            voicing.forEach((s, i) => this.note(name, inst, cfg, { t: this.time(beat + b + 2) + i * 0.008, dur: b + 3 >= dur - 1e-6 ? this.held(beat + b + 2, 1, 0.7) : 0.7 * this.spb, freq: freqOfSemis(s), vel: vel * 0.66 }));
          }
          break;
        case 'alberti': {
          const [a, b2, c] = [voicing[0], voicing[Math.min(2, voicing.length - 1)], voicing[1]];
          const seq = [a, b2, c, b2];
          for (let e = 0; e < dur * 2 - 1e-6; e++) play(seq[e % 4], beat + e / 2, 0.5, vel * (e % 4 === 0 ? 1 : 0.78));
          if (dur >= bpb) play(bass, beat, dur, vel * 0.9);
          break;
        }
        case 'arp': {
          // eighths in simple meters; in 6/8 the written beat is the eighth already
          const step = bpb === 6 ? 1 : 0.5;
          const seq = [...voicing, voicing[0] + 12];
          for (let e = 0; e < dur / step - 1e-6; e++) play(seq[e % seq.length], beat + e * step, step * 1.1, vel * (e % 2 === 0 ? 0.95 : 0.75));
          break;
        }
        case 'ballad': {
          // the pianist's left hand: root, fifth, octave, tenth… each held by the pedal to the chord's end
          const pattern = bpb === 4 ? [0, 2, 3, 4, 5, 4, 3, 2] : [0, 2, 3, 4, 3, 2];
          const step = bpb === 6 ? 1 : 0.5;
          for (let e = 0; e < dur / step - 1e-6; e++) {
            const b = beat + e * step;
            const k = pattern[e % pattern.length];
            play(stack[k], b, until(b), vel * (k === 0 ? 1 : e % 2 === 0 ? 0.8 : 0.68));
          }
          break;
        }
        case 'broken': {
          play(bass, beat, dur, vel);
          voicing.forEach((s, i) => playAt(s, this.time(beat) + 0.09 * (i + 1), this.held(beat, dur, 0.9), vel * 0.85));
          if (dur >= bpb) voicing.forEach((s, i) => playAt(s, this.time(beat + Math.floor(dur / 2)) + 0.09 * i, this.held(beat + Math.floor(dur / 2), dur / 2, 0.9), vel * 0.7));
          break;
        }
        case 'roll': {
          // a harp's rolled chord up through two octaves, on the chord and (in a long chord) again mid-way
          const notes = [...stack.slice(0, 7)];
          const at = dur > bpb ? [0, bpb] : dur >= 4 ? [0, dur / 2] : [0];
          for (const off of at) {
            if (off >= dur) continue;
            notes.forEach((s, i) => playAt(s + 12, this.time(beat + off) + i * 0.045, this.held(beat + off, dur - off, 0.95), vel * (0.75 + 0.25 * (i / notes.length))));
          }
          break;
        }
        case 'strum': {
          const hits = bpb === 3 ? [[0, 1], [1, 0.7], [2, 0.7]] : [[0, 1], [1, 0.6], [1.5, 0.7], [2.5, 0.6], [3, 0.8], [3.5, 0.55]];
          for (let b = 0; b < dur - 1e-6; b += bpb) {
            for (const [off, acc] of hits) {
              if (b + off >= dur) break;
              const down = off % 1 === 0;
              const order = down ? voicing : [...voicing].reverse();
              order.forEach((s, i) => playAt(s, this.time(beat + b + off) + i * 0.014, 0.6 * this.spb, vel * acc * (0.9 + 0.1 * (i === 0))));
            }
          }
          break;
        }
        case 'march': {
          // oom-pah: the bass on the strong beats (the root, then the fifth below), the chord short on the others
          const fifth = stack[2] - 12 >= 12 * octave - 19 ? stack[2] - 12 : stack[2];
          for (let b = 0; b < dur - 1e-6; b += 1) {
            if (b % 2 === 0) play(b % 4 === 0 ? bass : fifth, beat + b, 1, vel);
            else voicing.forEach((s, i) => playAt(s, this.time(beat + b) + i * 0.005, 0.45 * this.spb, vel * 0.72));
          }
          break;
        }
        case 'offbeat':
          // the chord on every "and" (a skank)
          for (let b = 0.5; b < dur - 1e-6; b += 1) voicing.forEach((s, i) => playAt(s, this.time(beat + b) + i * 0.004, 0.32 * this.spb, vel * 0.8));
          break;
        case 'pulse8': {
          // repeated eighths, accented 3+3+2
          for (let e = 0; e < dur * 2 - 1e-6; e++) {
            const accent = [0, 3, 6].includes(e % 8) ? 1 : 0.62;
            voicing.forEach((s, i) => playAt(s, this.time(beat + e / 2) + i * 0.003, 0.42 * this.spb, vel * accent));
          }
          break;
        }
        case 'pulse': {
          for (let e = 0; e < dur * 2 - 1e-6; e++) play(e % 4 === 2 ? (stack[2] ?? bass + 7) : bass, beat + e / 2, 0.3, vel * (e % 2 === 0 ? 1 : 0.7));
          break;
        }
        default:
          throw new Error(`${this.track.key} / ${name}: unknown style ${style}`);
      }
      beat += dur;
    }
  }

  render() {
    const t = this.track;
    let beat = 0;
    for (const [index, section] of t.sections.entries()) {
      this.shift = section.shift ?? 0;
      const length = section.bars * this.beatsPerBar;
      const where = `${t.key} section ${index + 1}`;
      const chords = section.chords ? parseChords(section.chords, this.scale, this.beatsPerBar, where) : null;
      if (chords) {
        let b = beat;
        for (const c of chords) {
          this.chordLine.push({ beat: b, dur: c.dur, symbol: c.symbol, pcs: new Set(c.tones.map((s) => (((s + this.shift) % 12) + 12) % 12)) });
          b += c.dur;
        }
        const total = chords.reduce((s, c) => s + c.dur, 0);
        if (Math.abs(total - length) > 1e-6) this.warnings.push(`${where}: chords of ${total} beats in a section of ${length}`);
      }
      for (const [name, content] of Object.entries(section.parts ?? {})) {
        if (!this.stems[name]) throw new Error(`${where}: ${name} is not in the track's instruments`);
        if (KITS[name.replace(/\d+$/, '')]) this.rhythm(name, content, beat, length, section);
        else if (content === 'drone') this.drone(name, beat, length, section);
        else if (COMP_STYLES.has(content)) {
          if (!chords) throw new Error(`${where}: ${name} plays ${content} but the section has no chords`);
          this.comp(name, content, chords, beat, length, section);
        } else this.phrase(name, content, beat, length, section);
      }
      beat += length;
    }
    const { L, R } = mixdown(Object.values(this.stems), this.samples, t.reverb ?? {});
    return foldLoop(L, R, this.period);
  }

  /**
   * Rhythm, range and harmony of every written part (--notes). In the Western tracks a
   * note on a strong beat a semitone from a chord tone is listed unless it resolves by
   * step to a chord tone (an appoggiatura or suspension) or is the next chord's note early.
   */
  report() {
    const lines = [];
    const parts = [...new Set(this.notes.map((n) => n.part))];
    const pc = (s) => (((s + this.tonicPc) % 12) + 12) % 12;
    const chordAt = (b) => this.chordLine.find((c) => b >= c.beat - 1e-6 && b < c.beat + c.dur - 1e-6);
    for (const part of parts) {
      const notes = this.notes.filter((n) => n.part === part).sort((a, b) => a.beat - b.beat);
      const off = notes.filter((n) => Math.abs(n.beat - Math.round(n.beat)) > 1e-6).length;
      const short = notes.filter((n) => n.dur < 1 - 1e-6).length;
      const semis = notes.map((n) => n.semis);
      const span = notes.length ? notes[notes.length - 1].beat + notes[notes.length - 1].dur - notes[0].beat : 0;
      const name = (st) => `${NAMES[pc(st)]}${Math.floor((midi(this.track.tonic) + st) / 12) - 1}`;
      lines.push(`    ${part.padEnd(12)} ${String(notes.length).padStart(4)} notes  ${(notes.length / Math.max(1, span)).toFixed(2)}/beat  ${Math.round((100 * off) / Math.max(1, notes.length))}% off the beat  ${Math.round((100 * short) / Math.max(1, notes.length))}% under a beat  ${name(Math.min(...semis))}-${name(Math.max(...semis))}`);
      if (!WESTERN.has(this.track.scale)) continue;
      // a note on the pulse that lasts at least a pulse, or any note on a downbeat (6/8 pulses in dotted quarters)
      const pulse = this.beatsPerBar === 6 ? 3 : 1;
      notes.forEach((n, i) => {
        const inBar = n.beat % this.beatsPerBar;
        const downbeat = inBar < 1e-6 || this.beatsPerBar - inBar < 1e-6;
        const onPulse = Math.abs(n.beat / pulse - Math.round(n.beat / pulse)) < 1e-6;
        if (!downbeat && !(onPulse && n.dur >= pulse - 1e-6)) return;
        const chord = chordAt(n.beat);
        if (!chord) return;
        const p = ((n.semis % 12) + 12) % 12;
        if (chord.pcs.has(p)) return;
        const clash = [...chord.pcs].some((c) => Math.min((p - c + 12) % 12, (c - p + 12) % 12) === 1);
        if (!clash) return;
        const next = notes[i + 1];
        const nextChord = next && chordAt(next.beat);
        const resolves = next && Math.abs(next.beat - (n.beat + n.dur)) < 1e-6 && Math.abs(next.semis - n.semis) <= 2 && nextChord?.pcs.has(((next.semis % 12) + 12) % 12);
        if (!resolves) lines.push(`      ! ${part} bar ${Math.floor(n.beat / this.beatsPerBar) + 1} beat ${+((n.beat % this.beatsPerBar) + 1).toFixed(2)}: ${NAMES[pc(n.semis)]} against ${chord.symbol}`);
      });
    }
    return lines;
  }
}

// ───────────────────────────── The catalogue ─────────────────────────────
//
// Phrase notation: scale degrees 1-7 (1 = Sa or the tonic), `+`/`-` an octave up or
// down, `#`/`b` a semitone, then ornaments: `^` upper grace, `v` lower grace, `*` murki
// (a quick turn), `~` gamak (wide oscillation), `&` andolan (a slow sway), `>` meend
// (glide from the previous note), `$` a run up the scale into the note, `'` staccato,
// `!` accent, `?` ghost; `:n` beats (`:1.5`, `:1/3`, default 1); `_` a rest; `|` is only
// for reading. Every phrase fills its section exactly (the script warns otherwise).
// Chords: roman numerals on the scale with `:beats` (see chordOf): I IV V7 vi ii7 Isus
// I6 Iadd9 Imaj7, iv (minor in a major key), bVII, V7/V, viio7/V, I/3 (third in the
// bass), IV@1 (over a tonic pedal), I5 (root and fifth).
// Rhythms: a named pattern of the kit, or strokes per sub-beat (`.` rests, `!` accent);
// `once:` plays a pattern a single time. Dynamics: [beat, level] breakpoints. `bpm`
// counts the written beat (eighths in 6/8). A section may `shift` the key (semitones).
// Every track is a whole number of bars (one loop), 45-72 s long.

const CATALOGUE_A = [
  {
    key: 'original-shehnai-darbar',
    title: 'Shehnai Darbar',
    mood: 'royal Hindu wedding at dusk: shehnai and its answering second shehnai over tanpura and a sur drone, tabla keherwa with tihais, bells and swarmandal; raga Yaman (alaap, sthayi, antara, tihai)',
    tonic: 'C#3',
    scale: 'yaman',
    bpm: 80,
    meter: [4, 4],
    reverb: { room: 0.86, damp: 0.22, wet: 0.3, preDelay: 0.025 },
    instruments: {
      shehnai: { gain: 0.9, pan: 0.12, width: 6, send: 0.32, octave: 1, lowCut: 200, vel: 0.85 },
      shehnai2: { gain: 0.6, pan: -0.38, width: -9, send: 0.36, octave: 1, lowCut: 200, vel: 0.72 },
      harmonium: { gain: 0.3, pan: -0.15, width: -6, send: 0.3, octave: 0, vel: 0.5 },
      tanpura: { gain: 0.5, pan: -0.25, width: -10, send: 0.3, octave: 0 },
      tabla: { gain: 0.6, pan: 0.28, width: 8, send: 0.14, sa: 'C#4', vel: 0.85 },
      bells: { gain: 0.45, pan: -0.5, width: -14, send: 0.55, octave: 3, vel: 0.7 },
      swarmandal: { gain: 0.45, pan: 0.45, width: 12, send: 0.5, octave: 2, vel: 0.7 },
    },
    dynamics: [[0, 0.72], [12, 0.8], [44, 0.92], [56, 1], [76, 0.96], [88, 0.95], [96, 0.85]],
    sections: [
      {
        // alaap: free phrases over the drone
        bars: 3,
        chords: 'I5:12',
        parts: {
          tanpura: 'drone',
          harmonium: 'sustain',
          swarmandal: '1+$:4 _:8',
          bells: '1:4 _:8',
          shehnai: '7-:1 2>:1 3:2 | 2^:0.5 3:0.5 4:1 3>:1 2:1 | 7-:0.5 2:0.5 1>~:3',
        },
      },
      {
        // sthayi: the gat with the tabla; the second shehnai answers in the held notes
        bars: 8,
        chords: 'I5:32',
        parts: {
          tanpura: 'drone',
          harmonium: 'sustain',
          tabla: 'keherwa',
          bells: '1:4 _:12 5:4 _:12',
          shehnai: '7-:0.5 2:0.5 3:1 3:0.5 4:0.5 5:1 | 4^:0.5 3:0.5 2:0.5 3:0.5 2>:2 | 7-:0.5 2:0.5 3:0.5 4:0.5 6:1 5:1 | 4:0.5 3:0.5 4:0.5 6:0.5 5~:2 | 3:0.5 4:0.5 6:0.5 7:0.5 1+:1.5 7:0.5 | 6:0.5 5:0.5 4:0.5 3:0.5 2*:1 1:1 | 7-:0.5 2:0.5 3:1 4:0.5 3:0.5 2:1 | 3:0.5 2:0.5 1>~:2 3:0.5 4:0.5',
          shehnai2: '_:4 | _:2 3:0.5 4:0.5 5:1 | _:4 | _:2 4:0.5 6:0.5 5:1 | _:4 | _:4 | _:4 | _:1 3:0.5 2:0.5 1:2',
        },
      },
      {
        // antara: the upper register
        bars: 8,
        chords: 'I5:32',
        parts: {
          tanpura: 'drone',
          harmonium: 'sustain',
          tabla: 'keherwa',
          swarmandal: '1+$:4 _:28',
          bells: '1+:4 _:12 3:4 _:12',
          shehnai: '6:0.5 7:0.5 1+:1 1+:0.5 2+:0.5 1+:1 | 7:0.5 2+:0.5 3+:1 2+^:0.5 1+:0.5 7:1 | 6:0.5 7:0.5 1+:0.5 2+:0.5 3+>:2 | 2+:0.5 1+:0.5 7:0.5 6:0.5 5~:2 | 4:0.5 6:0.5 1+:1 7:0.5 6:0.5 5:1 | 3:0.5 4:0.5 5:0.5 6:0.5 7:0.5 1+:0.5 2+:1 | 3+:1.5 2+:0.5 1+:0.5 7:0.5 6:0.5 5:0.5 | 4:0.5 3:0.5 2:1 1:1 _:1',
          shehnai2: '_:8 | _:2 1+:0.5 7:0.5 6:1 | _:2 4:0.5 3:0.5 5:1 | _:8 | _:4 | _:4',
        },
      },
      {
        // the sthayi again, closing with a tihai (G R S three times) that lands on sam with the tabla's
        bars: 3,
        chords: 'I5:12',
        parts: {
          tanpura: 'drone',
          harmonium: 'sustain',
          tabla: 'keherwa',
          bells: '5:4 _:8',
          shehnai: '7-:0.5 2:0.5 3:1 3:0.5 4:0.5 5:1 | 4^:0.5 3:0.5 2:0.5 3:0.5 2:1 3:0.5 2:0.5 | 1:0.5 _:0.5 3:0.5 2:0.5 1:0.5 _:0.5 3:0.5 2:0.5',
          shehnai2: '_:4 | _:3 3:0.5 2:0.5 | 1:0.5 _:0.5 3:0.5 2:0.5 1:0.5 _:0.5 3:0.5 2:0.5',
        },
      },
      {
        // sam: Sa held over the drone, ringing into the next time round
        bars: 2,
        chords: 'I5:8',
        parts: {
          tanpura: 'drone',
          harmonium: 'sustain',
          tabla: 'once:dha',
          swarmandal: '1$:8',
          bells: '1:8',
          shehnai: '1!:2 7-:0.5 2:0.5 1>~:5',
          shehnai2: '1:2 _:6',
        },
      },
    ],
  },
  {
    key: 'original-processional',
    title: 'Processional',
    mood: 'church wedding: a stately pipe organ theme over a walking pedal bass (I V6 vi I64 IV I6 ii7 V), a string episode in B minor through F#7 and E7, then the theme in full with timpani, bells and a plagal close through the minor iv',
    tonic: 'D3',
    scale: 'major',
    bpm: 68,
    meter: [4, 4],
    rit: { from: 72, factor: 0.86 },
    reverb: { room: 0.92, damp: 0.2, wet: 0.42, preDelay: 0.035 },
    instruments: {
      organ: { gain: 0.45, pan: -0.12, width: -8, send: 0.45, octave: 0, vel: 0.62, range: [-3, 16] },
      organ2: { gain: 0.5, pan: 0, width: 0, send: 0.35, octave: 0, vel: 0.7, lowCut: 40 },
      organ3: { gain: 0.85, pan: 0.1, width: 6, send: 0.42, octave: 1, vel: 0.75 },
      strings: { gain: 0.45, pan: 0.25, width: 10, send: 0.45, octave: 0, vel: 0.55 },
      highStrings: { gain: 0.7, pan: 0.3, width: 9, send: 0.45, octave: 1, vel: 0.75 },
      bells: { gain: 0.42, pan: 0.5, width: 12, send: 0.55, octave: 2, vel: 0.75 },
      timpani: { gain: 0.55, pan: -0.3, width: -6, send: 0.35, octave: -1, vel: 0.8 },
      cymbal: { gain: 0.5, pan: 0.35, width: 8, send: 0.4, vel: 0.75 },
    },
    dynamics: [[0, 0.62], [8, 0.72], [40, 0.82], [56, 0.85], [64, 0.95], [72, 1], [80, 0.95]],
    sections: [
      {
        bars: 2,
        chords: 'I:4 IV@1:2 I:2',
        parts: { organ: 'pad', organ2: 'root', bells: '1:4 _:4', organ3: '_:4 | _:2 5-:1 1:1' },
      },
      {
        bars: 8,
        chords: 'I:2 V/3:2 | vi:2 I/5:2 | IV:2 I/3:2 | ii7:2 V:2 | I:2 V/3:2 | vi:2 V7/V/3:2 | Vsus:2 V7:2 | I:4',
        parts: {
          organ: 'pad',
          organ2: 'root',
          strings: 'pad',
          bells: '1:4 _:12 1:4 _:12',
          organ3: '3:1.5 4:0.5 2:2 | 1:1.5 2:0.5 3:2 | 4:1 6:1 5:1.5 4:0.5 | 4:1 3:1 2:2 | 3:1.5 4:0.5 5:1.5 6:0.5 | 1+:1.5 7:0.5 6:2 | 5:2 4:1 2:1 | 1:4',
        },
      },
      {
        // the strings' episode in B minor
        bars: 6,
        chords: 'vi:4 | V7/vi:4 | vi:2 IV:2 | ii7:2 V7/V:2 | I/5:2 V7:2 | IV:2 V7:2',
        parts: {
          organ: 'pad',
          organ2: 'root',
          strings: 'pad',
          highStrings: '6:1.5 7:0.5 1+:1 6:1 | 7:1.5 1+:0.5 7:1 5#:1 | 6:2 6:1 7:1 | 1+:1.5 7:0.5 6:1 7:1 | 1+:2 5:1 7:1 | 6:1 5:1 4:1 7-:1',
          cymbal: 'once:. . . . . . . . . . . . . . . . . . . . . . swell',
        },
      },
      {
        // the theme in full, the minor iv, and Amen
        bars: 4,
        chords: 'I:2 V/3:2 | vi:2 I/5:2 | IV:2 iv:2 | Isus:2 I:2',
        parts: {
          organ: 'pad',
          organ2: 'root',
          strings: 'pad',
          organ3: '3:1.5 4:0.5 2:2 | 1:1.5 2:0.5 3:2 | 4:1 6:1 6b:1.5 5:0.5 | 1+:4',
          highStrings: '3:1.5 4:0.5 2:2 | 1:1.5 2:0.5 3:2 | 4:1 6:1 6b:1.5 5:0.5 | 1+:4',
          timpani: '1:2 5:2 | 1:2 5:2 | _:3 1?:0.25 1?:0.25 1:0.25 1:0.25 | 1!:4',
          bells: '1:4 _:8 1+:4',
        },
      },
    ],
  },
];

const CATALOGUE_B = [
  {
    key: 'original-mehfil-santoor',
    title: 'Mehfil-e-Santoor',
    mood: 'nikah: a santoor theme with tremolos, answered by a sarangi that then takes the melody (call and response), over a harmonium, tanpura and a soft daf; raga Bhairavi with its Phrygian cadences (II to i)',
    tonic: 'D3',
    scale: 'bhairavi',
    bpm: 70,
    meter: [4, 4],
    reverb: { room: 0.84, damp: 0.24, wet: 0.3, preDelay: 0.02 },
    instruments: {
      santoor: { gain: 1.3, pan: 0.15, width: 7, send: 0.36, octave: 2, vel: 0.85 },
      sarangi: { gain: 0.7, pan: -0.25, width: -8, send: 0.38, octave: 1, lowCut: 150, vel: 0.8 },
      harmonium: { gain: 0.32, pan: -0.35, width: -9, send: 0.3, octave: 0, vel: 0.5 },
      tanpura: { gain: 0.45, pan: 0.3, width: 10, send: 0.3, octave: 0 },
      daf: { gain: 0.6, pan: 0.1, width: 6, send: 0.2, vel: 0.7 },
    },
    dynamics: [[0, 0.7], [8, 0.8], [40, 0.92], [52, 1], [64, 0.95], [80, 0.92], [84, 0.82]],
    sections: [
      {
        bars: 2,
        chords: 'i:8',
        parts: {
          tanpura: 'drone',
          harmonium: 'sustain',
          santoor: '1:3 3:0.5 2:0.5 | 1:1 7-:0.5 6-:0.5 5-:2',
          sarangi: '_:1 5:1 4>:1 3:1 | 2&:2 1:2',
        },
      },
      {
        // the santoor's theme; the sarangi answers in its held notes
        bars: 8,
        chords: 'i:4 i:4 VI:4 iv:4 II:4 i:4 iv:4 II:2 i:2',
        parts: {
          tanpura: 'drone',
          harmonium: 'sustain',
          daf: 'soft',
          santoor: '1:0.5 2:0.5 3:0.5 4:0.5 5:1 4:0.5 3:0.5 | 4:0.5 3:0.5 2:0.5 3:0.5 1:2 | 1:0.5 3:0.5 5:0.5 6:0.5 7:1 6:0.5 5:0.5 | 6:0.5 5:0.5 4:0.5 3:0.5 4:2 | 5:0.5 6:0.5 7:0.5 1+:0.5 2+:1 1+:0.5 7:0.5 | 6:0.5 5:0.5 6:0.5 7:0.5 1+:2 | 7:0.5 6:0.5 5:0.5 4:0.5 3:0.5 2:0.5 3:1 | 2:0.5 1:0.5 7-:0.5 2:0.5 1:2',
          sarangi: '_:4 | _:2 5:0.5 4:0.5 3>:1 | _:4 | _:2 6:0.5 5:0.5 4>:1 | _:4 | _:2 2+:0.5 7:0.5 1+>:1 | _:4 | _:2 3:0.5 2&:0.5 1:1',
        },
      },
      {
        // the sarangi sings; the santoor answers
        bars: 6,
        chords: 'iv:4 i:4 VI:2 II:2 iv:2 II:2 i:2 vii:2 i:4',
        parts: {
          tanpura: 'drone',
          harmonium: 'sustain',
          daf: 'soft',
          sarangi: '5:1 6:0.5 5:0.5 4>:2 | 3:0.5 4:0.5 5:0.5 6:0.5 5>:2 | 6:0.5 7:0.5 1+:1 2+&:1 1+:1 | 7:0.5 6:0.5 5:1 4:0.5 3:0.5 2&:1 | 3:1 4:0.5 3:0.5 2:0.5 1:0.5 7-:1 | 1>~:2 _:2',
          santoor: '_:2 1+:0.5 7:0.5 6:1 | _:2 4:0.5 5:0.5 6:1 | _:4 | _:2 4:0.5 3:0.5 2:1 | _:4 | _:2 5-:0.5 7-:0.5 1:1',
        },
      },
      {
        bars: 4,
        chords: 'i:4 VI:2 II:2 iv:4 II:2 i:2',
        parts: {
          tanpura: 'drone',
          harmonium: 'sustain',
          daf: 'soft',
          santoor: '1:0.5 2:0.5 3:0.5 4:0.5 5:1 4:0.5 3:0.5 | 5:0.5 6:0.5 7:0.5 1+:0.5 2+:1 1+:1 | 7:0.5 6:0.5 5:0.5 4:0.5 3:0.5 2:0.5 1:0.5 2:0.5 | 3:1 2:1 1:2',
          sarangi: '_:4 | _:2 2+:0.5 7:0.5 1+:1 | _:4 | _:2 2:0.5 7-:0.5 1:1',
        },
      },
      {
        bars: 1,
        chords: 'i:4',
        parts: { tanpura: 'drone', harmonium: 'sustain', daf: 'once:dum', santoor: '1:4', sarangi: '5-:1 1>:3' },
      },
    ],
  },
  {
    key: 'original-anand-dawn',
    title: 'Anand Dawn',
    mood: 'Anand Karaj: a kirtan in 6/8 (bpm counts eighths: 80 to the dotted beat); the harmonium sings the line and the sangat (voices) answers it, rabab arpeggios, tabla dadra with tihais, and a plagal "Amen"; Bilawal',
    tonic: 'G3',
    scale: 'bilawal',
    bpm: 160,
    meter: [6, 8],
    reverb: { room: 0.8, damp: 0.24, wet: 0.28, preDelay: 0.02 },
    instruments: {
      harmonium: { gain: 0.85, pan: 0.1, width: 5, send: 0.3, octave: 1, vel: 0.85, timing: 0.012 },
      harmonium2: { gain: 0.28, pan: -0.35, width: -8, send: 0.3, octave: 0, vel: 0.5 },
      rabab: { gain: 0.6, pan: 0.38, width: 9, send: 0.28, octave: 0, vel: 0.75 },
      choir: { gain: 0.55, pan: -0.15, width: -10, send: 0.45, octave: 1, vel: 0.75 },
      choir2: { gain: 0.4, pan: 0.2, width: 12, send: 0.5, octave: 0, vel: 0.6 },
      tabla: { gain: 0.45, pan: -0.2, width: -6, send: 0.14, sa: 'G4', vel: 0.8 },
    },
    dynamics: [[0, 0.7], [12, 0.78], [60, 0.85], [108, 0.95], [156, 1], [180, 0.95], [192, 0.85]],
    sections: [
      {
        bars: 2,
        chords: 'I:12',
        parts: { harmonium2: 'sustain', rabab: 'loop: 1:1 5-:1 1:1 3:1 1:1 5-:1', harmonium: '5:3 4:1 3:1 2:1 | 1:6' },
      },
      {
        // the line (call)
        bars: 8,
        chords: 'I:6 I:6 IV:6 V7:6 IV:6 I:6 V:6 I:6',
        parts: {
          harmonium2: 'sustain',
          rabab: 'arp',
          tabla: 'dadra',
          harmonium: '5-:2 1:1 2:2 3:1 | 3^:2 2:1 1:3 | 1:2 3:1 4:3 | 5:3 4:1 3:1 2:1 | 4:2 5:1 6:2 5:1 | 5^:2 4:1 3:3 | 2:2 3:1 2:1 1:1 7-:1 | 1:6',
        },
      },
      {
        // the sangat answers; the harmonium fills the held notes
        bars: 8,
        chords: 'I:6 vi:6 IV:6 V7:6 IV:6 I:6 V7:6 I:6',
        parts: {
          harmonium2: 'sustain',
          rabab: 'arp',
          tabla: 'dadra',
          choir: '5-:2 1:1 2:2 3:1 | 3:2 2:1 1:3 | 1:2 3:1 4:3 | 5:3 4:1 3:1 2:1 | 4:2 5:1 6:2 5:1 | 5:2 4:1 3:3 | 2:2 3:1 2:1 1:1 7-:1 | 1:6',
          harmonium: '_:6 | _:3 5:1 4:1 3:1 | _:6 | _:6 | _:6 | _:3 6:1 5:1 4:1 | _:6 | _:3 3:1 4:1 5:1',
        },
      },
      {
        // antara: the upper register over the voices' chords
        bars: 8,
        chords: 'I:6 V:6 IV:6 I:6 IV:6 ii:6 V:6 V7:6',
        parts: {
          harmonium2: 'sustain',
          rabab: 'arp',
          tabla: 'dadra',
          choir2: 'sustain',
          harmonium: '5:2 6:1 1+:2 1+:1 | 2+:2 1+:1 7:2 6:1 | 5:2 6:1 7:2 1+:1 | 1+:3 7:1 6:1 5:1 | 6:2 5:1 4:2 3:1 | 4:2 5:1 6:3 | 5:2 4:1 3:1 2:1 3:1 | 2:6',
        },
      },
      {
        // everyone sings the line; the tabla's tihai lands on the last sam
        bars: 4,
        chords: 'I:6 I:6 V7:6 I:6',
        parts: {
          harmonium2: 'sustain',
          rabab: 'arp',
          tabla: 'dadra',
          choir2: 'sustain',
          harmonium: '5-:2 1:1 2:2 3:1 | 3^:2 2:1 1:3 | 2:2 3:1 2:1 1:1 7-:1 | 1:6',
          choir: '5-:2 1:1 2:2 3:1 | 3:2 2:1 1:3 | 2:2 3:1 2:1 1:1 7-:1 | 1:6',
        },
      },
      {
        // Amen
        bars: 2,
        chords: 'IV:6 I:6',
        parts: {
          harmonium2: 'sustain',
          choir2: 'sustain',
          tabla: 'once:dha',
          rabab: '4-:3 6-:3 | 1:6',
          harmonium: '_:3 6:1 5:1 4:1 | 3:6',
          choir: '_:6 | 1:6',
        },
      },
    ],
  },
  {
    key: 'original-prabhat-bansuri',
    title: 'Prabhat Bansuri',
    mood: 'naming ceremony at dawn: a bansuri alaap over tanpura and swarmandal, a jor where a second flute answers, then a slow gat with a soft tabla and a tihai home; raga Ahir Bhairav',
    tonic: 'E3',
    scale: 'ahirBhairav',
    bpm: 60,
    meter: [4, 4],
    reverb: { room: 0.88, damp: 0.22, wet: 0.38, preDelay: 0.03 },
    instruments: {
      bansuri: { gain: 0.95, pan: 0.08, width: 5, send: 0.48, octave: 1, vel: 0.78 },
      bansuri2: { gain: 0.6, pan: -0.35, width: -9, send: 0.5, octave: 1, vel: 0.68 },
      tanpura: { gain: 0.55, pan: -0.2, width: -10, send: 0.35, octave: 0 },
      swarmandal: { gain: 0.4, pan: 0.4, width: 12, send: 0.55, octave: 2, vel: 0.6 },
      tabla: { gain: 0.42, pan: 0.25, width: 7, send: 0.16, sa: 'E4', vel: 0.7 },
      templeBell: { gain: 0.42, pan: -0.45, width: -12, send: 0.6, octave: 1, vel: 0.6 },
    },
    dynamics: [[0, 0.68], [16, 0.78], [32, 0.9], [48, 1], [64, 0.95], [72, 0.82]],
    sections: [
      {
        // alaap
        bars: 4,
        parts: {
          tanpura: 'drone',
          templeBell: '1:16',
          swarmandal: '1+$:4 _:12',
          bansuri: '_:1 7-:1 1>:2 | 2&:1.5 1:0.5 7-:1 6-:1 | 7-:0.5 1:0.5 2&:1 3>:2 | 2:1 1>~:3',
          bansuri2: '_:14 7-:1 1:1',
        },
      },
      {
        // jor: the pulse arrives; the second flute answers
        bars: 4,
        parts: {
          tanpura: 'drone',
          swarmandal: '1$:4 _:12',
          bansuri: '3:0.5 4:0.5 5:1 4:0.5 3:0.5 2&:1 | 1:0.5 2:0.5 3:0.5 4:0.5 5:2 | 6:0.5 7:0.5 1+:1 7:0.5 6:0.5 5:1 | 4:0.5 3:0.5 2:1 1:2',
          bansuri2: '_:4 | _:2 3:0.5 2:0.5 1:1 | _:4 | _:2 7-:0.5 2:0.5 1:1',
        },
      },
      {
        // gat with the tabla; a tihai (n r S) lands on the last sam
        bars: 8,
        parts: {
          tanpura: 'drone',
          tabla: 'keherwaSlow',
          swarmandal: '1+$:4 _:28',
          bansuri: '5:1 6:0.5 7:0.5 1+:1 7:0.5 6:0.5 | 5:1 4:0.5 3:0.5 2&:1 1:1 | 3:1.5 4:0.5 5:0.5 6:0.5 5:1 | 4:0.5 3:0.5 2:0.5 3:0.5 1:2 | 6:0.5 7:0.5 1+:0.5 2+&:0.5 1+:2 | 7:0.5 6:0.5 5:1 4:0.5 3:0.5 2:1 | 3:0.5 4:0.5 5:0.5 4:0.5 3:0.5 2:0.5 7-:0.5 2:0.5 | 1:0.5 _:0.5 7-:0.5 2:0.5 1:0.5 _:0.5 7-:0.5 2:0.5',
          bansuri2: '_:4 | _:4 | _:4 | _:2 7-:0.5 2:0.5 1:1 | _:2 6-:0.5 7-:0.5 1:1 | _:4 | _:3 7-:0.5 2:0.5 | 1:0.5 _:0.5 7-:0.5 2:0.5 1:0.5 _:0.5 7-:0.5 2:0.5',
        },
      },
      {
        bars: 2,
        parts: {
          tanpura: 'drone',
          tabla: 'once:dha',
          swarmandal: '1$:8',
          templeBell: '1:8',
          bansuri: '1!:2 3:0.5 2&:0.5 1:1 | 7-:1 1>~:3',
          bansuri2: '1:2 _:6',
        },
      },
    ],
  },
  {
    key: 'original-ganga-bells',
    title: 'Ganga Bells',
    mood: 'mundan at a ghat: temple bells and manjira, a bansuri bhajan with andolan on the komal re and dha over a tanpura and harmonium drone, tabla in the bhajan theka; raga Bhairav',
    tonic: 'C3',
    scale: 'bhairav',
    bpm: 64,
    meter: [4, 4],
    reverb: { room: 0.86, damp: 0.22, wet: 0.34, preDelay: 0.025 },
    instruments: {
      templeBell: { gain: 0.75, pan: -0.3, width: -10, send: 0.55, octave: 1, vel: 0.75 },
      bells: { gain: 0.55, pan: 0.5, width: 14, send: 0.6, octave: 3, vel: 0.65 },
      bansuri: { gain: 0.95, pan: 0.1, width: 6, send: 0.45, octave: 1, vel: 0.75 },
      harmonium: { gain: 0.3, pan: -0.25, width: -8, send: 0.35, octave: 0, vel: 0.5 },
      tanpura: { gain: 0.5, pan: 0.3, width: 9, send: 0.35, octave: 0, interval: 0.8 },
      manjira: { gain: 0.45, pan: 0.35, width: 10, send: 0.4, vel: 0.7 },
      tabla: { gain: 0.45, pan: -0.15, width: -6, send: 0.16, sa: 'C4', vel: 0.75 },
    },
    dynamics: [[0, 0.7], [8, 0.8], [32, 0.95], [48, 1], [56, 0.95], [64, 0.85]],
    sections: [
      {
        bars: 2,
        chords: 'I5:8',
        parts: { tanpura: 'drone', harmonium: 'sustain', templeBell: '1:8', bells: '_:4 5:1 _:3', bansuri: '_:2 7-:1 1:1 | 2&:2 1:2' },
      },
      {
        bars: 6,
        chords: 'I5:24',
        parts: {
          tanpura: 'drone',
          harmonium: 'sustain',
          tabla: 'bhajani',
          manjira: 'bhajan',
          templeBell: '1:8 _:8 5:8',
          bells: '_:20 5:1 3:1 1:2',
          bansuri: '1:0.5 2&:0.5 3:1 4:0.5 3:0.5 2&:1 | 3:0.5 4:0.5 5:1 6&:1 5:1 | 4:0.5 5:0.5 6:0.5 7:0.5 1+:2 | 7:0.5 1+:0.5 6&:1 5:0.5 4:0.5 3:1 | 4:1 3:0.5 2&:0.5 1:1 7-:1 | 1:2 _:2',
        },
      },
      {
        // the upper register; a tihai (m G r S) lands on the coda
        bars: 6,
        chords: 'I5:24',
        parts: {
          tanpura: 'drone',
          harmonium: 'sustain',
          tabla: 'bhajani',
          manjira: 'aarti',
          templeBell: '1:8 _:16',
          bells: '1+:4 _:20',
          bansuri: '5:0.5 6&:0.5 7:1 1+:1 2+&:1 | 1+:0.5 7:0.5 1+:0.5 2+:0.5 3+:2 | 2+&:1 1+:0.5 7:0.5 6&:1 5:1 | 4:0.5 5:0.5 6:0.5 5:0.5 4:0.5 3:0.5 2:0.5 3:0.5 | 4:1 3:0.5 4:0.5 3:0.5 2:0.5 1:0.5 _:0.5 | 4:0.5 3:0.5 2:0.5 1:0.5 _:0.5 4:0.5 3:0.5 2:0.5',
        },
      },
      {
        bars: 2,
        chords: 'I5:8',
        parts: {
          tanpura: 'drone',
          harmonium: 'sustain',
          tabla: 'once:dha',
          manjira: 'once:ting',
          templeBell: '1:8',
          bells: '1:4 5-:4',
          bansuri: '1!:2 3:0.5 2&:0.5 1:1 | 7-:1 1>~:3',
        },
      },
    ],
  },
  {
    key: 'original-gayatri-drone',
    title: 'Gayatri Drone',
    mood: 'thread ceremony: a conch call, a tanpura drone and a low chant-like voice, bansuri phrases that rise and settle, swarmandal shimmer, a temple bell and slow manjira; raga Durga',
    tonic: 'C#3',
    scale: 'durga',
    bpm: 56,
    meter: [4, 4],
    reverb: { room: 0.88, damp: 0.22, wet: 0.38, preDelay: 0.03 },
    instruments: {
      conch: { gain: 0.7, pan: 0, width: 4, send: 0.5, octave: 1, vel: 0.8 },
      tanpura: { gain: 0.55, pan: -0.3, width: -9, send: 0.35, octave: 0 },
      chantPad: { gain: 0.35, pan: 0.2, width: 12, send: 0.45, octave: 0, vel: 0.7 },
      bansuri: { gain: 0.85, pan: 0.1, width: 6, send: 0.5, octave: 1, vel: 0.72 },
      swarmandal: { gain: 0.42, pan: 0.45, width: 12, send: 0.55, octave: 2, vel: 0.6 },
      templeBell: { gain: 0.45, pan: -0.4, width: -12, send: 0.6, octave: 1, vel: 0.6 },
      manjira: { gain: 0.35, pan: 0.3, width: 10, send: 0.4, vel: 0.6 },
    },
    dynamics: [[0, 0.75], [8, 0.82], [24, 0.95], [40, 1], [48, 0.88], [56, 0.8]],
    sections: [
      {
        // the conch's call
        bars: 2,
        chords: 'I5:8',
        parts: { conch: '1:6 _:2', tanpura: 'drone', chantPad: 'sustain', templeBell: '1:8' },
      },
      {
        bars: 4,
        chords: 'I5:16',
        parts: {
          tanpura: 'drone',
          chantPad: 'sustain',
          manjira: 'slow',
          swarmandal: '1+$:4 _:12',
          bansuri: '_:1 1:0.5 2:0.5 3:1 2>:1 | 3:0.5 4:0.5 5:1 4>:2 | 5:0.5 6:0.5 5:0.5 4:0.5 3:1 2:1 | 1>~:3 _:1',
        },
      },
      {
        // the phrase rises to the upper Sa over Pa
        bars: 4,
        chords: 'I5:8 IV5:4 I5:4',
        parts: {
          tanpura: 'drone',
          chantPad: 'sustain',
          manjira: 'slow',
          templeBell: '_:8 4:8',
          bansuri: '4:0.5 5:0.5 6:1 7:1 6>:1 | 5:0.5 6:0.5 5:0.5 4:0.5 3:2 | 4:1 3:0.5 2:0.5 1:1 2:1 | 3>~:2 2:1 1:1',
        },
      },
      {
        // settling: the phrase falls home and the swarmandal closes the circle
        bars: 4,
        chords: 'I5:16',
        parts: {
          tanpura: 'drone',
          chantPad: 'sustain',
          manjira: 'slow',
          templeBell: '1:16',
          swarmandal: '_:12 1$:4',
          bansuri: '6:1 5:1 4:1 3:1 | 4:1 3:1 2:2 | 3:0.5 2:0.5 1:1 5-:1 1:1 | 1~:4',
        },
      },
    ],
  },
  {
    key: 'original-shubh-dhol',
    title: 'Shubh Dhol',
    mood: 'housewarming: a festive shehnai over dhol keherwa, the harmonium answering its phrases, chimta jingles and bells, a tihai into the last theme and a dhol break; Bilawal',
    tonic: 'A3',
    scale: 'bilawal',
    bpm: 96,
    meter: [4, 4],
    reverb: { room: 0.76, damp: 0.25, wet: 0.22, preDelay: 0.015 },
    instruments: {
      shehnai: { gain: 0.85, pan: 0.1, width: 6, send: 0.3, octave: 1, lowCut: 220, vel: 0.85 },
      harmonium: { gain: 0.45, pan: -0.3, width: -8, send: 0.3, octave: 1, vel: 0.72 },
      harmonium2: { gain: 0.24, pan: -0.1, width: -6, send: 0.3, octave: 0, vel: 0.5 },
      dhol: { gain: 0.62, pan: -0.15, width: -8, send: 0.14, vel: 0.85 },
      chimta: { gain: 0.42, pan: 0.35, width: 10, send: 0.25, vel: 0.75 },
      bells: { gain: 0.42, pan: 0.45, width: 12, send: 0.5, octave: 2, vel: 0.7 },
    },
    dynamics: [[0, 0.82], [8, 0.86], [40, 0.95], [72, 1], [88, 0.95], [96, 0.88]],
    sections: [
      {
        // the dhol calls everyone in
        bars: 2,
        chords: 'I:8',
        parts: { dhol: 'keherwa', harmonium2: 'sustain', bells: '1:4 5:4' },
      },
      {
        bars: 8,
        chords: 'I:4 | IV:2 I:2 | ii:4 | V:2 I:2 | vi:2 IV:2 | V:4 | IV:2 V:2 | I:4',
        parts: {
          dhol: 'keherwa',
          harmonium2: 'sustain',
          bells: '1:4 _:12 5:4 _:12',
          shehnai: '5:0.5 5:0.5 6:0.5 5:0.5 3:1 5:1 | 6:0.5 1+:0.5 6:0.5 5:0.5 5>:2 | 4:0.5 4:0.5 5:0.5 4:0.5 2:1 4:1 | 5:0.5 6:0.5 5:0.5 4:0.5 3>:2 | 3:0.5 5:0.5 6:0.5 1+:0.5 2+:1 1+:1 | 7:0.5 6:0.5 5:0.5 6:0.5 5>:2 | 4:0.5 3:0.5 2:0.5 3:0.5 4:0.5 3:0.5 2:0.5 7-:0.5 | 1:2 _:2',
          harmonium: '_:4 | _:2 3:0.5 4:0.5 5:1 | _:4 | _:2 2:0.5 3:0.5 1:1 | _:4 | _:2 1+:0.5 7:0.5 6:1 | _:4 | _:2 5-:0.5 6-:0.5 7-:0.5 1:0.5',
        },
      },
      {
        // call and response: the shehnai calls, the harmonium echoes lower; a tihai (P m G R S) into the theme
        bars: 8,
        chords: 'I:2 V:2 | IV:2 I:2 | I:2 V:2 | IV:2 I:2 | vi:2 IV:2 | V:2 I:2 | IV:2 V:2 | V:4',
        parts: {
          dhol: 'keherwa',
          chimta: 'folk',
          harmonium2: 'sustain',
          bells: '1+:4 _:28',
          shehnai: '1+:1 2+:0.5 1+:0.5 7:0.5 6:0.5 5:1 | 6:0.5 7:0.5 1+:1 1+>~:2 | _:8 | 3+:1 2+:0.5 1+:0.5 2+:0.5 1+:0.5 6:1 | 5:0.5 6:0.5 5:0.5 4:0.5 3:2 | 3:0.5 2:0.5 1:1 5:0.5 4:0.5 3:0.5 2:0.5 | 1:0.5 _:0.5 5:0.5 4:0.5 3:0.5 2:0.5 1:0.5 _:0.5',
          harmonium: '_:8 | 1:1 2:0.5 1:0.5 7-:0.5 6-:0.5 5-:1 | 6-:0.5 7-:0.5 1:1 1:2 | _:8 | 3:0.5 2:0.5 1:1 5:0.5 4:0.5 3:0.5 2:0.5 | 1:0.5 _:0.5 5:0.5 4:0.5 3:0.5 2:0.5 1:0.5 _:0.5',
        },
      },
      {
        bars: 4,
        chords: 'I:4 | IV:2 I:2 | IV:2 V:2 | I:4',
        parts: {
          dhol: 'keherwa',
          chimta: 'folk',
          harmonium2: 'sustain',
          bells: '5:4 _:12',
          shehnai: '5!:0.5 5:0.5 6:0.5 5:0.5 3:1 5:1 | 6:0.5 1+:0.5 6:0.5 5:0.5 5>:2 | 4:0.5 3:0.5 2:0.5 3:0.5 4:0.5 3:0.5 2:0.5 7-:0.5 | 1:4',
          harmonium: '_:4 | _:2 3:0.5 4:0.5 5:1 | 4:0.5 3:0.5 2:0.5 3:0.5 4:0.5 3:0.5 2:0.5 7-:0.5 | 1:4',
        },
      },
      {
        // the shehnai holds Sa; the dhol's break
        bars: 2,
        chords: 'I:8',
        parts: {
          harmonium2: 'sustain',
          chimta: 'once:jk',
          bells: '1:8',
          shehnai: '1~:8',
          dhol: 'once:dha . . . . . . . dha . . . dha . . . dha . ta ta dha . ta ta dha ta dha ta dha! ta dha! ta',
        },
      },
    ],
  },
  {
    key: 'original-sandhya-aarti',
    title: 'Sandhya Aarti',
    mood: 'puja at dusk: a conch, temple bells, a hand bell and manjira; the harmonium leads an aarti and the voices answer each line, a bhajan theka on the tabla, and a plagal close as the conch sounds again; Khamaj',
    tonic: 'F3',
    scale: 'khamaj',
    bpm: 84,
    meter: [4, 4],
    reverb: { room: 0.86, damp: 0.22, wet: 0.34, preDelay: 0.025 },
    instruments: {
      harmonium: { gain: 0.85, pan: 0.05, width: 5, send: 0.3, octave: 1, vel: 0.85, timing: 0.012 },
      harmonium2: { gain: 0.26, pan: -0.4, width: -9, send: 0.3, octave: 0, vel: 0.5 },
      choir: { gain: 0.55, pan: -0.15, width: -10, send: 0.45, octave: 1, vel: 0.75 },
      tabla: { gain: 0.55, pan: 0.3, width: 8, send: 0.14, sa: 'F4', vel: 0.8 },
      manjira: { gain: 0.48, pan: 0.4, width: 10, send: 0.35, vel: 0.75 },
      templeBell: { gain: 0.5, pan: -0.25, width: -12, send: 0.5, octave: 1, vel: 0.75 },
      bells: { gain: 0.3, pan: 0.5, width: 14, send: 0.55, octave: 3, vel: 0.6 },
      conch: { gain: 0.6, pan: 0, width: 3, send: 0.5, octave: 1, vel: 0.8 },
    },
    dynamics: [[0, 0.72], [8, 0.8], [40, 0.95], [56, 1], [72, 0.98], [84, 0.85]],
    sections: [
      {
        bars: 2,
        chords: 'I:8',
        parts: { conch: '1:6 _:2', templeBell: '1:8', harmonium2: 'sustain' },
      },
      {
        // each line twice: the harmonium leads, the voices answer
        bars: 8,
        chords: 'I:4 IV:2 ii:2 | I:4 IV:2 ii:2 | I:2 VII:2 IV:2 I:2 | I:2 VII:2 IV:2 I:2',
        parts: {
          harmonium2: 'sustain',
          tabla: 'bhajani',
          manjira: 'aarti',
          bells: 'loop: 1?:1',
          templeBell: '1:16 1:16',
          harmonium: '3:1 3:0.5 4:0.5 5:1 5:1 | 6:0.5 5:0.5 4:0.5 3:0.5 2:2 | 3:1 3:0.5 4:0.5 5:1 5:1 | 6:0.5 5:0.5 4:0.5 3:0.5 2:2 | 5:1 5:0.5 6:0.5 7:1 6:0.5 5:0.5 | 4:0.5 3:0.5 2:0.5 3:0.5 1:2 | 5:1 5:0.5 6:0.5 7:1 6:0.5 5:0.5 | 4:0.5 3:0.5 2:0.5 3:0.5 1:2',
          choir: '_:8 | 3:1 3:0.5 4:0.5 5:1 5:1 | 6:0.5 5:0.5 4:0.5 3:0.5 2:2 | _:8 | 5:1 5:0.5 6:0.5 7:1 6:0.5 5:0.5 | 4:0.5 3:0.5 2:0.5 3:0.5 1:2',
        },
      },
      {
        // antara: everyone together, up to the upper Sa; a tihai (G R S) lands on the last line
        bars: 8,
        chords: 'I:4 | VII:2 I:2 | IV:2 ii:2 | v:2 I:2 | I:4 | I:2 IV:2 | IV:2 I:2 | I:4',
        parts: {
          harmonium2: 'sustain',
          tabla: 'bhajani',
          manjira: 'aarti',
          bells: 'loop: 1?:1',
          templeBell: '1:16 5:16',
          harmonium: '5:1 6:0.5 7:0.5 1+:1 1+:1 | 2+:0.5 1+:0.5 7:0.5 6:0.5 5:2 | 6:1 6:0.5 5:0.5 4:1 3:1 | 4:0.5 3:0.5 2:0.5 3:0.5 1:2 | 5:1 6:0.5 7:0.5 1+:1 2+:1 | 3+:0.5 2+:0.5 1+:0.5 7:0.5 6:2 | 5:0.5 6:0.5 5:0.5 4:0.5 3:1 3:0.5 2:0.5 | 1:0.5 _:0.5 3:0.5 2:0.5 1:0.5 _:0.5 3:0.5 2:0.5',
          choir: '5:1 6:0.5 7:0.5 1+:1 1+:1 | 2+:0.5 1+:0.5 7:0.5 6:0.5 5:2 | 6:1 6:0.5 5:0.5 4:1 3:1 | 4:0.5 3:0.5 2:0.5 3:0.5 1:2 | 5:1 6:0.5 7:0.5 1+:1 2+:1 | 3+:0.5 2+:0.5 1+:0.5 7:0.5 6:2 | 5:0.5 6:0.5 5:0.5 4:0.5 3:1 3:0.5 2:0.5 | 1:0.5 _:0.5 3:0.5 2:0.5 1:0.5 _:0.5 3:0.5 2:0.5',
        },
      },
      {
        // jai: the last line, the plagal close and the conch
        bars: 3,
        chords: 'I:4 IV:4 I:4',
        parts: {
          harmonium2: 'sustain',
          tabla: 'once:dha',
          manjira: 'once:ting',
          templeBell: '1:12',
          bells: '1:4 _:8',
          conch: '_:4 1:8',
          harmonium: '1!:4 | 4:2 3:2 | 1:4',
          choir: '1:4 | 4:2 3:2 | 1:4',
        },
      },
    ],
  },
  {
    key: 'original-roshni-dhamaal',
    title: 'Roshni Dhamaal',
    mood: 'festival night: a syncopated sitar tune with quick bansuri answers, dhol bhangra and chaal, tasha rolls, claps and ghungroo; the flute and sitar trade lines and a tihai drops into the last hits; Bhupali (major pentatonic)',
    tonic: 'G3',
    scale: 'majorPentatonic',
    bpm: 104,
    meter: [4, 4],
    reverb: { room: 0.72, damp: 0.28, wet: 0.2, preDelay: 0.012 },
    instruments: {
      sitar: { gain: 1.4, pan: 0.1, width: 6, send: 0.28, octave: 1, vel: 0.85 },
      bansuri: { gain: 0.5, pan: -0.32, width: -9, send: 0.3, octave: 1, vel: 0.8 },
      harmonium2: { gain: 0.2, pan: -0.1, width: -6, send: 0.3, octave: 0, vel: 0.5 },
      dhol: { gain: 0.55, pan: -0.15, width: -8, send: 0.12, vel: 0.85 },
      tasha: { gain: 0.5, pan: 0.4, width: 10, send: 0.2, vel: 0.7 },
      claps: { gain: 0.65, pan: 0.3, width: 6, send: 0.35, vel: 0.8 },
      ghungroo: { gain: 0.42, pan: -0.4, width: -10, send: 0.3, vel: 0.7 },
      bells: { gain: 0.38, pan: -0.5, width: -12, send: 0.5, octave: 2, vel: 0.7 },
    },
    dynamics: [[0, 0.85], [8, 0.9], [40, 1], [72, 1], [96, 0.95], [104, 0.88]],
    sections: [
      {
        bars: 2,
        chords: 'I5:8',
        parts: { dhol: 'bhangra', claps: 'two', harmonium2: 'sustain', bells: '1:4 _:4' },
      },
      {
        // the sitar's tune; the flute drops two-note answers into its rests
        bars: 8,
        chords: 'I5:32',
        parts: {
          dhol: 'bhangra',
          claps: 'backbeat',
          ghungroo: 'eighths',
          harmonium2: 'sustain',
          bells: 'loop: 6:1 _:3 4:1 _:3',
          sitar: '1:0.5 2:0.5 3:0.5 4:1 3:0.5 2:1 | 3:0.5 2:0.5 1:1 _:1 5-:0.5 1:0.5 | 2:0.5 3:0.5 4:0.5 5:1 4:0.5 3:1 | 4:0.5 3:0.5 2:1 _:1 3:0.5 4:0.5 | 5:0.5 6:0.5 5:0.5 4:1 3:0.5 4:1 | 5:0.5 4:0.5 3:1 _:1 2:0.5 3:0.5 | 4:0.5 3:0.5 2:0.5 1:0.5 2:0.5 3:0.5 2:0.5 1:0.5 | 5-:0.5 1:0.5 2:1 1>~:2',
          bansuri: "_:4 | _:2 3':0.5 4':0.5 _:1 | _:4 | _:2 5':0.5 6':0.5 _:1 | _:4 | _:2 3':0.5 2':0.5 _:1 | _:4 | _:4",
        },
      },
      {
        // the flute and the sitar trade lines over the chaal and the tasha
        bars: 8,
        chords: 'I5:32',
        parts: {
          dhol: 'chaal',
          tasha: 'roll',
          claps: 'offbeat',
          ghungroo: 'eighths',
          harmonium2: 'sustain',
          bansuri: '6:1 5:0.5 6:0.5 7:1 6:1 | 5:0.5 4:0.5 5:0.5 6:0.5 5:2 | _:8 | 7:1 6:0.5 7:0.5 8:1 7:1 | 6:0.5 5:0.5 4:0.5 5:0.5 6:2 | 5:0.5 4:0.5 3:0.5 2:0.5 3:0.5 2:0.5 1:1 | 2:0.5 3:0.5 4:0.5 5:0.5 6:2',
          sitar: '_:8 | 1:1 5-:0.5 1:0.5 2:1 1:1 | 5-:0.5 4-:0.5 5-:0.5 1:0.5 5-:2 | _:8 | 5:0.5 4:0.5 3:0.5 2:0.5 3:0.5 2:0.5 1:1 | 2:0.5 3:0.5 4:0.5 5:0.5 6:2',
        },
      },
      {
        // the tune again; a tihai (P G R) lands on the last hits
        bars: 6,
        chords: 'I5:24',
        parts: {
          dhol: 'bhangra',
          tasha: 'roll',
          claps: 'backbeat',
          ghungroo: 'eighths',
          harmonium2: 'sustain',
          sitar: '1:0.5 2:0.5 3:0.5 4:1 3:0.5 2:1 | 3:0.5 2:0.5 1:1 _:1 5-:0.5 1:0.5 | 2:0.5 3:0.5 4:0.5 5:1 4:0.5 3:1 | 4:0.5 3:0.5 2:1 _:1 3:0.5 4:0.5 | 5:0.5 4:0.5 3:1 2:1 4:0.5 3:0.5 | 2:0.5 _:0.5 4:0.5 3:0.5 2:0.5 _:0.5 4:0.5 3:0.5',
          bansuri: "_:4 | _:2 3':0.5 4':0.5 _:1 | _:4 | _:2 5':0.5 6':0.5 _:1 | _:3 4:0.5 3:0.5 | 2:0.5 _:0.5 4:0.5 3:0.5 2:0.5 _:0.5 4:0.5 3:0.5",
        },
      },
      {
        bars: 2,
        chords: 'I5:8',
        parts: {
          harmonium2: 'sustain',
          sitar: '2!:1 1:3 | _:4',
          bansuri: '2!:1 1:3 | _:4',
          bells: '6:4 _:4',
          tasha: 'once:x . . . . . . . . . . . . . . . x . x . x . x . x x x x x x x! x',
          dhol: 'once:dha! . . . . . . . dha . . . dha . . . dha . na . dha . na . dha na dha na dha na dha! na',
          claps: 'once:x . . . . . x x',
        },
      },
    ],
  },
  {
    key: 'original-mela-chowk',
    title: 'Mela Chowk',
    mood: 'community fair: a twangy tumbi tune, an algoza (a flute over its own drone pipe) that sings the second strain while the tumbi answers, dhol chaal and bhangra, chimta and claps; Khamaj',
    tonic: 'D3',
    scale: 'khamaj',
    bpm: 100,
    meter: [4, 4],
    reverb: { room: 0.72, damp: 0.28, wet: 0.2, preDelay: 0.012 },
    instruments: {
      folkPluck: { gain: 1.4, pan: 0.1, width: 6, send: 0.28, octave: 2, vel: 0.85 },
      bansuri: { gain: 0.6, pan: -0.3, width: -8, send: 0.35, octave: 1, vel: 0.8 },
      bansuri2: { gain: 0.26, pan: -0.36, width: -10, send: 0.35, octave: 1, vel: 0.55 },
      harmonium2: { gain: 0.24, pan: -0.15, width: -6, send: 0.3, octave: 0, vel: 0.5 },
      dhol: { gain: 0.6, pan: -0.2, width: -8, send: 0.12, vel: 0.85 },
      chimta: { gain: 0.42, pan: 0.35, width: 10, send: 0.25, vel: 0.75 },
      claps: { gain: 0.62, pan: 0.35, width: 8, send: 0.35, vel: 0.8 },
    },
    dynamics: [[0, 0.82], [4, 0.88], [36, 0.95], [68, 1], [92, 0.95], [96, 0.88]],
    sections: [
      {
        bars: 1,
        chords: 'I:4',
        parts: { dhol: 'chaal', harmonium2: 'sustain' },
      },
      {
        bars: 8,
        chords: 'I:4 I:4 IV:4 I:4 I:2 VII:2 I:4 IV:2 v:2 I:4',
        parts: {
          dhol: 'chaal',
          chimta: 'folk',
          claps: 'backbeat',
          harmonium2: 'sustain',
          folkPluck: '5-:0.5 1:0.5 2:0.5 3:0.5 3:1 3:1 | 4:0.5 3:0.5 2:0.5 1:0.5 2:2 | 1:0.5 2:0.5 3:0.5 4:0.5 5:1 5:1 | 6:0.5 5:0.5 4:0.5 3:0.5 4:2 | 5:0.5 6:0.5 7:0.5 6:0.5 5:1 4:1 | 3:0.5 4:0.5 5:0.5 4:0.5 3:2 | 2:0.5 3:0.5 4:0.5 3:0.5 2:0.5 1:0.5 7-:0.5 1:0.5 | 2:0.5 7-:0.5 1:1 _:2',
        },
      },
      {
        // the algoza sings over its drone pipe; the tumbi answers in the gaps
        bars: 8,
        chords: 'I:4 VII:4 IV:4 I:4 I:4 IV:2 v:2 I:2 VII:2 I:4',
        parts: {
          dhol: 'bhangra',
          chimta: 'folk',
          claps: 'chaal',
          harmonium2: 'sustain',
          bansuri: '5:1 6:0.5 7:0.5 1+:2 | 7:0.5 6:0.5 5:1 _:2 | 4:1 5:0.5 6:0.5 5:2 | 4:0.5 3:0.5 2:1 _:2 | 3:1 4:0.5 5:0.5 6:1 5:1 | 4:0.5 3:0.5 4:0.5 5:0.5 3:2 | 2:0.5 3:0.5 4:0.5 3:0.5 2:0.5 3:0.5 2:0.5 7-:0.5 | 1:2 _:2',
          bansuri2: 'loop: 1:4',
          folkPluck: '_:4 | _:2 5:0.5 4:0.5 3:0.5 2:0.5 | _:4 | _:2 1:0.5 2:0.5 3:0.5 4:0.5 | _:4 | _:4 | _:4 | _:2 5-:0.5 7-:0.5 1:0.5 2:0.5',
        },
      },
      {
        // the tune again, both together, ending on a stop
        bars: 6,
        chords: 'I:4 I:4 IV:4 I:4 I:2 VII:2 I:4',
        parts: {
          dhol: 'chaal',
          chimta: 'folk',
          claps: 'backbeat',
          harmonium2: 'sustain',
          bansuri2: 'loop: 1:4',
          folkPluck: '5-:0.5 1:0.5 2:0.5 3:0.5 3:1 3:1 | 4:0.5 3:0.5 2:0.5 1:0.5 2:2 | 1:0.5 2:0.5 3:0.5 4:0.5 5:1 5:1 | 6:0.5 5:0.5 4:0.5 3:0.5 4:2 | 5:0.5 6:0.5 7:0.5 6:0.5 5:0.5 4:0.5 3:0.5 2:0.5 | 3:0.5 2:0.5 1:1 7-:0.5 1:0.5 2:1',
          bansuri: '_:16 | 5:0.5 6:0.5 7:0.5 6:0.5 5:0.5 4:0.5 3:0.5 2:0.5 | 3:0.5 2:0.5 1:1 7-:0.5 1:0.5 2:1',
        },
      },
      {
        bars: 1,
        chords: 'I:4',
        parts: {
          harmonium2: 'sustain',
          bansuri2: '1:4',
          folkPluck: '1!:4',
          bansuri: '1!:4',
          dhol: 'once:dha!',
          chimta: 'once:jk',
          claps: 'once:x',
        },
      },
    ],
  },
];

const CATALOGUE_C = [
  {
    key: 'original-promise-strings',
    title: 'A Promise in Strings',
    mood: 'engagement: a string waltz over piano, a descending bass (I V6 vi iii IV I6), the minor iv and a cadential 6/4; the cello asks and the violins answer in an E minor episode (B7/D#, A7 as V/V), then the theme in octaves with a harp',
    tonic: 'G3',
    scale: 'major',
    bpm: 92,
    meter: [3, 4],
    rit: { from: 96, factor: 0.88 },
    reverb: { room: 0.84, damp: 0.24, wet: 0.3, preDelay: 0.02 },
    instruments: {
      highStrings: { gain: 1.1, pan: 0.15, width: 7, send: 0.45, octave: 1, vel: 0.85 },
      cello: { gain: 0.8, pan: -0.3, width: -8, send: 0.42, octave: 0, vel: 0.8 },
      strings: { gain: 0.38, pan: 0.05, width: 10, send: 0.45, octave: 0, vel: 0.5 },
      piano: { gain: 0.62, pan: -0.15, width: -6, send: 0.3, octave: 0, vel: 0.6 },
      swarmandal: { gain: 0.38, pan: 0.42, width: 12, send: 0.5, octave: 1, vel: 0.6 },
    },
    dynamics: [[0, 0.62], [12, 0.72], [36, 0.82], [48, 0.88], [60, 0.85], [72, 0.95], [84, 1], [96, 0.95], [108, 0.8]],
    sections: [
      { bars: 4, chords: 'I:3 IV:3 ii7:3 V7:3', parts: { piano: 'ballad', swarmandal: 'roll' } },
      {
        bars: 8,
        chords: 'I:3 V/3:3 vi:3 iii:3 IV:3 I/3:3 ii7:3 V7:3',
        parts: { piano: 'waltz', strings: 'pad', highStrings: '3:2 4:0.5 5:0.5 | 5:2 4:1 | 3:1.5 2:0.5 1:1 | 7-:2 1:0.5 2:0.5 | 4:1.5 5:0.5 6:1 | 5:2 3:1 | 4:1 3:0.5 2:0.5 1:1 | 2:3' },
      },
      {
        // the theme again over a cello line; the minor iv and a cadential 6/4 bring it home
        bars: 8,
        chords: 'I:3 V/3:3 vi:3 I/5:3 IV:3 iv:3 I/5:1.5 V7:1.5 I:3',
        parts: {
          piano: 'waltz',
          strings: 'pad',
          highStrings: '3:2 4:0.5 5:0.5 | 5:2 4:1 | 3:1.5 2:0.5 1:1 | 5:2 6:0.5 7:0.5 | 1+:2 7:0.5 6:0.5 | 6b:2 5:1 | 5:1.5 4:0.5 3:0.5 2:0.5 | 1:3',
          cello: '5-:2 6-:1 | 7-:2 5-:1 | 1:2 6-:1 | 5-:3 | 6-:1 7-:1 1:1 | 1:2 6-b:1 | 5-:1.5 4-:1.5 | 3-:3',
        },
      },
      {
        // E minor: the cello asks, the violins answer
        bars: 8,
        chords: 'vi:3 V7/vi/3:3 vi:3 IV:3 ii7:3 V7/V:3 V:3 V7:3',
        parts: {
          piano: 'ballad',
          strings: 'pad',
          cello: '6:2 5:0.5 6:0.5 | 7:1.5 6:0.5 5#:1 | 6:2 3:1 | 4:1.5 3:0.5 1:1 | _:12',
          highStrings: '_:12 | 2:1.5 3:0.5 4:1 | 6:1.5 5:0.5 4#:1 | 5:2 6:0.5 7:0.5 | 6:1 5:1 4:1',
        },
      },
      {
        // the theme in octaves, the harp sweeping in
        bars: 6,
        chords: 'I:3 V/3:3 vi:3 IV:3 I/5:3 V7:3',
        parts: {
          piano: 'waltz',
          strings: 'pad',
          swarmandal: '1$:3 _:15',
          highStrings: '3:2 4:0.5 5:0.5 | 5:2 4:1 | 3:1.5 2:0.5 1:1 | 4:1.5 5:0.5 6:1 | 5:2 3:1 | 2:3',
          cello: '3:2 4:0.5 5:0.5 | 5:2 4:1 | 3:1.5 2:0.5 1:1 | 4:1.5 5:0.5 6:1 | 5:2 3:1 | 2:3',
        },
      },
      {
        bars: 2,
        chords: 'I:6',
        parts: { piano: 'ballad', strings: 'pad', swarmandal: 'roll', highStrings: '1:6', cello: '1-:6' },
      },
    ],
  },
  {
    key: 'original-carnival-tumble',
    title: 'Carnival Tumble',
    mood: "children's birthday: a bouncy marimba tune in staccato eighths with blue notes, the xylophone answering it, ukulele strums and off-beat chops, upright bass, tambourine and claps; a ragtime turn (A7, C7, F#dim7) and a middle strain in F",
    tonic: 'C3',
    scale: 'major',
    bpm: 120,
    meter: [4, 4],
    reverb: { room: 0.66, damp: 0.3, wet: 0.16, preDelay: 0.01 },
    instruments: {
      marimba: { gain: 0.9, pan: -0.12, width: -6, send: 0.2, octave: 1, vel: 0.85 },
      xylophone: { gain: 0.62, pan: 0.42, width: 12, send: 0.28, octave: 2, vel: 0.75 },
      ukulele: { gain: 0.55, pan: 0.25, width: 8, send: 0.2, octave: 1, vel: 0.65 },
      bassPluck: { gain: 0.9, pan: 0, width: 0, send: 0.1, octave: 0, vel: 0.75 },
      tambourine: { gain: 0.38, pan: -0.35, width: -8, send: 0.2, vel: 0.7 },
      claps: { gain: 0.58, pan: 0.2, width: 7, send: 0.3, vel: 0.75 },
    },
    dynamics: [[0, 0.8], [8, 0.85], [40, 0.95], [72, 1], [104, 1], [120, 0.95], [128, 0.85]],
    sections: [
      { bars: 2, chords: 'I:4 V7:4', parts: { ukulele: 'strum', bassPluck: 'bass', tambourine: 'backbeat' } },
      {
        bars: 8,
        chords: 'I:4 | V7/ii:4 | ii:4 | V7:4 | I:4 | V7/IV:4 | IV:2 #ivo7:2 | I/5:2 V7:2',
        parts: {
          ukulele: 'strum',
          bassPluck: 'bass',
          tambourine: 'backbeat',
          marimba: "1':0.5 3':0.5 5:0.5 6:0.5 5':0.5 3':0.5 _:0.5 5':0.5 | 6:1 5:0.5 6:0.5 1+#:1 _:0.5 6':0.5 | 2+:1 1+:0.5 6:0.5 4:1 _:0.5 6':0.5 | 5:1 4:0.5 2:0.5 7-:1 5-':0.5 7-':0.5 | 3+:1 1+:0.5 5:0.5 3:1 _:0.5 5':0.5 | 7b:1 6:0.5 5:0.5 3:1 _:0.5 7b':0.5 | 6:1 4:1 6:0.5 1+:0.5 3+b:1 | 5:1 3:1 2:1 _:1",
        },
      },
      {
        // the marimba calls, the xylophone answers
        bars: 8,
        chords: 'I:4 | V7/ii:4 | ii:4 | V7:4 | I:4 | V7/IV:4 | IV:2 #ivo7:2 | I/5:2 V7:2',
        parts: {
          ukulele: 'strum',
          bassPluck: 'bass',
          tambourine: 'backbeat',
          claps: 'backbeat',
          marimba: "1':0.5 3':0.5 5:0.5 6:0.5 5':0.5 3':0.5 _:0.5 5':0.5 | 6:1 5:0.5 6:0.5 1+#:1 _:0.5 6':0.5 | _:8 | 3+:1 1+:0.5 5:0.5 3:1 _:0.5 5':0.5 | 7b:1 6:0.5 5:0.5 3:1 _:0.5 7b':0.5 | _:8",
          xylophone: '_:8 | 2+:0.5 1+:0.5 6:0.5 4:0.5 6:0.5 1+:0.5 2+:1 | 5:0.5 7-:0.5 2:0.5 4:0.5 5:1 _:1 | _:8 | 6:0.5 1+:0.5 4:1 6:0.5 1+:0.5 3+b:1 | 5:0.5 3:0.5 2:0.5 7-:0.5 5-:1 _:1',
        },
      },
      {
        // the middle strain, in F
        bars: 8,
        shift: 5,
        chords: 'I:4 | vi:4 | IV:4 | V7:4 | I:4 | ii7:4 | V7:4 | V7/V:4',
        parts: {
          ukulele: 'offbeat',
          bassPluck: 'bass',
          tambourine: 'backbeat',
          claps: 'two',
          marimba: '3:1 4:0.5 5:0.5 1+:1 5:1 | 6:1 5:0.5 4:0.5 3:1 1:1 | 4:1 6:1 1+:1 6:1 | 5:1.5 4:0.5 7-:1 2:1 | 3:1 4:0.5 5:0.5 1+:1 3+:1 | 2+:1 1+:0.5 6:0.5 4:1 2:1 | 5:1 7-:0.5 2:0.5 4:1 5:1 | 2:0.5 4#:0.5 6:0.5 1+:0.5 2+:1 _:1',
          xylophone: '_:16 | 3:1 4:0.5 5:0.5 1+:1 3+:1 | 2+:1 1+:0.5 6:0.5 4:1 2:1 | 5:1 7-:0.5 2:0.5 4:1 5:1 | 2:0.5 4#:0.5 6:0.5 1+:0.5 2+:1 _:1',
        },
      },
      {
        bars: 4,
        chords: 'I:4 | V7/ii:4 | ii:2 V7:2 | I:4',
        parts: {
          ukulele: 'strum',
          bassPluck: 'bass',
          tambourine: 'backbeat',
          claps: 'backbeat',
          marimba: "1':0.5 3':0.5 5:0.5 6:0.5 5':0.5 3':0.5 _:0.5 5':0.5 | 6:1 5:0.5 6:0.5 1+#:1 _:0.5 6':0.5 | 2+:0.5 1+:0.5 6:0.5 4:0.5 5:0.5 4:0.5 2:0.5 7-:0.5 | 1+!:1 _:1 1!:1 _:1",
          xylophone: '_:8 | 2+:0.5 1+:0.5 6:0.5 4:0.5 5:0.5 4:0.5 2:0.5 7-:0.5 | 1+!:1 _:1 1!:1 _:1',
        },
      },
      {
        bars: 2,
        chords: 'I:4 I:4',
        parts: {
          ukulele: 'strum',
          bassPluck: 'bass',
          tambourine: 'backbeat',
          claps: 'once:. . x . x . x x x . . . . . . .',
          marimba: '1:0.5 2:0.5 3:0.5 5:0.5 6:0.5 1+:0.5 2+:0.5 3+:0.5 | 1+!:1 _:3',
          xylophone: '_:4 | 1+!:1 _:3',
        },
      },
    ],
  },
  {
    key: 'original-ballroom-waltz',
    title: 'Ballroom Waltz',
    mood: 'anniversary: a piano waltz with a Viennese lilt, the minor iv and appoggiaturas, a music-box strain in E-flat (through G7 and F7), and the theme again under a violin line; a plagal close',
    tonic: 'Bb3',
    scale: 'major',
    bpm: 132,
    meter: [3, 4],
    rit: { from: 132, factor: 0.85 },
    reverb: { room: 0.84, damp: 0.24, wet: 0.3, preDelay: 0.02 },
    instruments: {
      piano: { gain: 1.0, pan: 0.1, width: 5, send: 0.3, octave: 1, vel: 0.8 },
      piano2: { gain: 0.65, pan: -0.2, width: -7, send: 0.25, octave: 0, vel: 0.6 },
      strings: { gain: 0.42, pan: 0.15, width: 10, send: 0.5, octave: 0, vel: 0.5 },
      violin: { gain: 0.55, pan: 0.3, width: 9, send: 0.45, octave: 1, vel: 0.65 },
      musicBox: { gain: 0.62, pan: 0.38, width: 12, send: 0.55, octave: 1, vel: 0.75 },
    },
    dynamics: [[0, 0.65], [12, 0.75], [60, 0.85], [96, 0.95], [132, 0.9], [144, 0.75]],
    sections: [
      { bars: 4, chords: 'I:6 V7:6', parts: { piano2: 'waltz', strings: 'pad' } },
      {
        bars: 16,
        chords: 'I:3 I:3 ii7:3 V7:3 V7:3 V7/V:3 V7:3 I:3 | I:3 I:3 IV:3 iv:3 I/5:3 V7:3 V7:3 I:3',
        parts: {
          piano2: 'waltz',
          strings: 'pad',
          piano: '3:2 2:0.5 3:0.5 | 5:2 4:0.5 5:0.5 | 6:1.5 1+:0.5 6:0.5 5:0.5 | 7:3 | 2+:1.5 1+:0.5 7:1 | 1+:1.5 6:0.5 4#:1 | 5:1 4:0.5 3:0.5 2:1 | 3:3 | 3:2 2:0.5 3:0.5 | 5:2 4:0.5 5:0.5 | 6:1.5 1+:0.5 6:0.5 4:0.5 | 6b:2 5:0.5 6b:0.5 | 5:2 3:1 | 2+:1.5 1+:0.5 7:1 | 7:1 6:0.5 5:0.5 4:1 | 3:1 1:2',
        },
      },
      {
        // the music box, in E-flat; F7 leads home
        bars: 12,
        shift: 5,
        chords: 'I:3 vi:3 ii7:3 V7:3 | I:3 V7/vi:3 vi:3 V7/V:3 | ii7:3 V7:3 I:3 V7/V:3',
        parts: {
          piano2: 'waltz',
          strings: 'pad',
          musicBox: '5:1 3:0.5 4:0.5 5:1 | 1+:2 6:1 | 4:1 6:1 1+:1 | 7:1.5 6:0.5 5:1 | 3:0.5 4:0.5 5:1 1+:1 | 7:2 5#:1 | 6:2 5:0.5 6:0.5 | 6:1 4#:1 2:1 | 4:1.5 5:0.5 6:1 | 5:1 7:1 2+:1 | 1+:3 | _:1 6:1 4#:1',
        },
      },
      {
        // the theme under a violin line
        bars: 12,
        chords: 'I:3 I:3 IV:3 iv:3 I/5:3 V7:3 vi:3 V7/V:3 I/5:3 V7:3 I:3 I:3',
        parts: {
          piano2: 'waltz',
          strings: 'pad',
          piano: '3:2 2:0.5 3:0.5 | 5:2 4:0.5 5:0.5 | 6:1.5 1+:0.5 6:0.5 4:0.5 | 6b:2 5:0.5 6b:0.5 | 5:2 3:1 | 2+:1.5 1+:0.5 7:1 | 1+:2 3+:0.5 2+:0.5 | 1+:1 6:1 4#:1 | 3+:2 2+:1 | 1+:1 7:1 2+:1 | 1+:3 | _:3',
          violin: '5:3 | 6:2 5:1 | 6:3 | 4:3 | 3:2 4:1 | 4:3 | 3:3 | 6:3 | 5:2 4:1 | 4:3 | 3:3 | 3:3',
        },
      },
      {
        bars: 4,
        chords: 'IV:3 iv:3 I:6',
        parts: { piano2: 'waltz', strings: 'pad', piano: '1+:2 2+:0.5 1+:0.5 | 6b:3 | 5:3 | 3:3', violin: '4:3 | 4:3 | 3:6' },
      },
    ],
  },
  {
    key: 'original-lori-music-box',
    title: 'Lori (Music Box)',
    mood: 'baby shower: a music-box lullaby in 6/8 (bpm counts eighths: 48 to the dotted beat) over celesta arpeggios and a soft pad; a cello hums beneath the second verse, the bridge turns tender through the minor iv, and it settles over a tonic pedal',
    tonic: 'E3',
    scale: 'major',
    bpm: 144,
    meter: [6, 8],
    rit: { from: 144, factor: 0.85 },
    reverb: { room: 0.82, damp: 0.24, wet: 0.32, preDelay: 0.02 },
    instruments: {
      musicBox: { gain: 1.0, pan: 0.1, width: 6, send: 0.45, octave: 2, vel: 0.75 },
      celesta: { gain: 0.6, pan: -0.35, width: -9, send: 0.45, octave: 1, vel: 0.55 },
      pad: { gain: 0.32, pan: 0.2, width: 12, send: 0.4, octave: 0, vel: 0.55 },
      cello: { gain: 0.5, pan: -0.15, width: -8, send: 0.45, octave: 0, vel: 0.6 },
    },
    dynamics: [[0, 0.6], [12, 0.7], [60, 0.8], [108, 0.85], [144, 0.75], [168, 0.6]],
    sections: [
      { bars: 2, chords: 'I:6 IV@1:6', parts: { pad: 'sustain', celesta: 'arp' } },
      {
        bars: 8,
        chords: 'I:6 V:6 IV:6 I:6 ii7:6 V7:6 I:6 V7:6',
        parts: { pad: 'sustain', celesta: 'arp', musicBox: '5:2 6:1 5:2 3:1 | 2:3 7-:3 | 6:2 5:1 4:3 | 3:3 _:3 | 6:2 4:1 2:2 4:1 | 2:2 7-:1 5-:3 | 1:2 3:1 5:3 | 4:3 2:3' },
      },
      {
        bars: 8,
        chords: 'I:6 V:6 IV:6 I:6 ii7:6 V7:6 I:6 I:6',
        parts: {
          pad: 'sustain',
          celesta: 'arp',
          musicBox: '5:2 6:1 5:2 3:1 | 2:3 7-:3 | 6:2 5:1 4:3 | 3:3 _:3 | 6:2 4:1 2:2 4:1 | 2:2 7-:1 5-:3 | 1:2 3:1 5:3 | 1:6',
          cello: '1:6 | 7-:6 | 6-:6 | 5-:6 | 6-:6 | 7-:3 2:3 | 1:6 | 1:6',
        },
      },
      {
        // the bridge: IV to the minor iv
        bars: 6,
        chords: 'IV:6 iv:6 I/5:6 vi:6 ii7:6 V7:6',
        parts: {
          pad: 'sustain',
          celesta: 'arp',
          musicBox: '6:3 5:2 4:1 | 6b:3 5:2 4:1 | 3:3 5:3 | 1+:3 6:3 | 4:2 6:1 1+:2 6:1 | 5:2 2:1 4:3',
          cello: '4-:6 | 4-:6 | 5-:6 | 6-:6 | 2-:6 | 5-:6',
        },
      },
      {
        bars: 4,
        chords: 'I:6 IV@1:6 I:6 I:6',
        parts: { pad: 'sustain', celesta: 'arp', musicBox: '5:2 3:1 1:3 | 6:3 4:3 | 3:6 | 1:6', cello: '1:24' },
      },
    ],
  },
  {
    key: 'original-keynote-ambient',
    title: 'Keynote',
    mood: 'corporate: a syncopated piano motif over a plucked arpeggio, a soft pulse bass and a pad (Iadd9 V6 vi7 IVmaj7), a fuller strain with strings, a light kit and shaker, a cymbal swell and the lift through bVI and bVII; confident and clean',
    tonic: 'A3',
    scale: 'major',
    bpm: 100,
    meter: [4, 4],
    reverb: { room: 0.78, damp: 0.26, wet: 0.24, preDelay: 0.015 },
    instruments: {
      pad: { gain: 0.25, pan: 0, width: 14, send: 0.4, octave: 0, vel: 0.6 },
      pluck: { gain: 0.5, pan: 0.25, width: 10, send: 0.3, octave: 1, vel: 0.7 },
      piano: { gain: 1.0, pan: -0.1, width: 6, send: 0.3, octave: 1, vel: 0.72 },
      highStrings: { gain: 0.45, pan: -0.3, width: -10, send: 0.5, octave: 1, vel: 0.55 },
      pulse: { gain: 0.55, pan: 0, width: 0, send: 0.08, octave: 0, vel: 0.7 },
      kit: { gain: 0.5, pan: 0, width: 4, send: 0.12, vel: 0.75 },
      shaker: { gain: 0.32, pan: 0.4, width: 10, send: 0.2, vel: 0.7 },
      cymbal: { gain: 0.45, pan: -0.3, width: -8, send: 0.4, vel: 0.75 },
    },
    dynamics: [[0, 0.65], [16, 0.75], [48, 0.9], [80, 0.8], [88, 1], [112, 1], [120, 0.8]],
    sections: [
      { bars: 4, chords: 'Iadd9:4 V/3:4 vi7:4 IVmaj7:4', parts: { pad: 'sustain', pluck: 'arp' } },
      {
        bars: 8,
        chords: 'Iadd9:4 V/3:4 vi7:4 IVmaj7:4 Iadd9:4 V/3:4 vi7:4 IV:2 V:2',
        parts: {
          pad: 'sustain',
          pluck: 'arp',
          pulse: 'pulse',
          piano: '_:0.5 3:0.5 5:0.5 1+:1 7:0.5 5:1 | _:0.5 2:0.5 5:0.5 7:1 6:0.5 5:1 | _:0.5 1:0.5 3:0.5 6:1 5:0.5 3:1 | 4:1.5 3:0.5 2:2 | _:0.5 3:0.5 5:0.5 1+:1 7:0.5 5:1 | _:0.5 2:0.5 5:0.5 7:1 6:0.5 5:1 | _:0.5 1:0.5 3:0.5 6:1 5:0.5 3:1 | 4:1 6:1 5:0.5 6:0.5 7:1',
        },
      },
      {
        // fuller: the strings carry the line and the piano answers
        bars: 8,
        chords: 'IV:4 V:4 iii7:4 vi7:4 ii7:4 iii7:4 IV:4 Vsus:2 V:2',
        parts: {
          pad: 'sustain',
          pluck: 'pulse8',
          pulse: 'pulse',
          kit: 'soft',
          shaker: 'sixteenths',
          highStrings: '1+:3 7:1 | 7:4 | 5:2 6:2 | 3:4 | 4:3 5:1 | 5:4 | 6:2 4:2 | 4:2 5:2',
          piano: '_:4 | _:2 3:0.5 5:0.5 7:1 | _:4 | _:2 1:0.5 3:0.5 5:1 | _:4 | _:2 7-:0.5 2:0.5 5:1 | _:4 | _:4',
        },
      },
      {
        bars: 2,
        chords: 'vi7:4 IVmaj7:4',
        parts: { pad: 'sustain', pluck: 'arp', piano: '_:0.5 1:0.5 3:0.5 6:1 5:0.5 3:1 | 4:4', cymbal: 'once:. . . . . . swell .' },
      },
      {
        // the motif in full, lifted through bVI and bVII
        bars: 6,
        chords: 'Iadd9:4 V/3:4 vi7:4 IVmaj7:4 bVI:2 bVII:2 I:4',
        parts: {
          pad: 'sustain',
          pluck: 'pulse8',
          pulse: 'pulse',
          kit: 'soft',
          shaker: 'sixteenths',
          piano: '_:0.5 3:0.5 5:0.5 1+:1 7:0.5 5:1 | _:0.5 2:0.5 5:0.5 7:1 6:0.5 5:1 | _:0.5 1:0.5 3:0.5 6:1 5:0.5 3:1 | 4:1.5 3:0.5 2:2 | 6b:1 1+:1 7b:1 2+:1 | 1+:4',
          highStrings: '3:4 | 2:4 | 1:4 | 1:4 | 1:2 2:2 | 3:4',
        },
      },
      {
        bars: 2,
        chords: 'IVmaj7:4 Iadd9:4',
        parts: { pad: 'sustain', pluck: 'arp', piano: '4:2 3:2 | 1:4', highStrings: '1:8' },
      },
    ],
  },
  {
    key: 'original-alma-anthem',
    title: 'Alma Mater',
    mood: 'school and college: a brass fanfare and timpani, a proud piano verse in dotted rhythms, a chorus through secondary dominants (G7 to C minor, F7 to B-flat) with strings and brass, a bridge that swells into the last chorus with voices, timpani and a crash',
    tonic: 'Eb3',
    scale: 'major',
    bpm: 92,
    meter: [4, 4],
    rit: { from: 100, factor: 0.88 },
    reverb: { room: 0.86, damp: 0.24, wet: 0.3, preDelay: 0.02 },
    instruments: {
      piano: { gain: 1.0, pan: 0.1, width: 5, send: 0.3, octave: 1, vel: 0.8 },
      piano2: { gain: 0.55, pan: -0.2, width: -7, send: 0.25, octave: 0, vel: 0.6 },
      strings: { gain: 0.45, pan: 0.2, width: 10, send: 0.45, octave: 0, vel: 0.6 },
      highStrings: { gain: 0.55, pan: 0.3, width: 9, send: 0.45, octave: 1, vel: 0.7 },
      brass: { gain: 0.5, pan: -0.3, width: -9, send: 0.35, octave: 0, vel: 0.72 },
      brass2: { gain: 1.1, pan: -0.15, width: -6, send: 0.35, octave: 1, vel: 0.8 },
      choir2: { gain: 0.38, pan: 0.15, width: 12, send: 0.5, octave: 0, vel: 0.6 },
      timpani: { gain: 0.55, pan: -0.25, width: -6, send: 0.35, octave: -1, vel: 0.8 },
      cymbal: { gain: 0.45, pan: 0.35, width: 8, send: 0.4, vel: 0.75 },
    },
    dynamics: [[0, 0.8], [8, 0.7], [40, 0.9], [72, 0.85], [88, 1], [104, 0.95]],
    sections: [
      {
        // the fanfare
        bars: 2,
        chords: 'I:8',
        parts: {
          strings: 'pad',
          brass2: '1:0.5 1:0.25 1:0.25 5:1 4:0.5 3:0.5 5:1 | 1+:3 _:1',
          timpani: '1?:0.25 1?:0.25 1:0.25 1:0.25 1!:3 | _:4',
        },
      },
      {
        bars: 8,
        chords: 'I:4 | IV:2 I/3:2 | ii7:2 V:2 | I:4 | vi:2 iii:2 | IV:2 I/3:2 | ii7:2 V7:2 | I:4',
        parts: {
          piano2: 'ballad',
          strings: 'pad',
          piano: '1:1.5 1:0.5 3:1 5:1 | 6:2 5:1 3:1 | 4:1.5 3:0.5 2:1 5-:1 | 3:4 | 1:1.5 1:0.5 3:1 5:1 | 1+:2 5:2 | 6:1 5:1 4:1 2:1 | 1:4',
        },
      },
      {
        // the chorus: G7 to C minor, F7 to B-flat
        bars: 8,
        chords: 'I:4 | V7/vi:4 | vi:4 | V7/V:4 | IV:2 V:2 | I/3:2 vi:2 | ii7:2 V7:2 | I:4',
        parts: {
          piano2: 'block2',
          strings: 'pad',
          brass: 'sustain',
          timpani: '1:4 | _:12 | 5:4 | _:4 | _:2 5:2 | 1:4',
          piano: '5:1.5 5:0.5 1+:1 5:1 | 7:1.5 6:0.5 5#:1 3:1 | 6:1.5 5:0.5 3:1 1+:1 | 2+:2 1+:1 6:1 | 1+:1 6:1 7:1 2+:1 | 1+:1.5 7:0.5 1+:1 3+:1 | 2+:1 1+:1 7:1 6:1 | 1+:4',
          highStrings: '5:1.5 5:0.5 1+:1 5:1 | 7:1.5 6:0.5 5#:1 3:1 | 6:1.5 5:0.5 3:1 1+:1 | 2+:2 1+:1 6:1 | 1+:1 6:1 7:1 2+:1 | 1+:1.5 7:0.5 1+:1 3+:1 | 2+:1 1+:1 7:1 6:1 | 1+:4',
        },
      },
      {
        // the bridge swells into the last chorus
        bars: 4,
        chords: 'vi:2 iii:2 | IV:2 I/3:2 | ii7:2 V7/V:2 | V:2 V7:2',
        parts: {
          piano2: 'ballad',
          strings: 'pad',
          choir2: 'sustain',
          highStrings: '3:2 5:2 | 6:2 5:2 | 4:2 4#:2 | 5:2 5:1 7-:1',
          piano: '_:2 7:0.5 6:0.5 5:1 | _:2 3+:0.5 2+:0.5 1+:1 | _:2 2+:0.5 1+:0.5 6:1 | _:4',
          cymbal: 'once:. . . . . . . . . . . . . . swell .',
        },
      },
      {
        bars: 4,
        chords: 'I:2 V/3:2 | vi:2 IV:2 | ii7:2 V7:2 | I:4',
        parts: {
          piano2: 'block2',
          strings: 'pad',
          brass: 'sustain',
          choir2: 'sustain',
          cymbal: 'once:crash',
          piano: '5:1.5 5:0.5 2+:1 7:1 | 1+:1.5 7:0.5 6:1 1+:1 | 2+:1 1+:1 7:1 2+:1 | 1+:4',
          highStrings: '3:2 2:2 | 1:2 1:2 | 1:2 2:2 | 3:4',
          timpani: '1:2 5:2 | 1:2 1:2 | _:2 5:2 | 1?:0.25 1?:0.25 1:0.25 1:0.25 1!:3',
        },
      },
    ],
  },
  {
    key: 'original-golden-veranda',
    title: 'Golden Veranda',
    mood: 'retirement: a nostalgic piano tune over warm sevenths (Fmaj7 Dm7 Gm7 C7, D7 as V/ii, G7 as V/V), a flute that takes the bridge through B-flat minor (the borrowed iv) and a 4-3 suspension, a cello line descending under the last verse',
    tonic: 'F3',
    scale: 'major',
    bpm: 72,
    meter: [4, 4],
    rit: { from: 76, factor: 0.86 },
    reverb: { room: 0.82, damp: 0.26, wet: 0.3, preDelay: 0.02 },
    instruments: {
      piano: { gain: 1.15, pan: 0.05, width: 5, send: 0.3, octave: 1, vel: 0.72 },
      piano2: { gain: 0.55, pan: -0.25, width: -8, send: 0.3, octave: 0, vel: 0.55 },
      strings: { gain: 0.42, pan: 0.2, width: 10, send: 0.5, octave: 0, vel: 0.5 },
      cello: { gain: 0.55, pan: -0.3, width: -9, send: 0.42, octave: 0, vel: 0.65 },
      bansuri: { gain: 0.75, pan: 0.35, width: 10, send: 0.48, octave: 1, vel: 0.65 },
    },
    dynamics: [[0, 0.65], [8, 0.72], [40, 0.85], [56, 0.95], [64, 0.9], [80, 0.8], [84, 0.75]],
    sections: [
      { bars: 2, chords: 'Imaj7:4 IVmaj7:4', parts: { piano2: 'ballad', strings: 'pad', bansuri: '_:4 | 1+:1.5 6:0.5 5:2' } },
      {
        bars: 8,
        chords: 'Imaj7:4 | vi7:4 | ii7:4 | V7:4 | iii7:2 VI7:2 | ii7:2 V7:2 | I6:4 | V7/V:2 V7:2',
        parts: {
          piano2: 'ballad',
          strings: 'pad',
          piano: '3:1.5 2:0.5 3:0.5 4:0.5 5:1 | 6:2 5:0.5 4:0.5 3:1 | 4:1.5 3:0.5 4:1 6:1 | 5:2 _:0.5 7-:0.5 1:0.5 2:0.5 | 3:1.5 4:0.5 5:1 6:1 | 4:1 2:1 5:1 7-:1 | 1:2 6-:0.5 7-:0.5 1:1 | 2:1 4#:1 5:1 7-:1',
        },
      },
      {
        // the flute's bridge: B-flat major to B-flat minor, D7, and the 4-3 suspension
        bars: 6,
        chords: 'IVmaj7:4 | iv7:4 | iii7:4 | VI7:4 | ii7:4 | Vsus:2 V7:2',
        parts: {
          piano2: 'ballad',
          strings: 'pad',
          cello: '4-:4 | 4-:4 | 3-:4 | 6-:4 | 2-:4 | 5-:4',
          bansuri: '6:1.5 1+:0.5 2+:1 1+:1 | 1+:1.5 6b:0.5 4:2 | 3:1 5:0.5 3:0.5 1+:1 7:1 | 6:1 1+#:1 3+:1 6:1 | 4:1.5 6:0.5 2+:1 1+:1 | 1+:2 7:2',
          piano: '_:4 | _:2 6b:0.5 5:0.5 4:1 | _:4 | _:2 3:0.5 1#:0.5 6-:1 | _:8',
        },
      },
      {
        bars: 4,
        chords: 'Imaj7:4 | vi7:4 | ii7:2 V7:2 | Imaj7:4',
        parts: {
          piano2: 'ballad',
          strings: 'pad',
          piano: '3:1.5 2:0.5 3:0.5 4:0.5 5:1 | 6:2 5:0.5 4:0.5 3:1 | 4:1 6:1 5:1 7-:1 | 1:4',
          cello: '1:2 7-:2 | 6-:2 5-:2 | 4-:2 5-:2 | 1:4',
          bansuri: '_:4 | _:2 1+:0.5 7:0.5 6:1 | _:4 | 3+:4',
        },
      },
      {
        bars: 1,
        chords: 'IVmaj7@1:2 Imaj7:2',
        parts: { piano2: 'ballad', strings: 'pad', piano: '6:2 3:2', cello: '1:4' },
      },
    ],
  },
  {
    key: 'original-sacred-garden',
    title: 'Garden of Noor',
    mood: 'nikah: a barcarolle in 6/8 (bpm counts eighths: 66 to the dotted beat) in maqam Nahawand (E minor with the raised seventh); the piano sings over a rocking left hand and a soft string bed, a violin takes the theme on to G major, a bridge over the Andalusian cadence (Em D C B) closes on the Hijaz of the dominant (E D# C B) with an oud an octave below, qanun runs at the turns, a ney call, and a plagal close',
    tonic: 'E3',
    scale: 'minor',
    bpm: 198,
    meter: [6, 8],
    rit: { from: 204, factor: 0.88 },
    reverb: { room: 0.86, damp: 0.24, wet: 0.32, preDelay: 0.025 },
    instruments: {
      piano: { gain: 1.1, pan: 0.05, width: 5, send: 0.32, octave: 1, vel: 0.72 },
      piano2: { gain: 0.55, pan: -0.12, width: -7, send: 0.3, octave: 0, vel: 0.55 },
      strings: { gain: 0.36, pan: 0.1, width: 10, send: 0.45, octave: 0, vel: 0.5 },
      violin: { gain: 0.85, pan: 0.26, width: 9, send: 0.45, octave: 1, vel: 0.72 },
      violin2: { gain: 0.6, pan: 0.2, width: 8, send: 0.45, octave: 1, vel: 0.65 },
      rabab: { gain: 0.95, pan: -0.32, width: -9, send: 0.34, octave: 1, vel: 0.72, highCut: 5200 },
      swarmandal: { gain: 0.9, pan: 0.42, width: 12, send: 0.5, octave: 2, vel: 0.62 },
      bansuri: { gain: 0.6, pan: -0.18, width: -8, send: 0.5, octave: 1, lowCut: 200, vel: 0.62 },
    },
    dynamics: [[0, 0.68], [12, 0.74], [60, 0.8], [108, 0.88], [138, 1], [156, 0.95], [192, 0.92], [204, 0.82], [216, 0.64]],
    sections: [
      {
        // a qanun run opens the garden and a ney sighs on the sixth (B C B, the theme's first notes); the oud's Hijaz turn (G F# E D#) leads in
        bars: 2,
        chords: 'i:6 V7:6',
        parts: { piano2: 'ballad', strings: 'pad', swarmandal: '1$:6 _:6', bansuri: '5:3 6>:2 5:1 | 5:2 _:4', rabab: '_:6 | _:2 3:1 2:1 1:1 7-#:1' },
      },
      {
        // the piano's theme: a sigh on the sixth, the augmented second (C to D#) into the half cadence, then up to the high A and home
        bars: 8,
        chords: 'i:6 VI:6 iv:6 V:6 i:6 VI:3 VII:3 iv:3 V7:3 i:6',
        parts: {
          piano2: 'ballad',
          strings: 'pad',
          rabab: '1:3 _:45',
          piano: '5:2 6:1 5:2 3:1 | 1+:3 7:2 6:1 | 6:2 5:1 4:3 | 5:2 6:1 7#:3 | 1+:2 2+:1 3+:3 | 4+:2 3+:1 2+:2 1+:1 | 6:2 5:1 4:2 2:1 | 1:6',
        },
      },
      {
        // the violin takes the theme with its slides, turns to G major (the relative major) and back to the dominant; the piano answers
        bars: 8,
        chords: 'i:6 VI:6 iv:6 V:6 III:6 VI:3 VII:3 iv:6 V:6',
        parts: {
          piano2: 'ballad',
          strings: 'pad',
          violin: '5:2 6:1 5:2 3:1 | 1+:3 7:2 6:1 | 6:2 5:1 4:3 | 5:2 6:1 7#>:3 | 5:2 7:1 2+:3 | 3+:3 2+:2 1+:1 | 6:2 1+:1 4+:3 | 3+:2 2+:1 7#:3',
          piano: '_:12 | _:3 1+:1 7:1 6:1 | _:18 | _:3 1+:1 7:1 6:1 | _:6',
        },
      },
      {
        // the bridge over the Andalusian cadence: the violin sings and the oud answers; each half closes on the Hijaz of B (E D# C B), the second time with the oud an octave below
        bars: 8,
        chords: 'i:6 VII:6 VI:6 V:6 i:6 VII:6 VI:3 iv:3 V7:6',
        parts: {
          piano2: 'ballad',
          strings: 'pad',
          violin: '1+:3 7:2 1+:1 | 2+:3 1+:2 7:1 | 1+>:6 | 1+:2 7#:1 6:2 5:1 | 5:2 1+:1 3+>:3 | 4+:3 2+:3 | 1+:2 3+:1 1+:2 6:1 | 1+:2 7#:1 6:2 5:1',
          rabab: '_:12 | _:3 3:1 2:1 1:1 | _:24 | 1:2 7-#:1 6-:2 5-:1',
          swarmandal: '_:24 5$!:3 _:21',
        },
      },
      {
        // the theme on the piano again under the violin's descant, then both together to the cadence
        bars: 8,
        chords: 'i:6 VI:6 iv:6 V:6 i:6 VI:3 VII:3 iv:3 V7:3 i:6',
        parts: {
          piano2: 'ballad',
          strings: 'pad',
          swarmandal: '5-$:3 _:45',
          piano: '5:2 6:1 5:2 3:1 | 1+:3 7:2 6:1 | 6:2 5:1 4:3 | 5:2 6:1 7#:3 | 1+:2 2+:1 3+:3 | 4+:2 3+:1 2+:2 1+:1 | 6:2 5:1 4:2 2:1 | 1:6',
          violin2: '_:3 1+:3 | 3+:6 | 1+:3 6:3 | 7#:3 2+:3 | 1+:2 2+:1 3+:3 | 4+:2 3+:1 2+:2 1+:1 | 6:2 5:1 4:2 2:1 | 3:6',
        },
      },
      {
        // a plagal close (Am to Em): the oud's last turn down to E, the piano on the fifth, ringing into the next time round
        bars: 2,
        chords: 'iv:6 i:6',
        parts: { piano2: 'ballad', strings: 'pad', piano: '1+:3 6:3 | 5:6', violin2: '4:6 | 3:6', rabab: '_:3 4:1 3:1 2:1 | 1:6' },
      },
    ],
  },
];

/** The catalogue in the order hosts see it. */
const ORDER = [
  'original-shehnai-darbar', 'original-mehfil-santoor', 'original-anand-dawn', 'original-processional', 'original-promise-strings', 'original-carnival-tumble',
  'original-ballroom-waltz', 'original-lori-music-box', 'original-prabhat-bansuri', 'original-ganga-bells', 'original-gayatri-drone', 'original-shubh-dhol',
  'original-sandhya-aarti', 'original-roshni-dhamaal', 'original-keynote-ambient', 'original-alma-anthem', 'original-mela-chowk', 'original-golden-veranda',
  'original-sacred-garden',
];
const ALL = [...CATALOGUE_A, ...CATALOGUE_B, ...CATALOGUE_C];
const TRACKS = ORDER.map((key) => ALL.find((t) => t.key === key)).filter(Boolean);
if (TRACKS.length !== ALL.length) throw new Error('catalogue: a track is missing from ORDER');

// ───────────────────────────── Main ─────────────────────────────

/** The decoded file's true peak must stay under -1 dBTP; this leaves a little room for other meters and decoders. */
const DECODED_CEILING = -1.2;

const selected = ONLY ? TRACKS.filter((t) => ONLY.some((k) => t.key === k || t.key === `original-${k}`)) : TRACKS;
if (ONLY && selected.length !== ONLY.length) {
  const known = new Set(selected.map((t) => t.key));
  console.error(`Unknown track(s): ${ONLY.filter((k) => !known.has(k) && !known.has(`original-${k}`)).join(', ')}`);
  process.exit(2);
}
if (args.list) {
  for (const t of TRACKS) {
    const c = new Composer(t);
    console.log(`${t.key.padEnd(28)} ${t.title.padEnd(24)} ${c.duration.toFixed(1)}s ${t.bpm} bpm ${t.meter.join('/')}  ${t.mood}`);
  }
  process.exit(0);
}

if (args.calibrate) {
  // One note (or stroke) of every instrument at vel 0.8 in its default register, so the
  // instrument `level`s can be set from measurements: the catalogue gains then balance music.
  const rng = new Rng(7);
  const tonic = hz(midi('D3'));
  const measure = (buf) => {
    let peak = 0, sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = Math.abs(buf[i]);
      if (v > peak) peak = v;
      sum += v * v;
    }
    return `peak ${dB(peak).toFixed(1).padStart(6)} dB  rms ${dB(Math.sqrt(sum / buf.length)).toFixed(1).padStart(6)} dB`;
  };
  for (const [name, inst] of Object.entries(INSTRUMENTS)) {
    const stem = new Stem(name, RATE * 2);
    inst.play(stem, { t: 0.05, dur: 1, freq: tonic * Math.pow(2, inst.octave), vel: 0.8, rng });
    console.log(`${name.padEnd(12)} ${measure(stem.buf)}`);
  }
  for (const [name, sound] of Object.entries(PERC)) {
    const stem = new Stem(name, RATE * 3);
    sound(stem, 0.05, 0.8, rng, { sa: tonic * 2, spb: 0.6 });
    console.log(`perc ${name.padEnd(9)} ${measure(stem.buf)}`);
  }
  process.exit(0);
}

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(PICTURE_DIR, { recursive: true });
mkdirSync(WORK_DIR, { recursive: true });
const seedRows = [];
const summary = [];
const warnings = [];
for (const track of selected) {
  const started = Date.now();
  const composer = new Composer(track);
  const { L, R } = composer.render();
  if (args.stems) {
    for (const stem of Object.values(composer.stems)) {
      let peak = 0, sum = 0;
      for (let i = 0; i < stem.buf.length; i++) {
        const v = Math.abs(stem.buf[i]) * stem.gain;
        if (v > peak) peak = v;
        sum += v * v;
      }
      const bands = { low: 0, mid: 0, high: 0 };
      for (let c = FFT_SIZE / 2; c < composer.period - FFT_SIZE / 2; c += RATE / 2) {
        const p = spectrumAt(stem.buf, stem.buf, c);
        for (let i = 1; i < p.length; i++) {
          const f = (i * RATE) / FFT_SIZE;
          bands[f < 250 ? 'low' : f < 2000 ? 'mid' : 'high'] += p[i];
        }
      }
      const all = bands.low + bands.mid + bands.high || 1;
      const share = (v) => `${(10 * Math.log10(Math.max(v, 1e-12) / all)).toFixed(0).padStart(4)}`;
      console.log(`    ${stem.name.padEnd(12)} peak ${dB(peak).toFixed(1).padStart(6)} dB  rms ${dB(Math.sqrt(sum / composer.period)).toFixed(1).padStart(6)} dB  bands (dB of the stem) low ${share(bands.low)} mid ${share(bands.mid)} high ${share(bands.high)}`);
    }
  }
  if (args.notes) for (const line of composer.report()) console.log(line);
  // master, encode, decode and measure; AAC overshoots, so the ceiling comes down until the decoded peak fits
  const pcmPath = path.join(WORK_DIR, `${track.key}.f32`);
  const m4aPath = path.join(OUT_DIR, `${track.key}.m4a`);
  let ceiling = -2.2;
  let mastered, encoder, decoded, decodedPeak;
  for (let attempt = 0; ; attempt++) {
    mastered = master(L, R, ceiling);
    writeFileSync(pcmPath, encodeF32(mastered.L, mastered.R));
    encoder = encodeAac(pcmPath, m4aPath);
    decoded = decodeAac(m4aPath, path.join(WORK_DIR, `${track.key}.decoded.wav`));
    decodedPeak = dB(truePeak(decoded.L, decoded.R));
    if (decodedPeak <= DECODED_CEILING || attempt === 5) break;
    ceiling -= decodedPeak - DECODED_CEILING + 0.05;
  }
  rmSync(pcmPath);
  if (decodedPeak > DECODED_CEILING) warnings.push(`${track.key}: the decoded true peak is ${decodedPeak.toFixed(2)} dBTP`);
  // the decoder returns whole AAC frames: the last one's padding (under 1024 samples) is not part of the loop
  if (decoded.L.length < mastered.L.length || decoded.L.length > mastered.L.length + 1024) warnings.push(`${track.key}: decoded ${decoded.L.length} samples of ${mastered.L.length}`);
  decoded = { L: decoded.L.subarray(0, mastered.L.length), R: decoded.R.subarray(0, mastered.L.length) };
  if (args.wav) writeFileSync(path.join(OUT_DIR, `${track.key}.wav`), encodeWav(mastered.L, mastered.R));
  const heard = loudness(decoded.L, decoded.R);
  const ff = ffmpegLoudness(m4aPath);
  const stats = analyse(decoded.L, decoded.R);
  writeFileSync(path.join(PICTURE_DIR, `${track.key}.png`), picture(decoded.L, decoded.R));
  const seconds = probeDuration(m4aPath) ?? composer.duration;
  seedRows.push({ slug: track.key, file: `${track.key}.m4a`, title: track.title, durationSeconds: Math.round(seconds) });
  summary.push({ key: track.key, title: track.title, seconds, truePeak: decodedPeak, rms: stats.rmsDb, lufs: heard.integrated, ff });
  warnings.push(...composer.warnings);
  if (stats.lastSecond < -12) warnings.push(`${track.key}: the last second is ${stats.lastSecond.toFixed(1)} dB under the mix (the loop seam goes quiet)`);
  if (composer.firstNote > 0.5) warnings.push(`${track.key}: the first note comes at ${composer.firstNote.toFixed(2)} s`);
  const b = stats.bands;
  const top = Math.max(b.low, b.mid, b.high, 1e-12);
  const band = (v) => `${(10 * Math.log10(Math.max(v, 1e-12) / top)).toFixed(0)} dB`;
  const bars = composer.totalBeats / composer.beatsPerBar;
  console.log(`✓ ${track.key}  "${track.title}"  ${seconds.toFixed(2)} s (${bars} bars at ${track.bpm} bpm, ${encoder} ${BITRATE})  ${((Date.now() - started) / 1000).toFixed(1)} s`);
  console.log(
    `    loudness ${heard.integrated.toFixed(1)} LUFS (master ${mastered.loudness.toFixed(1)}${ff ? `, ffmpeg ${ff.integrated.toFixed(1)}` : ''}), range ${heard.range.toFixed(1)} LU · true peak ${decodedPeak.toFixed(2)} dBTP decoded${ff ? ` (ffmpeg ${ff.truePeak.toFixed(2)})` : ''}, ceiling ${ceiling.toFixed(2)} · sample peak ${stats.peakDb.toFixed(2)} dBFS · rms ${stats.rmsDb.toFixed(1)} dBFS · limiter -${(-dB(1 - mastered.reduction)).toFixed(1)} dB · presence +${mastered.tilt.toFixed(1)} dB`,
  );
  console.log(
    `    spectrum: centroid ${Math.round(stats.centroid)} Hz · bands <250 Hz ${band(b.low)}, 250-2k ${band(b.mid)}, >2k ${band(b.high)} · 85% roll-off ${Math.round(stats.rolloff)} Hz · quietest second ${stats.quietestDb.toFixed(1)} dB at ${stats.quietestAt}s · seam: last second ${stats.lastSecond.toFixed(1)} dB, first ${stats.firstSecond.toFixed(1)} dB, first note ${composer.firstNote.toFixed(2)} s · clipped ${stats.clipped}`,
  );
}
for (const w of warnings) console.warn(`! ${w}`);
if (seedRows.length) {
  console.log('\nORIGINAL_TRACKS rows:');
  for (const r of seedRows) console.log(`  { slug: '${r.slug}', file: '${r.file}', title: '${r.title.replace(/'/g, "\\'")}', artist: 'Bulava Originals', durationSeconds: ${r.durationSeconds} },`);
  console.log('\nslug | title | seconds | true peak dBTP | RMS dBFS | LUFS');
  for (const s of summary) console.log(`${s.key} | ${s.title} | ${s.seconds.toFixed(2)} | ${s.truePeak.toFixed(2)} | ${s.rms.toFixed(1)} | ${s.lufs.toFixed(1)}`);
}
