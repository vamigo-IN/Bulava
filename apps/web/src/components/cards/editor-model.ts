import {
  CARD_PHOTO_BINDINGS,
  LayerSchema,
  resolveBinding,
  type Artboard,
  type CardDesign,
  type CardDetailKey,
  type CardPhotoBinding,
  type Layer,
  type LayerInput,
  type OrnamentLayerName,
  type RenderContext,
  type ThemeColors,
  type Value,
} from '@bulava/template-schema';

/** Pure helpers of the card editor: new layers, ordering, presets. */

/** Occasions whose cards name a couple; others name one person, or nobody. */
export const COUPLE_OCCASIONS = new Set(['WEDDING', 'ENGAGEMENT', 'ANNIVERSARY']);
export const HONOREE_OCCASIONS = new Set(['BIRTHDAY', 'BABY_SHOWER', 'NAMING_CEREMONY', 'MUNDAN', 'THREAD_CEREMONY', 'RETIREMENT']);

let counter = 0;
/** A fresh layer id (letters, digits and dashes, as the schema wants). */
export function newLayerId(kind: string): string {
  counter = (counter + 1) % 1000;
  return `${kind}-${Date.now().toString(36)}${counter.toString(36)}`;
}

const parse = (input: LayerInput): Layer => LayerSchema.parse(input);

/**
 * Whether the design shows a layer for this data: not another occasion's
 * words, not the row of a function that does not exist. The editors keep the
 * others out of their lists and off the stage (they are still in the design).
 */
export function layerShown(layer: Layer, ctx: RenderContext): boolean {
  const when = layer.visibleWhen;
  if (!when) return true;
  if (when.eventTypes && !when.eventTypes.includes(ctx.event.typeKey)) return false;
  if (when.exists) {
    const value = resolveBinding(when.exists, ctx);
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) return false;
  }
  return true;
}

export type TextPreset = 'heading' | 'subheading' | 'body' | 'script';

/** A text box across most of the card, in the middle, in the look of a preset. */
export function textLayer(board: Pick<Artboard, 'width' | 'height'>, preset: TextPreset, content: Value, y?: number): Layer {
  const W = board.width;
  const size = { heading: W * 0.085, subheading: W * 0.04, body: W * 0.042, script: W * 0.08 }[preset];
  const lines = preset === 'body' ? 3 : 1.6;
  const h = Math.round(size * 1.3 * lines);
  return parse({
    id: newLayerId('text'),
    kind: 'text',
    frame: { x: Math.round(W * 0.08), y: Math.round(y ?? board.height * 0.45 - h / 2), w: Math.round(W * 0.84), h },
    content,
    overflow: preset === 'body' ? 'wrap' : 'shrink',
    style:
      preset === 'heading'
        ? { font: 'heading', size: Math.round(size), weight: 600, color: 'primary' }
        : preset === 'subheading'
          ? { font: 'body', size: Math.round(size), weight: 600, color: 'muted', letterSpacing: 0.18, transform: 'upper' }
          : preset === 'script'
            ? { font: 'script', size: Math.round(size), color: 'primary' }
            : { font: 'body', size: Math.round(size), color: 'text', lineHeight: 1.45 },
  });
}

/** What a detail adds when the card does not show it yet: text linked to the Details form. */
export function detailLayer(board: Pick<Artboard, 'width' | 'height'>, key: CardDetailKey): Layer {
  const linked: Record<CardDetailKey, { value: Value; preset: TextPreset }> = {
    title: { value: { binding: 'event.title' }, preset: 'heading' },
    partnerOne: { value: { template: '{{couple.partnerOne}} & {{couple.partnerTwo}}', fallback: { binding: 'couple.partnerOne' } }, preset: 'script' },
    partnerTwo: { value: { template: '{{couple.partnerOne}} & {{couple.partnerTwo}}', fallback: { binding: 'couple.partnerTwo' } }, preset: 'script' },
    honoree: { value: { binding: 'honoree.name' }, preset: 'script' },
    date: { value: { binding: 'event.startDate', format: 'dateWithWeekday' }, preset: 'subheading' },
    time: { value: { binding: 'custom.time' }, preset: 'subheading' },
    venue: { value: { binding: 'venue.name' }, preset: 'subheading' },
    address: { value: { binding: 'venue.address' }, preset: 'body' },
    city: { value: { binding: 'venue.city' }, preset: 'subheading' },
    message: { value: { binding: 'custom.tagline' }, preset: 'body' },
    family: { value: { binding: 'custom.blessings' }, preset: 'body' },
  };
  const { value, preset } = linked[key];
  return { ...textLayer(board, preset, value, board.height * 0.72), name: undefined };
}

