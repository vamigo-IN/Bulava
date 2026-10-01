#!/usr/bin/env node
/**
 * Development helper: synthesize an ORIGINAL, royalty-free demo track (a
 * tanpura-style drone with a slow pentatonic melody) and register it in the
 * music library through the admin API, exactly as an admin upload would.
 *
 *   ADMIN_EMAIL=… ADMIN_PASSWORD=… node infrastructure/scripts/demo-music.mjs [--base http://localhost:3001] [--out ./demo-track.m4a] [--no-upload]
 *
 * The audio is generated here from sine waves, so Bulava owns it outright; it
 * is registered as "Original work" with commercial and on-demand use allowed.
 * Encoding uses the FFmpeg binary that ships with Remotion.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, all) => (v.startsWith('--') ? [...acc, [v.slice(2), all[i + 1]?.startsWith('--') ? true : (all[i + 1] ?? true)]] : acc), []));
const BASE = typeof args.base === 'string' ? args.base : 'http://localhost:3001';
const OUT = path.resolve(typeof args.out === 'string' ? args.out : 'demo-track.m4a');
const RATE = 44100;
const SECONDS = 48;

// ───── Synthesis ─────
const SA = 138.59; // C#3
const samples = new Float32Array(RATE * SECONDS);

function pluck(start, freq, amp) {
  // Tanpura-like pluck: rich harmonics, slow decay, a gentle shimmer (jawari).
  const harmonics = [1, 0.62, 0.45, 0.33, 0.22, 0.16, 0.1];
  const from = Math.floor(start * RATE);
  const len = Math.min(samples.length - from, Math.floor(4.5 * RATE));
  for (let i = 0; i < len; i++) {
    const t = i / RATE;
    const env = Math.exp(-t / 1.6) * Math.min(1, t / 0.01);
    let v = 0;
    harmonics.forEach((h, k) => {
      const shimmer = 1 + 0.003 * Math.sin(2 * Math.PI * (0.7 + k * 0.2) * t);
      v += h * Math.sin(2 * Math.PI * freq * (k + 1) * shimmer * t);
    });
    samples[from + i] += amp * env * v;
  }
}

function bell(start, freq, dur, amp) {
  // Soft flute/bell voice with a slow vibrato.
  const from = Math.floor(start * RATE);
  const len = Math.min(samples.length - from, Math.floor(dur * RATE));
  for (let i = 0; i < len; i++) {
    const t = i / RATE;
    const attack = Math.min(1, t / 0.08);
    const release = Math.min(1, (dur - t) / 0.6);
    const vib = 1 + 0.004 * Math.sin(2 * Math.PI * 5.2 * t);
    const v = Math.sin(2 * Math.PI * freq * vib * t) + 0.18 * Math.sin(4 * Math.PI * freq * vib * t);
    samples[from + i] += amp * attack * Math.max(0, release) * v;
  }
}

// Drone cycle: Pa, Sa', Sa', Sa (the classic tanpura pattern), every 4 s.
for (let c = 0; c * 4 < SECONDS; c++) {
  const t0 = c * 4;
  pluck(t0, SA * 1.5 / 2, 0.16);
  pluck(t0 + 1, SA, 0.14);
  pluck(t0 + 2, SA, 0.14);
  pluck(t0 + 3, SA / 2, 0.18);
}

// Melody (Bhupali-like pentatonic: Sa Re Ga Pa Dha), sparse and calm.
const RATIO = { S: 1, R: 9 / 8, G: 5 / 4, P: 3 / 2, D: 5 / 3, 'S\'': 2 };
const M = SA * 4; // melody two octaves up
const phrase = [
  ['G', 2], ['R', 1], ['S', 2], ['D', 1], ['P', 3],
  ['G', 1.5], ['P', 1.5], ['D', 2], ['S\'', 3],
  ['D', 1.5], ['P', 1.5], ['G', 2], ['R', 1.5], ['S', 3.5],
];
let at = 4;
while (at < SECONDS - 6) {
  for (const [note, dur] of phrase) {
    if (at + dur > SECONDS - 3) break;
    bell(at, M * RATIO[note] / 2, dur + 0.4, 0.09);
    at += dur;
  }
  at += 2;
}

// Fades and normalisation to -3 dBFS.
const fadeIn = 2 * RATE;
const fadeOut = 3 * RATE;
let peak = 0;
for (let i = 0; i < samples.length; i++) {
  if (i < fadeIn) samples[i] *= i / fadeIn;
  if (i > samples.length - fadeOut) samples[i] *= (samples.length - i) / fadeOut;
  peak = Math.max(peak, Math.abs(samples[i]));
}
const gain = peak ? 0.707 / peak : 1;

const wav = Buffer.alloc(44 + samples.length * 2);
wav.write('RIFF', 0);
wav.writeUInt32LE(36 + samples.length * 2, 4);
wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(RATE, 24);
wav.writeUInt32LE(RATE * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36);
wav.writeUInt32LE(samples.length * 2, 40);
for (let i = 0; i < samples.length; i++) wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i] * gain)) * 32767), 44 + i * 2);
const wavPath = OUT.replace(/\.[^.]+$/, '.wav');
writeFileSync(wavPath, wav);

// ───── Encode (AAC in M4A) with Remotion's bundled FFmpeg ─────
function findFfmpeg() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  const root = path.resolve('node_modules/.pnpm');
  const dir = readdirSync(root).find((d) => d.startsWith('@remotion+compositor-'));
  if (!dir) throw new Error('Remotion compositor not found; set FFMPEG_PATH');
  const pkg = path.join(root, dir, 'node_modules', '@remotion', dir.replace('@remotion+', '').replace(/@[\d.]+$/, ''));
  for (const exe of ['ffmpeg.exe', 'ffmpeg']) if (existsSync(path.join(pkg, exe))) return path.join(pkg, exe);
  throw new Error('ffmpeg not found in the Remotion compositor');
}
const ff = spawnSync(findFfmpeg(), ['-hide_banner', '-loglevel', 'error', '-y', '-i', wavPath, '-c:a', 'aac', '-b:a', '128k', '-f', 'mp4', OUT], { stdio: 'inherit' });
if (ff.status !== 0) throw new Error('ffmpeg failed');
console.log(`✓ generated ${OUT} (${SECONDS}s)`);

if (args['no-upload']) process.exit(0);

// ───── Register through the admin API (signed upload, licence, approval) ─────
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD to register the track (or pass --no-upload).');
  process.exit(2);
}
let cookie = '';
async function call(method, url, body) {
  const res = await fetch(`${BASE}/api/v1${url}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-bulava-csrf': '1', cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const set = res.headers.getSetCookie?.() ?? [];
  if (set.length) cookie = set.map((c) => c.split(';')[0]).join('; ');
  const json = await res.json();
  if (!json.success) throw new Error(`${method} ${url}: ${json.error?.code} ${json.error?.message}`);
  return json.data;
}
await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD });
const title = typeof args.title === 'string' ? args.title : 'Shubh Aarambh (Tanpura & Bansuri)';
const existing = (await call('GET', '/admin/music')).find((m) => m.title === title);
if (existing) {
  console.log(`✓ "${title}" is already in the library (${existing.status})`);
  process.exit(0);
}
const bytes = readFileSync(OUT);
const signed = await call('POST', '/admin/uploads/music', { contentType: 'audio/mp4', fileName: path.basename(OUT) });
const put = await fetch(signed.uploadUrl, { method: 'PUT', body: bytes, headers: signed.headers });
if (!put.ok) throw new Error(`upload failed: ${put.status}`);
const track = await call('POST', '/admin/music', {
  storageKey: signed.storageKey,
  title,
  artist: 'Bulava Originals',
  durationSeconds: SECONDS,
  collection: 'ORIGINAL',
  license: { licenseType: 'Original work', provider: 'Bulava (generated in-house)', commercialUse: true, onDemandUse: true, socialMediaUse: true, attributionRequired: false },
});
await call('POST', `/admin/music/${track.id}/review`, { status: 'APPROVED' });
console.log(`✓ registered and approved "${title}" (${track.id})`);
