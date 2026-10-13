import type { IllustrationName } from './canvas';

/**
 * The faiths a template's design can belong to (docs/templates.md#faith). A
 * faith template wears its tradition's emblem at the very top of its hero and
 * shows sample names of that tradition; designs that fit any family have none.
 */
export const FAITHS = ['hindu', 'muslim', 'sikh', 'christian'] as const;
export type Faith = (typeof FAITHS)[number];

/** Each faith's emblem: Lord Ganesha, the crescent and star, the Khanda, the cross. */
export const FAITH_EMBLEMS: Record<Faith, IllustrationName> = {
  hindu: 'ganesha',
  muslim: 'crescentStar',
  sikh: 'khanda',
  christian: 'cross',
};

/** The emblem illustrations: always upright at the top, never cropped, flipped or behind text. */
export const EMBLEM_NAMES: ReadonlySet<string> = new Set(Object.values(FAITH_EMBLEMS));

/**
 * The emblem's height on a canvas opening, in design units: the same on every
 * design, 48 on a phone board (390 wide) and 64 on a desktop board (1440 wide).
 */
export const EMBLEM_SIZE = { phone: 48, desktop: 64 } as const;

/** The emblem height for a board of this width. */
export const emblemSize = (boardWidth: number): number => (boardWidth >= 800 ? EMBLEM_SIZE.desktop : EMBLEM_SIZE.phone);

/** The faith a template's tags name, when they name exactly one (a design tagged for two families is for both). */
export function faithFromTags(tags: readonly string[] = []): Faith | null {
  const named = FAITHS.filter((f) => tags.includes(f));
  return named.length === 1 ? named[0]! : null;
}

/** A small, stable number from a string (template keys seed the sample content). */
export function seedNumber(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
