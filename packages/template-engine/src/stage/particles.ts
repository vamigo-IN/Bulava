import type { EffectName } from '@bulava/template-schema';
import { rand } from '../art/motifs';
import { posesOf } from './camera';
import type { Motion, StageSet, Vec3 } from './types';
import { FLOOR_Y, HORIZON_Y, perspectiveOf } from './units';

/**
 * Particles at depth (final.md §3.1.7): the template's effect drawn in the
 * stage itself, at seeded depths between the set's dNear and dFar, so they
 * move with parallax as the camera does. Web: up to 40 (the set's count);
 * films: min(60, round(count × 1.5)). Each particle is one element: its place
 * on the individual `translate` property and its fall, rise or hover as the
 * motion's `transform`.
 */

export type ParticleEffect = Exclude<EffectName, 'none'>;

export interface Particle {
  /** 'particle-<i>'. */
  id: string;
  effect: ParticleEffect;
  /** The centre of its path (world units). */
  at: Vec3;
  /** Its box (units, square). */
  size: number;
  /** Its path: fall or rise over the visible height at its depth (bob for fireflies), seeded period and phase. */
  motion: Motion;
  /** rand() salt for its art (tone, turn). */
  seed: number;
}

/** Most particles cross the phone's view; the rest fill the desktop's sides. */
const PHONE_SHARE = 0.7;
/** Half the phone's view at frame scale (x 415–785) and the desktop's (x 0–1200). */
const PHONE_HALF = 185;
const DESKTOP_HALF = 600;

/** Effects whose particles rise (lanterns and embers); fireflies hover; the rest fall. */
const RISING: ReadonlySet<ParticleEffect> = new Set(['lanterns', 'goldDust']);

/** A film's particle count for a set: min(60, round(count × 1.5)). */
export const filmParticleCount = (set: Pick<StageSet, 'particles'>): number => Math.min(60, Math.round(set.particles.count * 1.5));

/** The particles of an effect in a set (count: the set's own for the web, filmParticleCount for films), placed deterministically from `seed`. */
export function placeParticles(set: Pick<StageSet, 'particles' | 'poses'>, effect: EffectName, count: number, seed = 1): Particle[] {
  if (effect === 'none' || count <= 0) return [];
  const { rest } = posesOf(set);
  const p = perspectiveOf(rest.fov);
  const dNear = Math.max(1, set.particles.dNear);
  const dFar = Math.max(dNear, set.particles.dFar);
  const n = Math.min(60, Math.round(count));
  const r = (i: number, salt: number) => rand(i, seed * 101 + salt);
  // Which cross the phone: each particle draws against PHONE_SHARE, and when a field's draws fall short of
  // round(PHONE_SHARE × n) (a field near 20 could come out at 0.56), the nearest misses join them, so no count leaves
  // the phone thin. Fields that drew more keep them.
  const all = Array.from({ length: n }, (_, i) => i);
  const phone = new Set(all.filter((i) => r(i, 3) < PHONE_SHARE));
  const short = Math.round(PHONE_SHARE * n) - phone.size;
  if (short > 0)
    for (const i of all
      .filter((j) => !phone.has(j))
      .sort((a, b) => r(a, 3) - r(b, 3) || a - b)
      .slice(0, short))
      phone.add(i);
  const out: Particle[] = [];
  for (let i = 0; i < n; i++) {
    // Depth: stratified, so every depth band has its share.
    const d = dNear + (dFar - dNear) * ((i + r(i, 1)) / n);
    const k = p / d;
    // Across: the phone's band at that depth for most, the desktop's sides for the rest.
    const side = r(i, 2) < 0.5 ? -1 : 1;
    const phoneHalf = (PHONE_HALF / k) * 0.92;
    const offset = phone.has(i) ? phoneHalf * (r(i, 4) * 2 - 1) : side * (phoneHalf + (DESKTOP_HALF / k - phoneHalf) * r(i, 4));
    const x = rest.x + offset;
    const size = Math.round(14 + 14 * r(i, 5));
    // The frame's top and bottom at that depth, the bottom no lower than the floor.
    const top = rest.y + (0 - HORIZON_Y) / k;
    const bottom = Math.min(rest.y + (800 - HORIZON_Y) / k, FLOOR_Y - size / 2);
    const period = Math.round((6 + 5 * r(i, 6)) * 10) / 10;
    const phase = Math.round(r(i, 7) * 100) / 100;
    let y: number;
    let motion: Motion;
    if (effect === 'fireflies') {
      // Hover low over the set, bobbing slowly.
      y = Math.round(top + (bottom - top) * (0.45 + 0.5 * r(i, 8)));
      motion = { kind: 'bob', amp: Math.round(24 + 30 * r(i, 9)), period: Math.round((4 + 3 * r(i, 6)) * 10) / 10, phase };
    } else {
      y = Math.round((top + bottom) / 2);
      motion = { kind: RISING.has(effect) ? 'rise' : 'fall', amp: Math.round((bottom - top) / 2), period, phase };
    }
    out.push({ id: `particle-${i}`, effect, at: { x: Math.round(x), y, z: Math.round(rest.z - d) }, size, motion, seed: seed * 1000 + i });
  }
  return out;
}
