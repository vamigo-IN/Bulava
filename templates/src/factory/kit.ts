import type { CanvasSectionInput, LayerInput, OrnamentLayerName, PhotoSlot, SceneLayer, Value } from '@bulava/template-schema';
import { TITLE, type FontPreset, type SlotKey } from '../builder';
import { at, b, orn, t, type CanvasSpec, type Frame, type TextStyleInput } from '../canvas-kit';

/**
 * The template factory's vocabulary. A *kit* is a theme's art direction (which
 * illustrations sit where, light or dark stock, foil, texture); an *occasion*
 * is what is being celebrated (its category, event types, eyebrow lines and
 * sections); a *composition* lays a kit out for an occasion on the phone and
 * desktop artboards, with a card for every function. Every colour is a
 * palette role, so each template's presets restyle the art with the text.
 */

export type Role = 'primary' | 'secondary' | 'accent' | 'background' | 'surface' | 'text' | 'muted';
export type Tint = Role | `#${string}`;
export type SceneName = SceneLayer['scene'];
export type CardStyle = 'framed' | 'banded' | 'garland' | 'header' | 'sky' | 'minimal';

/** One piece of art: an ornament or illustration, its tint, and foil for its metal. */
export interface Art {
  name: OrnamentLayerName;
  tint?: Tint;
  foil?: boolean;
}

export interface Kit {
  /** Dark stock (the primary deepening to the text colour) or light (surface to background). */
  dark: boolean;
  texture: 'none' | 'paper' | 'linen' | 'grain' | 'watercolor';
  strength: number;
  /** Names in metallic foil. */
  foil: boolean;
  nameFont: 'script' | 'heading';
  /** A heavier weight for heading-font names (rounded display faces). */
  nameWeight?: number;
  /** Scales the names (set from the occasion: event titles are longer than names). */
  titleScale?: number;
  /** The leading illustration: a couple, a child, a baby, a cake, a house… */
  hero?: Art;
  /** Figures that flank the centre (elephants, peacocks, doves, lanterns, balloons…). */
  pair?: Art;
  /** Across the top: a toran, a garland, bunting, fairy lights, a temple border. */
  top?: Art;
  /** Mirrored corners: filigree, paisleys, rose clusters. */
  corner?: Art;
  /** Behind the photo or the names, turning slowly: a medallion, an arabesque, a kolam, a rangoli (round motifs only). */
  centre?: Art;
  /** Floats over the dream layout's sky and the sky card: a moon on a cloud, a stork, a rocket. */
  float?: Art;
  /** Hanging from the top: lanterns, jasmine, marigold strings, temple bells. */
  hang?: Art;
  /** Scenery along the bottom. */
  scene?: SceneName;
  /** A row along the bottom (domes, diyas). */
  skyline?: Art;
  /** The small divider under the names. */
  motif: Art;
  /** The small emblem at the top of minimal layouts and garland cards (the occasion's when unset). */
  crest?: Art;
  /** Particles over the sky: stars, confetti. */
  sky?: Art;
  /** A Devanagari invocation above everything (Hindu themes). */
  invocation?: string;
  card: CardStyle;
}

export interface Occasion {
  key: string;
  category: string;
  eventTypes: string[];
  eyebrows: Array<[string[], Value]>;
  /** Names are a couple's (both partners) or one person's. */
  couple: boolean;
  /** The emblem minimal layouts and garland cards show when the theme sets none: rings, a cupcake, a kalash… */
  crest: Art;
  /** The title is usually the event's own (a housewarming, a puja), longer than names: set smaller, on two lines. */
  longTitle?: boolean;
  slots: SlotKey[];
  photoSlots: PhotoSlot[];
  middle: CanvasSpec['middle'];
}

export interface Built {
  hero: CanvasSectionInput;
  card: CanvasSectionInput;
}

export interface Composition {
  key: string;
  build: (kit: Kit, occasion: Occasion) => Built;
}

// ─────────────────────────── Proportions of the art (width ÷ height, as drawn) ───────────────────────────

