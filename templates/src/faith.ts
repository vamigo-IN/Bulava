import { emblemSize, FAITH_EMBLEMS, FAITHS, type Faith, type IllustrationName, type LayerInput, type TemplateDefinitionInput, type Value } from '@bulava/template-schema';
import type { CatalogEntry, CatalogMeta } from './builder';

/**
 * Each template's faith (docs/templates.md#faith), decided here for the whole
 * catalog so no theme is edited by hand: the tradition its design clearly
 * belongs to, from its tags. A faith template is tagged with its faith (the
 * galleries' tradition filter), carries `theme.faith` (sample names of that
 * tradition), words its wedding as that tradition does (Nikah, Anand Karaj,
 * Holy Matrimony) and, for the occasions below, wears the faith's emblem at
 * the very top of its hero: the hero's `emblem` prop, or an emblem layer on a
 * canvas opening (the factory's compositions place their own: kit.emblem).
 */

/** Tags naming one tradition's rites, festivals or ceremonies. */
const RITES: Record<Faith, readonly string[]> = {
  muslim: ['nikah', 'walima', 'eid', 'aqiqah'],
  sikh: ['anand-karaj', 'gurpurab'],
  christian: ['church', 'christmas', 'vow-renewal', 'baptism'],
  hindu: ['godh-bharai', 'seemantham', 'valaikappu', 'namkaran', 'mundan', 'upanayanam', 'janeu', 'thread-ceremony', 'griha-pravesh', 'puja', 'katha', 'ganesh-utsav', 'durga-puja', 'diwali', 'deepavali', 'holi', 'navratri', 'pongal', 'sankranti', 'krishna'],
};

/** Regional traditions whose wedding designs here are Hindu weddings (temples, mandaps, alpana, kasavu…). */
const HINDU_WEDDING_REGIONS = ['south-indian', 'tamil', 'telugu', 'kannada', 'malayali', 'kerala', 'bengali', 'marathi', 'maharashtrian', 'gujarati', 'rajasthani', 'north-indian', 'banarasi'];

/** The wedding family of occasions (regional tags make these Hindu designs). */
const WEDDING_CATEGORIES = new Set(['Wedding', 'Engagement', 'Haldi', 'Mehendi', 'Sangeet', 'Reception', 'Sangeet & Reception']);

/** Occasions whose invitations are crowned with the faith's emblem. Birthdays, anniversaries and festivals have their own art. */
export const EMBLEM_CATEGORIES: ReadonlySet<string> = new Set([
  ...WEDDING_CATEGORIES,
  'Puja & Ceremonies',
  'Puja',
  'Religious',
  'Thread Ceremony',
  'Mundan',
  'Naming Ceremony',
  'Baby Shower',
  'Housewarming',
]);

/**
 * The faith of a template or theme: the one faith its tags name; else the
 * tradition its rites name; else Hindu for a wedding design of a Hindu
 * regional tradition. A design tagged for two faiths (a mehendi for Hindu and
 * Muslim brides) suits both and has none.
 */
export function faithOf(meta: Pick<CatalogMeta, 'tags' | 'category'>): Faith | null {
  const named = FAITHS.filter((f) => meta.tags.includes(f));
  if (named.length) return named.length === 1 ? named[0]! : null;
  const byRite = FAITHS.filter((f) => RITES[f].some((t) => meta.tags.includes(t)));
  if (byRite.length) return byRite.length === 1 ? byRite[0]! : null;
  if (WEDDING_CATEGORIES.has(meta.category) && HINDU_WEDDING_REGIONS.some((t) => meta.tags.includes(t))) return 'hindu';
  return null;
}

/** How each tradition words its wedding, above the names (translation keys). */
const WEDDING_WORDS: Partial<Record<Faith, string>> = {
  muslim: 'template.nikah',
  sikh: 'template.anandKaraj',
  christian: 'template.holyMatrimony',
};

/** Replaces every `{ t: from }` in a definition with `{ t: to }` (eyebrows of heroes, canvases and films). */
function reword<T>(value: T, from: string, to: string): T {
  if (Array.isArray(value)) return value.map((v) => reword(v, from, to)) as T;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (record.t === from && Object.keys(record).length === 1) return { t: to } as T;
    return Object.fromEntries(Object.entries(record).map(([k, v]) => [k, reword(v, from, to)])) as T;
  }
  return value;
}

// ─────────────────────────── The emblem on a canvas opening ───────────────────────────

/** Width ÷ height of each emblem as drawn (ILLUSTRATION_ASPECT in the engine). */
const EMBLEM_ASPECT: Record<string, number> = { ganesha: 200 / 212, crescentStar: 1, khanda: 200 / 216, cross: 160 / 200 };

export interface EmblemPlace {
  /** The emblem's centre across the board and its top, in design units. */
  cx: number;
  top: number;
  /**
   * A disc of the stock under it, ringed in the metal: for a place over a
   * border, a garland or busy art, so the emblem reads clear of it.
   */
  seal?: boolean;
}

