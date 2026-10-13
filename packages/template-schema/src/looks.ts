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

/** Scattered specks that never make two designs different (a sky of stars, sparkles, confetti). */
const SPECKS = new Set<string>(['stars', 'sparkles', 'confetti']);

/** The look of an artboard (the template's phone artboard), or null when it shows no illustrations: text-only designs differ by their words. */
export function designLook(board: Pick<Artboard, 'layers' | 'background'>, colors: ThemeColors): string | null {
  const g = (n: number) => Math.round(n / GRID);
  const art = board.layers.flatMap((l) => {
    if (l.hidden || (l.kind !== 'ornament' && l.kind !== 'scene')) return [];
    const name = l.kind === 'scene' ? `scene:${l.scene}` : l.ornament;
    if (SPECKS.has(name)) return [];
    return [`${name}@${g(l.frame.x + l.frame.w / 2)},${g(l.frame.y + l.frame.h / 2)},${g(l.frame.w)}`];
  });
  if (!art.length) return null;
  return hash(`${stock(board.background, colors)} ${art.sort().join(' ')}`);
}

type Board = Pick<Artboard, 'layers' | 'background' | 'width' | 'height'>;

/**
 * Who or what a hero is about, as a customer would put it: any bride and groom
 * in Indian dress are "a couple", a church couple and a couple who have shared a
 * lifetime are their own, a girl and a boy differ, a unicorn is not a dinosaur.
 */
const SUBJECT_CLASS: Readonly<Record<string, string>> = {
  coupleHindu: 'couple',
  coupleVarmala: 'couple',
  coupleSikh: 'couple',
  coupleNikah: 'couple',
  coupleSouth: 'couple',
  coupleBengali: 'couple',
  brideBust: 'couple',
  groomBust: 'couple',
  coupleChristian: 'church couple',
  coupleElder: 'elders',
  kidGirl: 'girl',
  kidBoy: 'boy',
  babyCradle: 'baby',
  stork: 'baby',
  momToBe: 'mother',
  unicorn: 'unicorn',
  dino: 'dinosaur',
  teddyBear: 'teddy',
  rocket: 'rocket',
  cupcake: 'cupcake',
  cake: 'cake',
  giftBox: 'presents',
  house: 'house',
  kalash: 'kalash',
  haldiBowl: 'haldi',
  dhol: 'dhol',
  champagne: 'champagne',
  mehendiHand: 'mehendi',
  doli: 'doli',
  moonCloud: 'moon',
};

/**
 * What a hero shows, weighted by size: each illustration, scene and photo frame
 * once by name and once by where it sits (a sixth of the width, a tenth of the
 * height), large art weighing more than small, and its subject (the largest
 * figure or centrepiece) weighing most.
 */
function artWeights(board: Board): Map<string, number> {
  const out = new Map<string, number>();
  const add = (k: string, w: number) => out.set(k, (out.get(k) ?? 0) + w);
  let subject: { name: string; area: number } | null = null;
  for (const l of board.layers) {
    if (l.hidden || l.kind !== 'ornament') continue;
    const cls = SUBJECT_CLASS[l.ornament];
    const area = l.frame.w * l.frame.h;
    if (cls && (!subject || area > subject.area)) subject = { name: cls, area };
  }
  if (subject) add(`subject:${subject.name}`, 3);
  for (const l of board.layers) {
    if (l.hidden || (l.kind !== 'ornament' && l.kind !== 'scene' && l.kind !== 'image')) continue;
    const name = l.kind === 'scene' ? `scene:${l.scene}` : l.kind === 'image' ? `photo:${l.mask ?? 'none'}` : l.ornament;
    if (SPECKS.has(name)) continue;
    const area = Math.min(1, (l.frame.w * l.frame.h) / (board.width * board.height));
    const w = 0.3 + Math.sqrt(area) * 3;
    add(name, w);
    add(`${name}@${Math.round((l.frame.x + l.frame.w / 2) / (board.width / 6))},${Math.round((l.frame.y + l.frame.h / 2) / (board.height / 10))}`, w);
  }
  return out;
}

/**
 * How alike two heroes look to a customer, 0 to 1, whatever their colours: the
 * overlap of their art and where it sits (weighted by size), a little less when
 * one is on dark stock and the other on light. Two templates of one occasion
 * at HERO_LOOKALIKE or above are one design in two colourways
 * (docs/templates.md#lookalikes).
 */
export function heroSimilarity(a: Board, b: Board, colorsA: ThemeColors, colorsB: ThemeColors): number {
  const x = artWeights(a);
  const y = artWeights(b);
  let inter = 0;
  let union = 0;
  for (const k of new Set([...x.keys(), ...y.keys()])) {
    const p = x.get(k) ?? 0;
    const q = y.get(k) ?? 0;
    inter += Math.min(p, q);
    union += Math.max(p, q);
  }
  const overlap = union ? inter / union : 0;
  return stock(a.background, colorsA) === stock(b.background, colorsB) ? overlap : overlap * 0.85;
}

/** At or above this, two heroes of one occasion read as the same design (heroSimilarity). */
export const HERO_LOOKALIKE = 0.72;