const ASPECT: Partial<Record<OrnamentLayerName, number>> = {
  elephant: 350 / 280,
  royalPeacock: 320 / 400,
  jharokha: 300 / 440,
  filigreeCorner: 1,
  flourish: 5,
  medallion: 1,
  paisleyOrnate: 160 / 222,
  roseCluster: 320 / 270,
  templeBells: 1,
  bananaLeaf: 220 / 380,
  kolam: 1,
  mehendiHand: 240 / 340,
  domes: 400 / 232,
  arabesque: 1,
  doves: 1.5,
  rings: 230 / 170,
  cake: 0.8,
  balloonBunch: 270 / 350,
  giftBox: 1,
  moonCloud: 300 / 260,
  house: 1,
  diyaRow: 400 / 110,
  rangoliBloom: 1,
  coupleHindu: 300 / 380,
  coupleVarmala: 300 / 380,
  coupleSikh: 300 / 380,
  coupleNikah: 300 / 380,
  coupleSouth: 300 / 380,
  coupleChristian: 300 / 380,
  coupleBengali: 300 / 380,
  coupleElder: 300 / 380,
  kidBoy: 200 / 314,
  kidGirl: 200 / 314,
  babyCradle: 260 / 220,
  momToBe: 220 / 340,
  brideBust: 1,
  groomBust: 1,
  stork: 300 / 230,
  teddyBear: 200 / 220,
  unicorn: 220 / 250,
  dino: 260 / 210,
  rocket: 170 / 270,
  cupcake: 160 / 210,
  doli: 320 / 250,
  dhol: 220 / 170,
  haldiBowl: 240 / 170,
  champagne: 220 / 230,
  lotus: 90 / 54,
  kalash: 48 / 62,
  lantern: 0.5,
  crescent: 1,
  peacock: 1,
  mandala: 1,
  geometric: 1,
};

export const aspectOf = (name: OrnamentLayerName) => ASPECT[name] ?? 1;

/** A frame for art at its own proportions, as large as fits (maxW × maxH), centred on cx with its bottom at `bottom`. */
export function fit(name: OrnamentLayerName, cx: number, bottom: number, maxW: number, maxH: number, rotate?: number): Frame {
  const a = aspectOf(name);
  const w = Math.min(maxW, maxH * a);
  const h = w / a;
  return at(Math.round(cx - w / 2), Math.round(bottom - h), Math.round(w), Math.round(h), rotate);
}

/** The same, centred on (cx, cy). */
export function fitCentre(name: OrnamentLayerName, cx: number, cy: number, maxW: number, maxH: number, rotate?: number): Frame {
  const a = aspectOf(name);
  const w = Math.min(maxW, maxH * a);
  const h = w / a;
  return at(Math.round(cx - w / 2), Math.round(cy - h / 2), Math.round(w), Math.round(h), rotate);
}

/** Round motifs turn in place; other art would look wrong spinning. */
const ROUND = new Set<OrnamentLayerName>(['medallion', 'mandala', 'rangoliBloom', 'kolam', 'arabesque', 'geometric', 'roseWindow']);
export const isRound = (a?: Art): a is Art => !!a && ROUND.has(a.name);
/** The art when it is a round motif, else the fallback. */
export const round = (a: Art | undefined, fallback: Art): Art => (isRound(a) ? a : fallback);

/** Is this art a person (couples, children, the mother-to-be)? Names never sit on top of them. */
export const isPerson = (art?: Art) => !!art && /^(couple|kid|momToBe|bride|groom)/.test(art.name);

// ─────────────────────────── Layers ───────────────────────────

export function art(id: string, a: Art, frame: Frame, extra: Partial<Extract<LayerInput, { kind: 'ornament' }>> = {}): LayerInput {
  return orn(id, a.name, frame, { color: a.tint ?? 'secondary', ...(a.foil ? { foil: true } : {}), ...extra });
}

/** The artboard's stock: dark (primary into the text colour) or light (surface into background). */
export function stock(kit: Kit, desktop = false): Pick<Extract<CanvasSectionInput['mobile'], object>, 'background' | 'texture' | 'textureStrength'> {
  return {
    background: kit.dark
      ? { type: 'gradient', gradient: { kind: 'radial', from: 'primary', to: 'text' } }
      : { type: 'gradient', gradient: { from: 'surface', to: 'background', angle: desktop ? 160 : 180 } },
    texture: kit.texture,
    textureStrength: kit.strength,
  };
}

