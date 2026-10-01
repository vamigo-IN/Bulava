/**
 * WCAG colour contrast helpers. Templates keep their designed palette; text
 * colours derived from it are nudged (same hue, darker or lighter) only as far
 * as needed to be readable, so a customer's custom colours stay legible too.
 */

/** WCAG AA for normal-size text. */
export const AA_TEXT = 4.5;

function channels(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('')}`;
}

/** Relative luminance (WCAG 2.x). */
export function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The closest colour to `fg` (mixing towards black on light backgrounds, white
 * on dark ones) with at least `ratio` contrast against every background.
 * Returns `fg` unchanged when it already passes.
 */
export function ensureContrast(fg: string, backgrounds: readonly string[], ratio: number = AA_TEXT): string {
  const passes = (c: string) => backgrounds.every((bg) => contrastRatio(c, bg) >= ratio);
  if (passes(fg)) return fg;
  const darkBackground = luminance(backgrounds[0] ?? '#ffffff') < 0.18;
  const target: [number, number, number] = darkBackground ? [255, 255, 255] : [0, 0, 0];
  const from = channels(fg);
  for (let step = 1; step <= 50; step++) {
    const t = step / 50;
    const mixed = toHex([0, 1, 2].map((i) => from[i]! + (target[i]! - from[i]!) * t) as [number, number, number]);
    if (passes(mixed)) return mixed;
  }
  return toHex(target);
}