/**
 * The emblem's layers: a seal when asked for, then the emblem, upright and
 * still, in the design's metal (the secondary colour, foil), at the board's
 * one emblem size (EMBLEM_SIZE: the same on every design).
 */
export function emblemLayers(name: IllustrationName, place: EmblemPlace, board: { width: number; dark: boolean }): LayerInput[] {
  const h = emblemSize(board.width);
  const w = Math.round(h * (EMBLEM_ASPECT[name] ?? 1));
  const frame = { x: Math.round(place.cx - w / 2), y: Math.round(place.top), w, h };
  const emblem: LayerInput = { id: 'emblem', kind: 'ornament', ornament: name, color: 'secondary', foil: true, frame, animation: { entrance: 'fade', delaySec: 0.05 } };
  if (!place.seal) return [emblem];
  const r = Math.round(h * 0.72);
  const cx = Math.round(place.cx);
  const cy = Math.round(place.top + h / 2);
  return [
    { id: 'emblem-seal', kind: 'shape', shape: 'ellipse', frame: { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r }, fill: { type: 'color', color: board.dark ? 'primary' : 'surface' }, stroke: { width: board.width >= 800 ? 1.8 : 1.4, color: 'secondary' }, shadow: true, animation: { entrance: 'fade' } },
    { id: 'emblem-ring', kind: 'shape', shape: 'ellipse', frame: { x: cx - r + 4, y: cy - r + 4, w: 2 * r - 8, h: 2 * r - 8 }, fill: { type: 'none' }, stroke: { width: 0.6, color: 'secondary' }, animation: { entrance: 'fade' } },
    emblem,
  ];
}

type Frame = { x: number; y: number; w: number; h: number };
type BoardInput = { width: number; height: number; background?: unknown; layers?: LayerInput[] };

/**
 * Where the emblem sits on a hand-made canvas opening, phone and desktop: its
 * place, and the layers that make room for it (moved down or up, left out, or
 * replaced: one set of temple bells by two with the emblem between).
 */
interface Slot extends EmblemPlace {
  shift?: Record<string, number>;
  drop?: readonly string[];
  swap?: Record<string, LayerInput[]>;
}

const bells = (id: string, x: number, y: number, size: number, delaySec = 0): LayerInput => ({
  id,
  kind: 'ornament',
  ornament: 'templeBells',
  color: 'secondary',
  shadow: 'soft',
  frame: { x, y, w: size, h: size },
  animation: { entrance: 'fadeDown', motion: 'sway', ...(delaySec ? { delaySec } : {}) },
});

/** The hand-made canvas templates' emblem places (canvas.ts, canvas-cards.ts, premium-cards.ts). */
export const EMBLEM_SLOTS: Readonly<Record<string, { mobile: Slot; desktop?: Slot }>> = {
  // Stationery: on the mandala crown's heart; over the borders and swags on a seal.
  'royal-maroon-gold': { mobile: { cx: 195, top: 46, seal: true }, desktop: { cx: 405, top: 70, seal: true } },
  'kalyana-zari': { mobile: { cx: 195, top: 12, seal: true }, desktop: { cx: 470, top: 100 } },
  'phulkari-anand-karaj': { mobile: { cx: 195, top: 12, seal: true }, desktop: { cx: 1000, top: 92 } },
  // The crescent and star at the keystone of the mihrab, the lantern hanging from it.
  'mehrab-nikah': { mobile: { cx: 195, top: 16, seal: true }, desktop: { cx: 720, top: 22, seal: true, shift: { lantern: -8 } } },
  'lal-paar-bengali': { mobile: { cx: 195, top: 10, seal: true }, desktop: { cx: 1040, top: 92 } },
  'genda-phool-haldi': { mobile: { cx: 195, top: 12, seal: true }, desktop: { cx: 1040, top: 24, seal: true } },
  'sangeet-sandhya': { mobile: { cx: 195, top: 130 }, desktop: { cx: 1040, top: 148 } },
  // The card collection.
  'rose-arch-card': { mobile: { cx: 195, top: 16, shift: { hashtag: 56 } }, desktop: { cx: 152, top: 40, shift: { hashtag: 64 } } },
  'shahi-gajraj-card': { mobile: { cx: 195, top: 12, seal: true }, desktop: { cx: 182, top: 112 } },
  'mor-pankh-card': { mobile: { cx: 195, top: 6 }, desktop: { cx: 800, top: 164 } },
  'kovil-mani-card': {
    // Ganesha between two sets of temple bells.
    mobile: { cx: 195, top: 58, swap: { bells: [bells('bells-l', 60, 28, 104), bells('bells-r', 226, 28, 104, 0.1)] } },
    desktop: { cx: 720, top: 46, shift: { 'eyebrow-1': 16, 'eyebrow-2': 16, names: 14, lotus: 8, date: 4 } },
  },
  // The crescent and star crowns the night sky in place of the moon.
  'noor-mahal-card': { mobile: { cx: 195, top: 46, drop: ['moon'] }, desktop: { cx: 960, top: 138, drop: ['moon'] } },
  'eternal-bloom-card': { mobile: { cx: 195, top: 22, seal: true }, desktop: { cx: 960, top: 62 } },
  'shubh-griha-card': { mobile: { cx: 195, top: 12, seal: true }, desktop: { cx: 232, top: 122 } },
};