export const ink = (kit: Kit) => (kit.dark ? 'accent' : 'primary');
export const softInk = (kit: Kit) => (kit.dark ? 'accent' : 'muted');

export function eyebrowStyle(kit: Kit, size = 11, align: 'left' | 'center' = 'center'): TextStyleInput {
  return { font: 'body', size, weight: 600, color: softInk(kit), letterSpacing: 0.3, transform: 'upper', align };
}

export function nameStyle(kit: Kit, size: number, align: 'left' | 'center' = 'center'): TextStyleInput {
  const scaled = size * (kit.titleScale ?? 1);
  return {
    font: kit.nameFont,
    size: Math.round(kit.nameFont === 'heading' ? scaled * 0.78 : scaled),
    ...(kit.nameWeight ? { weight: kit.nameWeight } : {}),
    color: kit.foil ? 'secondary' : ink(kit),
    ...(kit.foil ? { foil: true } : {}),
    lineHeight: kit.nameFont === 'heading' ? 1.1 : 1.04,
    align,
  };
}

export function dateStyle(kit: Kit, size = 17, align: 'left' | 'center' = 'center'): TextStyleInput {
  return { font: 'heading', size, weight: 600, color: kit.dark ? 'accent' : 'text', letterSpacing: 0.1, transform: 'upper', align };
}

export function cityStyle(kit: Kit, size = 11, align: 'left' | 'center' = 'center'): TextStyleInput {
  return { font: 'body', size, weight: 500, color: softInk(kit), letterSpacing: 0.24, transform: 'upper', align };
}

export const NAMES = TITLE;
export const DATE = b('event.startDate', { format: 'dateWithWeekday' });
export const CITY = b('venue.city');
export const TAGLINE = b('custom.tagline');
/** The couple's initials ("R & A"), or the honoree's, or the event's. */
export const MONOGRAM: Value = {
  template: '{{couple.partnerOne|initial}} & {{couple.partnerTwo|initial}}',
  fallback: { binding: 'honoree.name', format: 'initial', fallback: { binding: 'event.title', format: 'initial' } },
};
export const SCHEDULE = t('template.schedule.title');

// ─────────────────────────── Occasions ───────────────────────────

const COUPLE_SLOTS: SlotKey[] = ['tagline', 'story', 'partnerOneParents', 'partnerTwoParents', 'hashtag', 'closing'];
const COUPLE_PHOTOS: PhotoSlot[] = ['cover', 'partnerOne', 'partnerTwo', 'story', 'closing'];
const HONOREE_SLOTS: SlotKey[] = ['tagline', 'about', 'hashtag', 'closing'];
const HONOREE_PHOTOS: PhotoSlot[] = ['cover', 'story', 'closing'];

const coupleMiddle = (couple: string, story: string, gallery: string): CanvasSpec['middle'] => [
  { id: 'couple', section: 'couple', variant: couple, props: { partnerOneParents: b('custom.partnerOneParents'), partnerTwoParents: b('custom.partnerTwoParents') } },
  { id: 'story', section: 'story', variant: story, props: { text: b('custom.story'), image: b('photo.story', { fallback: b('photos[1]') }) } },
  { id: 'gallery', section: 'gallery', variant: gallery },
];
const honoreeMiddle = (story: string, gallery: string): CanvasSpec['middle'] => [
  { id: 'about', section: 'story', variant: story, props: { text: b('custom.about'), image: b('photo.story', { fallback: b('photos[1]') }) } },
  { id: 'gallery', section: 'gallery', variant: gallery },
];

/** The crest a layout shows: the theme's own, else its motif when that is an emblem, else the occasion's. */
export const crestOf = (kit: Kit, occ: Occasion): Art => kit.crest ?? (kit.motif.name === 'flourish' ? occ.crest : kit.motif);

const RINGS: Art = { name: 'rings', tint: 'secondary' };

const occasion = (o: Omit<Occasion, 'slots' | 'photoSlots' | 'middle'> & { variants?: [string, string, string] }): Occasion => {
  const [a, bb, c] = o.variants ?? ['arch', 'polaroid', 'mosaic'];
  return {
    ...o,
    slots: o.couple ? COUPLE_SLOTS : HONOREE_SLOTS,
    photoSlots: o.couple ? COUPLE_PHOTOS : HONOREE_PHOTOS,
    middle: o.couple ? coupleMiddle(a, bb, c) : honoreeMiddle(bb, c),
  };
};

