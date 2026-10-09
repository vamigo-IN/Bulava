import type { Artboard, ColorRef, Fill } from './canvas';
import type { ThemeColors } from './definition';

/**
 * A design's look: which illustrations its phone artboard shows and where,
 * on light or dark stock. Palettes, fonts and words are left out on purpose:
 * customers change those, so two templates that differ only there are one
 * design (a wedding design and its anniversary version, or the same card in
 * two colourways). Galleries show each look once, and the catalog keeps one
 * template per look and occasion (templates/src/lookalikes.ts).
 */

/** Design units per step when comparing where art sits (a tenth of a phone's width). */
const GRID = 40;

/** Relative luminance of a #rrggbb colour, 0 (black) to 1 (white). */
function luminance(hex: string | undefined): number | null {
  const m = /^#([0-9a-f]{6})/i.exec(hex ?? '');
  if (!m) return null;
  const n = Number.parseInt(m[1]!, 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

const resolve = (color: ColorRef, colors: ThemeColors): string | undefined => (color.startsWith('#') ? color : (colors as Record<string, string>)[color]);

/** Light or dark stock, from the artboard's background in the template's palette: a preset recolours a card but does not turn a light card dark. */
function stock(fill: Fill, colors: ThemeColors): 'light' | 'dark' | 'image' {
  if (fill.type === 'image') return 'image';
  const refs = fill.type === 'color' ? [fill.color] : fill.type === 'gradient' ? [fill.gradient.from, fill.gradient.to] : fill.type === 'pattern' ? [fill.base] : [];
  const values = refs.map((c) => luminance(resolve(c, colors))).filter((v): v is number => v !== null);
  return values.length && values.reduce((a, b) => a + b, 0) / values.length < 0.2 ? 'dark' : 'light';
}

/** A short, stable hash (cyrb53) in base 36. */
function hash(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** The look of an artboard (the template's phone artboard), or null when it shows no illustrations: text-only designs differ by their words. */
export function designLook(board: Pick<Artboard, 'layers' | 'background'>, colors: ThemeColors): string | null {
  const g = (n: number) => Math.round(n / GRID);
  const art = board.layers.flatMap((l) => {
    if (l.hidden || (l.kind !== 'ornament' && l.kind !== 'scene')) return [];
    const name = l.kind === 'scene' ? `scene:${l.scene}` : l.ornament;
    return [`${name}@${g(l.frame.x + l.frame.w / 2)},${g(l.frame.y + l.frame.h / 2)},${g(l.frame.w)}`];
  });
  if (!art.length) return null;
  return hash(`${stock(board.background, colors)} ${art.sort().join(' ')}`);
}