/** The first photo spot the design does not use yet (named spots first, then the free ones). */
export function freePhotoBinding(design: Pick<CardDesign, 'board'>): CardPhotoBinding | null {
  const used = new Set(design.board.layers.flatMap((l) => (l.kind === 'image' && l.source.type === 'binding' ? [l.source.binding] : [])));
  return CARD_PHOTO_BINDINGS.find((b) => !used.has(b)) ?? null;
}

/** A new photo, framed in the middle of the board, in the photo spot `binding` (photo.cover, photos[0]…). */
export function photoLayer(board: Pick<Artboard, 'width' | 'height'>, binding: string, aspect = 1): Layer {
  const w = Math.round(Math.min(board.width * 0.56, board.height * 0.4 * aspect));
  const h = Math.round(w / aspect);
  return parse({
    id: newLayerId('photo'),
    kind: 'image',
    source: { type: 'binding', binding },
    frame: { x: Math.round((board.width - w) / 2), y: Math.round((board.height - h) / 2), w, h },
    mask: 'rounded',
    radius: Math.round(w * 0.06),
    border: { width: Math.max(2, Math.round(w * 0.015)), color: 'surface' },
    shadow: true,
    alt: '',
  });
}

/** Decorations the editor offers (the engine draws them; no licence needed). */
export const ORNAMENT_CHOICES: OrnamentLayerName[] = [
  'mandala',
  'lotus',
  'paisley',
  'floral',
  'peacock',
  'laurel',
  'stars',
  'flourish',
  'medallion',
  'toran',
  'marigoldStrand',
  'diya',
  'kalash',
  'lantern',
  'roseCluster',
  'floralGarland',
  'templeBells',
  'rings',
  'doves',
  'elephant',
  'balloonBunch',
  'cake',
  'giftBox',
  'moonCloud',
  // The stationery collection's art (premium-cards.ts)
  'mandalaCrown',
  'mandalaHalf',
  'sparkles',
  'botanicalWreath',
  'marigoldWreath',
  'alpana',
  'prabhavali',
  'kuthuvilakku',
  'marigoldSwag',
  'zariBand',
  'phulkari',
  'laalPaar',
  'goldVine',
  'ghungroo',
  'hairlineFrame',
  'decoFrame',
  'mihrab',
];

/** Drawn to the whole card, a little inside its edges. */
const FULL_FRAMES: ReadonlySet<OrnamentLayerName> = new Set<OrnamentLayerName>(['hairlineFrame', 'decoFrame', 'mihrab']);
/** Borders and swags: across the top, edge to edge. */
const BANDS: ReadonlySet<OrnamentLayerName> = new Set<OrnamentLayerName>(['zariBand', 'phulkari', 'laalPaar', 'marigoldSwag']);
/** Tall strands: down the left side. */
const STRANDS: ReadonlySet<OrnamentLayerName> = new Set<OrnamentLayerName>(['goldVine', 'ghungroo']);

/** Width ÷ height of the line ornaments (illustrations know their own, ILLUSTRATION_ASPECT). */
const LINE_ASPECT: Partial<Record<OrnamentLayerName, number>> = { lotus: 1.6, laurel: 1.4, stars: 1.6, toran: 3.4, marigoldStrand: 0.2, kalash: 0.8, lantern: 0.5 };

export function ornamentAspect(name: OrnamentLayerName, illustrationAspect: Partial<Record<string, number>>): number {
  return illustrationAspect[name] ?? LINE_ASPECT[name] ?? 1;
}

export function ornamentLayer(board: Pick<Artboard, 'width' | 'height'>, name: OrnamentLayerName, aspect: number): Layer {
  const make = (frame: { x: number; y: number; w: number; h: number }) => parse({ id: newLayerId('art'), kind: 'ornament', ornament: name, color: 'secondary', frame });
  if (FULL_FRAMES.has(name)) {
    const m = Math.round(Math.min(board.width, board.height) * 0.04);
    return make({ x: m, y: m, w: board.width - 2 * m, h: board.height - 2 * m });
  }
  if (BANDS.has(name)) return make({ x: 0, y: 0, w: board.width, h: Math.max(24, Math.round(board.width / aspect)) });
  if (STRANDS.has(name)) {
    const h = Math.round(board.height * 0.7);
    return make({ x: Math.round(board.width * 0.04), y: Math.round((board.height - h) / 2), w: Math.max(18, Math.round(h * aspect)), h });
  }
  const share = aspect >= 1.5 ? 0.6 : aspect >= 1 ? 0.42 : aspect >= 0.5 ? 0.28 : 0.1;
  const w = Math.round(board.width * share);
  const h = Math.round(Math.min(w / aspect, board.height * 0.6));
  return parse({ id: newLayerId('art'), kind: 'ornament', ornament: name, color: 'secondary', frame: { x: Math.round((board.width - w) / 2), y: Math.round((board.height - h) / 2), w, h } });
}