export const OCCASIONS = {
  wedding: occasion({
    key: 'wedding',
    category: 'Wedding',
    eventTypes: ['WEDDING', 'ENGAGEMENT'],
    eyebrows: [
      [['WEDDING'], t('template.weddingOf')],
      [['ENGAGEMENT'], t('template.engagementOf')],
    ],
    couple: true,
    crest: RINGS,
  }),
  engagement: occasion({ key: 'engagement', category: 'Engagement', eventTypes: ['ENGAGEMENT', 'WEDDING'], eyebrows: [[['ENGAGEMENT', 'WEDDING'], t('template.engagementOf')]], couple: true, crest: RINGS, variants: ['flip', 'polaroid', 'stack'] }),
  haldi: occasion({ key: 'haldi', category: 'Haldi', eventTypes: ['WEDDING'], eyebrows: [[['WEDDING'], t('template.haldi')]], couple: true, crest: { name: 'haldiBowl' }, variants: ['stacked', 'polaroid', 'polaroid'] }),
  mehendi: occasion({ key: 'mehendi', category: 'Mehendi', eventTypes: ['WEDDING'], eyebrows: [[['WEDDING'], t('template.mehendi')]], couple: true, crest: { name: 'mehendiHand', tint: '#8a3a17' }, variants: ['stacked', 'polaroid', 'polaroid'] }),
  sangeet: occasion({ key: 'sangeet', category: 'Sangeet', eventTypes: ['WEDDING'], eyebrows: [[['WEDDING'], t('template.sangeet')]], couple: true, crest: { name: 'dhol' }, variants: ['flip', 'curtain', 'mosaic'] }),
  reception: occasion({ key: 'reception', category: 'Reception', eventTypes: ['WEDDING'], eyebrows: [[['WEDDING'], t('template.reception')]], couple: true, crest: RINGS, variants: ['profile', 'curtain', 'mosaic'] }),
  anniversary: occasion({ key: 'anniversary', category: 'Anniversary', eventTypes: ['ANNIVERSARY'], eyebrows: [[['ANNIVERSARY'], t('template.anniversary')]], couple: true, crest: RINGS, variants: ['profile', 'polaroid', 'stack'] }),
  birthday: occasion({ key: 'birthday', category: 'Birthday', eventTypes: ['BIRTHDAY'], eyebrows: [[['BIRTHDAY'], t('template.birthdayOf')]], couple: false, crest: { name: 'cupcake' } }),
  babyShower: occasion({ key: 'babyShower', category: 'Baby Shower', eventTypes: ['BABY_SHOWER'], eyebrows: [[['BABY_SHOWER'], t('template.babyShower')]], couple: false, crest: { name: 'moonCloud' } }),
  naming: occasion({ key: 'naming', category: 'Naming Ceremony', eventTypes: ['NAMING_CEREMONY', 'MUNDAN'], eyebrows: [[['NAMING_CEREMONY'], t('template.naming')], [['MUNDAN'], t('template.mundan')]], couple: false, crest: { name: 'moonCloud' } }),
  housewarming: occasion({ key: 'housewarming', category: 'Housewarming', eventTypes: ['HOUSEWARMING'], eyebrows: [[['HOUSEWARMING'], t('template.joinUs')]], couple: false, longTitle: true, crest: { name: 'house' } }),
  puja: occasion({ key: 'puja', category: 'Puja & Ceremonies', eventTypes: ['RELIGIOUS', 'THREAD_CEREMONY'], eyebrows: [[['RELIGIOUS', 'THREAD_CEREMONY'], t('template.puja')]], couple: false, longTitle: true, crest: { name: 'kalash' } }),
  festival: occasion({ key: 'festival', category: 'Festival', eventTypes: ['FESTIVAL', 'COMMUNITY'], eyebrows: [[['FESTIVAL', 'COMMUNITY'], t('template.celebrateWith')]], couple: false, longTitle: true, crest: { name: 'diya', tint: 'secondary' } }),
} satisfies Record<string, Occasion>;

export type OccasionKey = keyof typeof OCCASIONS;

export type { FontPreset };