const id = (l: LayerInput) => (l as { id: string }).id;

/** An artboard with the emblem at its slot: the layers in the way moved, left out or replaced, the emblem drawn over the art. */
function withEmblemLayer<B extends BoardInput>(board: B, name: IllustrationName, slot: Slot, dark: boolean): B {
  const layers = (board.layers ?? []).flatMap((l) => {
    if (slot.drop?.includes(id(l))) return [];
    const swap = slot.swap?.[id(l)];
    if (swap) return swap;
    const dy = slot.shift?.[id(l)];
    return dy ? [{ ...l, frame: { ...(l as { frame: Frame }).frame, y: (l as { frame: Frame }).frame.y + dy } } as LayerInput] : [l];
  });
  return { ...board, layers: [...layers, ...emblemLayers(name, slot, { width: board.width, dark })] };
}

/** Is the stock dark (light words on it)? From its background's luminance in the template's palette. */
function darkStock(board: { background?: unknown }, colors: Record<string, string>): boolean {
  const fill = board.background as { type?: string; color?: string; gradient?: { from: string; to: string } } | undefined;
  const refs = fill?.type === 'color' ? [fill.color] : fill?.type === 'gradient' ? [fill.gradient!.from, fill.gradient!.to] : ['background'];
  const lum = refs.map((r) => {
    const hex = r?.startsWith('#') ? r : colors[r ?? 'background'];
    const m = /^#([0-9a-f]{6})/i.exec(hex ?? '');
    if (!m) return 1;
    const n = Number.parseInt(m[1]!, 16);
    return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  });
  return lum.reduce((a, b) => a + b, 0) / lum.length < 0.35;
}

/** The emblem on a definition's hero: a prop on a drawn hero, a layer on a canvas opening (unless it has one). */
function withEmblem(definition: TemplateDefinitionInput, faith: Faith, key: string): TemplateDefinitionInput {
  const pages = definition.website?.pages;
  const hero = pages?.[0]?.sections[0];
  if (!definition.website || !pages || !hero) return definition;
  const name = FAITH_EMBLEMS[faith];
  let next = hero;
  if (hero.section === 'hero') {
    next = { ...hero, props: { ...(hero.props ?? {}), emblem: { literal: name } satisfies Value } };
  } else if (hero.section === 'canvas' && hero.canvas) {
    const mobile = hero.canvas.mobile as BoardInput;
    if ((mobile.layers ?? []).some((l) => id(l) === 'emblem')) return definition;
    const slots = EMBLEM_SLOTS[key];
    if (!slots) return definition;
    const colors = definition.theme.colors as Record<string, string>;
    next = {
      ...hero,
      canvas: {
        ...hero.canvas,
        mobile: withEmblemLayer(mobile, name, slots.mobile, darkStock(mobile, colors)) as never,
        ...(hero.canvas.desktop && slots.desktop ? { desktop: withEmblemLayer(hero.canvas.desktop as BoardInput, name, slots.desktop, darkStock(hero.canvas.desktop, colors)) as never } : {}),
      },
    };
  }
  return { ...definition, website: { ...definition.website, pages: [{ ...pages[0]!, sections: [next, ...pages[0]!.sections.slice(1)] }, ...pages.slice(1)] } };
}

/**
 * A catalog entry with its faith applied: the faith tag, `theme.faith`, the
 * tradition's wedding wording and, for the occasions that carry one, the
 * emblem. Entries of no single faith are returned as they are.
 */
export function withFaith(entry: CatalogEntry): CatalogEntry {
  const faith = faithOf(entry.meta);
  if (!faith) return entry;
  const tags = entry.meta.tags.includes(faith) ? entry.meta.tags : [...entry.meta.tags, faith];
  let definition: TemplateDefinitionInput = { ...entry.definition, theme: { ...entry.definition.theme, faith } };
  const words = WEDDING_WORDS[faith];
  if (words) definition = reword(definition, 'template.weddingOf', words);
  if (EMBLEM_CATEGORIES.has(entry.meta.category)) definition = withEmblem(definition, faith, entry.meta.key);
  return { meta: { ...entry.meta, tags }, definition };
}

/** The emblem a factory theme's kit carries, from its faith and occasion's category (collection.ts). */
export function emblemFor(meta: Pick<CatalogMeta, 'tags' | 'category'>): { name: (typeof FAITH_EMBLEMS)[Faith]; tint: 'secondary'; foil: true } | undefined {
  const faith = faithOf(meta);
  return faith && EMBLEM_CATEGORIES.has(meta.category) ? { name: FAITH_EMBLEMS[faith], tint: 'secondary', foil: true } : undefined;
}