export const SHAPE_CHOICES = ['rect', 'ellipse', 'line', 'arch', 'heart', 'star', 'diamond'] as const;

export function shapeLayer(board: Pick<Artboard, 'width' | 'height'>, shape: (typeof SHAPE_CHOICES)[number]): Layer {
  const w = Math.round(board.width * (shape === 'line' ? 0.6 : 0.36));
  const h = shape === 'line' ? 2 : shape === 'rect' ? Math.round(w * 0.6) : shape === 'arch' ? Math.round(w * 1.3) : w;
  return parse({
    id: newLayerId('shape'),
    kind: 'shape',
    shape,
    fill: shape === 'line' ? { type: 'color', color: 'secondary' } : { type: 'color', color: 'accent' },
    radius: shape === 'rect' ? Math.round(w * 0.08) : 0,
    frame: { x: Math.round((board.width - w) / 2), y: Math.round((board.height - h) / 2), w, h },
  });
}

/** One step up or down the stack, or all the way. */
export function restack(board: Artboard, id: string, to: 'up' | 'down' | 'top' | 'bottom'): Artboard {
  const i = board.layers.findIndex((l) => l.id === id);
  if (i < 0) return board;
  const layers = [...board.layers];
  const [layer] = layers.splice(i, 1);
  const at = to === 'top' ? layers.length : to === 'bottom' ? 0 : to === 'up' ? Math.min(layers.length, i + 1) : Math.max(0, i - 1);
  layers.splice(at, 0, layer!);
  return { ...board, layers };
}

export function duplicate(board: Artboard, id: string): { board: Artboard; id: string | null } {
  const i = board.layers.findIndex((l) => l.id === id);
  const layer = board.layers[i];
  if (!layer || board.layers.length >= 120) return { board, id: null };
  const copy = { ...layer, id: newLayerId(layer.kind), frame: { ...layer.frame, x: layer.frame.x + 12, y: layer.frame.y + 12 } } as Layer;
  const layers = [...board.layers];
  layers.splice(i + 1, 0, copy);
  return { board: { ...board, layers }, id: copy.id };
}

/** Palettes to start from: the template's own, then a few the editor offers for every card. */
export const PALETTES: Array<{ name: string; colors: ThemeColors }> = [
  { name: 'Maroon & gold', colors: { primary: '#6b0f1a', secondary: '#c9a227', accent: '#e9c87f', background: '#fdf7ec', surface: '#ffffff', text: '#2b1a12', muted: '#7a6152' } },
  { name: 'Emerald', colors: { primary: '#0f5132', secondary: '#c9a227', accent: '#f1d9a0', background: '#f4f7f1', surface: '#ffffff', text: '#1b2a20', muted: '#5f6f63' } },
  { name: 'Royal blue', colors: { primary: '#1e2a6b', secondary: '#b8902f', accent: '#e8cf8f', background: '#f5f4fb', surface: '#ffffff', text: '#191c33', muted: '#5d6280' } },
  { name: 'Blush', colors: { primary: '#9d3b5a', secondary: '#d99aa8', accent: '#f6d2d9', background: '#fff7f8', surface: '#ffffff', text: '#3a1f28', muted: '#8a6570' } },
  { name: 'Marigold', colors: { primary: '#b4410f', secondary: '#f2a516', accent: '#ffd36b', background: '#fff8ea', surface: '#ffffff', text: '#3b2210', muted: '#85634a' } },
  { name: 'Midnight', colors: { primary: '#141a2e', secondary: '#c9a227', accent: '#e9c87f', background: '#1c2340', surface: '#252d4f', text: '#f6efe0', muted: '#b8b2a3' } },
  { name: 'Sage', colors: { primary: '#4a5d43', secondary: '#a3b18a', accent: '#dfe6cf', background: '#f7f8f2', surface: '#ffffff', text: '#232a20', muted: '#6b7565' } },
  { name: 'Lavender', colors: { primary: '#5b3f8c', secondary: '#b49ad8', accent: '#e7dcf6', background: '#faf8fd', surface: '#ffffff', text: '#2a2138', muted: '#77698a' } },
];

/** Where an empty photo spot shows while editing (never in the preview or the download). */
export const PHOTO_PLACEHOLDER = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#efe6da"/><rect x="6" y="6" width="188" height="188" fill="none" stroke="#b9a48c" stroke-width="3" stroke-dasharray="10 8"/><g fill="none" stroke="#8b735c" stroke-width="6" stroke-linejoin="round"><path d="M64 82h18l8-12h20l8 12h18v52H64z"/><circle cx="100" cy="106" r="14"/></g></svg>',
)}`;
