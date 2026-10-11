import { z } from 'zod';
import { createTranslator, formatEventTime, utcToZonedWallTime, zonedWallTimeToUtcIso } from '@bulava/localization';
import type { Value } from './base';
import { resolveBinding, resolveValue } from './bindings';
import { ArtboardSchema, type Artboard, type ArtboardInput, type CanvasSection, type Frame, type Layer, type LayerInput, type WidgetLayer } from './canvas';
import { sampleRenderContext, type GalleryImage, type RenderContext } from './context';
import { FontsSchema, ThemeColorsSchema, type PhotoSlot, type TemplateDefinition } from './definition';

/**
 * Digital cards (docs/cards.md): a template's opening artboard turned into a
 * still card anyone can edit and download, without an account. A card design
 * is self-contained: its own artboard at the chosen format's size, the
 * palette and fonts, the details its text follows (names, date, venue…) and
 * the photos placed in it. The same design renders in the editor, in the
 * download preview and in the exported image, so the three always match.
 */

// ─────────────────────────── Formats ───────────────────────────

export const CARD_FORMAT_KEYS = ['phone', 'story', 'portrait', 'square', 'landscape'] as const;
export type CardFormat = (typeof CARD_FORMAT_KEYS)[number];

export interface CardFormatSpec {
  /** The artboard's size in design units (CSS px). */
  width: number;
  height: number;
  /** Image pixels per design unit in the exported card. */
  scale: number;
  /** Which of the template's artboards the card starts from. */
  source: 'mobile' | 'desktop';
}

/**
 * Phone: a phone screen (WhatsApp, the template's own artboard); story: 9:16
 * statuses and stories; portrait: a 5 × 7 card (prints at 300 dpi); square:
 * posts; landscape: 16:10 from the template's desktop artboard.
 */
export const CARD_FORMATS: Record<CardFormat, CardFormatSpec> = {
  phone: { width: 390, height: 844, scale: 3, source: 'mobile' },
  story: { width: 450, height: 800, scale: 2.4, source: 'mobile' },
  portrait: { width: 500, height: 700, scale: 3, source: 'mobile' },
  square: { width: 640, height: 640, scale: 1.6875, source: 'mobile' },
  landscape: { width: 1440, height: 900, scale: 4 / 3, source: 'desktop' },
};

/** The exported image's size in pixels. */
export function cardPixelSize(format: CardFormat): { width: number; height: number } {
  const f = CARD_FORMATS[format];
  return { width: Math.round(f.width * f.scale), height: Math.round(f.height * f.scale) };
}

// ─────────────────────────── Details ───────────────────────────

/** Event details a card's text can follow; the editor's Details form fills them. */
export const CARD_DETAIL_KEYS = ['title', 'partnerOne', 'partnerTwo', 'honoree', 'date', 'time', 'venue', 'address', 'city', 'message', 'family'] as const;
export type CardDetailKey = (typeof CARD_DETAIL_KEYS)[number];

const detail = (max: number) => z.string().max(max).default('');
/** YYYY-MM-DD, or empty. */
const dateDetail = () => z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).default('');
/** HH:mm on a 24-hour clock, or empty. */
const timeDetail = () => z.union([z.literal(''), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)]).default('');

/** Most functions a card lists (a timeline such as Mehendi · Sangeet · Wedding). */
export const CARD_MAX_FUNCTIONS = 4;

/** One function on a card's timeline: its name, and its date and time (Indian time). */
export const CardFunctionSchema = z.object({ name: detail(60), date: dateDetail(), time: timeDetail() });
export type CardFunction = z.infer<typeof CardFunctionSchema>;

export const CardDetailsSchema = z.object({
  title: detail(120),
  partnerOne: detail(60),
  partnerTwo: detail(60),
  honoree: detail(80),
  /** YYYY-MM-DD, or empty. */
  date: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).default(''),
  /** HH:mm on a 24-hour clock, or empty. */
  time: z.union([z.literal(''), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)]).default(''),
  venue: detail(120),
  address: detail(200),
  city: detail(80),
  /** The invitation's line under the names. */
  message: detail(300),
  /** Parents' or family names (the blessing line). */
  family: detail(400),
  /** The functions the card lists, in order: what functions[0], functions[1]… show. */
  functions: z.array(CardFunctionSchema).max(CARD_MAX_FUNCTIONS).default([]),
});
export type CardDetails = z.infer<typeof CardDetailsSchema>;

/** The bindings that follow each detail. Text using only these stays linked to the Details form. */
export const CARD_DETAIL_BINDINGS: Record<CardDetailKey, readonly string[]> = {
  title: ['event.title'],
  partnerOne: ['couple.partnerOne', 'couple.brideName'],
  partnerTwo: ['couple.partnerTwo', 'couple.groomName'],
  honoree: ['honoree.name'],
  date: ['event.startDate', 'function.startsAt', 'function.date'],
  time: ['custom.time'],
  venue: ['venue.name', 'function.venue.name'],
  address: ['venue.address', 'function.venue.address'],
  city: ['venue.city', 'function.venue.city'],
  message: ['custom.tagline'],
  family: ['custom.blessings'],
};

const TEXT_BINDINGS: ReadonlySet<string> = new Set(Object.values(CARD_DETAIL_BINDINGS).flat());
/** Date-and-time bindings: on a card they always show as a date (the time is its own detail). */
const DATE_BINDINGS: ReadonlySet<string> = new Set(CARD_DETAIL_BINDINGS.date);
const DATE_FORMATS: ReadonlySet<string> = new Set(['date', 'dateWithWeekday', 'dateShort']);

/** Cards are dated in Indian time. */
export const CARD_TIME_ZONE = 'Asia/Kolkata';

// ─────────────────────────── Photos ───────────────────────────

/** Where a card's photos go: the template's named spots and three free ones. */
export const CARD_PHOTO_BINDINGS = ['photo.cover', 'photo.partnerOne', 'photo.partnerTwo', 'photo.story', 'photo.closing', 'photos[0]', 'photos[1]', 'photos[2]'] as const;
export type CardPhotoBinding = (typeof CARD_PHOTO_BINDINGS)[number];
const PHOTO_BINDINGS: ReadonlySet<string> = new Set(CARD_PHOTO_BINDINGS);
export const isCardPhotoBinding = (binding: string): binding is CardPhotoBinding => PHOTO_BINDINGS.has(binding);

// ─────────────────────────── Text values ───────────────────────────

const TEMPLATE_BINDING = /\{\{\s*([\w.[\]]+)\s*(?:\|\s*(\w+))?\s*\}\}/g;

/** A card function by position (functions[0].name, .date, .time, .startsAt, .venue.name), which the Details form fills. */
const FUNCTION_BINDING = /^functions\[([0-3])\]\.(name|date|time|startsAt|venue\.name)$/;
export const isCardFunctionBinding = (path: string): boolean => FUNCTION_BINDING.test(path);
const FUNCTION_TIME_FORMATS: ReadonlySet<string> = new Set(['date', 'dateWithWeekday', 'dateShort', 'time', 'dateTime']);

/** A function's name or venue shows as text; its date and time only through a date or time format. */
function functionValueOk(path: string, format: string | undefined): boolean {
  const field = FUNCTION_BINDING.exec(path)?.[2];
  if (!field) return false;
  if (field === 'name' || field === 'venue.name') return true;
  return format !== undefined && FUNCTION_TIME_FORMATS.has(format);
}

/** Whether a text value can stay live on a card: words, translations, or the card's details shown as text or dates. */
export function isCardTextValue(value: Value): boolean {
  if ('literal' in value || 't' in value) return true;
  const ok = (path: string, format: string | undefined) =>
    (TEXT_BINDINGS.has(path) && (!DATE_BINDINGS.has(path) || (format !== undefined && DATE_FORMATS.has(format)))) || functionValueOk(path, format);
  if ('binding' in value) return ok(value.binding, value.format) && (!value.fallback || isCardTextValue(value.fallback));
  for (const m of value.template.matchAll(TEMPLATE_BINDING)) if (!ok(m[1]!, m[2])) return false;
  return !value.fallback || isCardTextValue(value.fallback);
}

/** The details a value shows. */
function detailsIn(value: Value, into: Set<CardDetailKey>): void {
  const add = (path: string) => {
    for (const key of CARD_DETAIL_KEYS) if (CARD_DETAIL_BINDINGS[key].includes(path)) into.add(key);
  };
  if ('binding' in value) {
    add(value.binding);
    if (value.fallback) detailsIn(value.fallback, into);
  } else if ('template' in value) {
    for (const m of value.template.matchAll(TEMPLATE_BINDING)) add(m[1]!);
    if (value.fallback) detailsIn(value.fallback, into);
  }
}

/** How many functions a board lists: one past the highest functions[n] its text or conditions use (0 when none). */
export function cardFunctionsShown(board: Pick<Artboard, 'layers'>): number {
  let count = 0;
  const note = (path: string) => {
    const n = FUNCTION_BINDING.exec(path)?.[1];
    if (n !== undefined) count = Math.max(count, Number(n) + 1);
  };
  const visit = (value: Value) => {
    if ('binding' in value) {
      note(value.binding);
      if (value.fallback) visit(value.fallback);
    } else if ('template' in value) {
      for (const m of value.template.matchAll(TEMPLATE_BINDING)) note(m[1]!);
      if (value.fallback) visit(value.fallback);
    }
  };
  for (const layer of board.layers) {
    if (layer.kind === 'text' && !layer.hidden) visit(layer.content);
    if (layer.visibleWhen?.exists) note(layer.visibleWhen.exists);
  }
  return count;
}

/** Which details a board shows somewhere (the editor offers to add the others). */
export function cardDetailsShown(board: Pick<Artboard, 'layers'>): Set<CardDetailKey> {
  const shown = new Set<CardDetailKey>();
  for (const layer of board.layers) if (layer.kind === 'text' && !layer.hidden) detailsIn(layer.content, shown);
  return shown;
}

// ─────────────────────────── The design ───────────────────────────

export const CARD_LANGUAGES = ['en', 'hi', 'hi-Latn'] as const;

export const CardDesignSchema = z
  .object({
    v: z.literal(1),
    templateKey: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(80),
    format: z.enum(CARD_FORMAT_KEYS),
    /** The occasion the card is for (an event type key): it picks the template's matching wording. */
    eventType: z.string().regex(/^[A-Z][A-Z0-9_]{1,39}$/),
    language: z.enum(CARD_LANGUAGES),
    colors: ThemeColorsSchema,
    fonts: FontsSchema,
    details: CardDetailsSchema.prefault({}),
    board: ArtboardSchema,
    /** Photo spot → the upload shown there. */
    photos: z.partialRecord(z.enum(CARD_PHOTO_BINDINGS), z.uuid()).default({}),
  })
  .superRefine((d, ctx) => {
    const size = CARD_FORMATS[d.format];
    if (d.board.width !== size.width || d.board.height !== size.height) {
      ctx.addIssue({ code: 'custom', path: ['board'], message: `A ${d.format} card is ${size.width} × ${size.height}` });
    }
    d.board.layers.forEach((layer, i) => {
      const path = ['board', 'layers', i];
      if (layer.kind === 'widget') ctx.addIssue({ code: 'custom', path, message: 'Cards have no buttons or countdowns' });
      // The one condition a card keeps: a timeline item shows while its function is listed.
      const when = layer.visibleWhen;
      if (when && (when.eventTypes || !when.exists || !isCardFunctionBinding(when.exists))) {
        ctx.addIssue({ code: 'custom', path, message: 'Card layers are always shown or hidden, except a timeline item that shows while its function is listed' });
      }
      if (layer.kind === 'text' && !isCardTextValue(layer.content)) ctx.addIssue({ code: 'custom', path, message: 'This text uses data a card does not have' });
      if (layer.kind === 'image' && layer.source.type === 'binding' && !isCardPhotoBinding(layer.source.binding)) ctx.addIssue({ code: 'custom', path, message: 'Unknown photo spot' });
    });
    const ids = new Set<string>();
    for (const layer of d.board.layers) {
      if (ids.has(layer.id)) ctx.addIssue({ code: 'custom', path: ['board', 'layers'], message: `Two layers are called ${layer.id}` });
      ids.add(layer.id);
    }
  });
export type CardDesign = z.infer<typeof CardDesignSchema>;
export type CardDesignInput = z.input<typeof CardDesignSchema>;

/** Licensed template assets a design shows (each must be one of its template's). */
export function cardAssetIds(design: Pick<CardDesign, 'board'>): string[] {
  const ids = new Set<string>();
  const board = design.board;
  if (board.background.type === 'image') ids.add(board.background.assetId);
  for (const layer of board.layers) {
    if (layer.kind === 'image' && layer.source.type === 'asset') ids.add(layer.source.assetId);
    if (layer.kind === 'shape' && layer.fill.type === 'image') ids.add(layer.fill.assetId);
  }
  return [...ids];
}

/** Uploads a design shows (photo spots placed on its board). */
export function cardUploadIds(design: Pick<CardDesign, 'board' | 'photos'>): string[] {
  const used = new Set<string>();
  for (const layer of design.board.layers) if (layer.kind === 'image' && layer.source.type === 'binding' && !layer.hidden) used.add(layer.source.binding);
  return [...new Set(Object.entries(design.photos).flatMap(([binding, id]) => (used.has(binding) && id ? [id] : [])))];
}

/** JSON with object keys sorted, so equal designs serialise (and hash) equally. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined);
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

// ─────────────────────────── Rendering context ───────────────────────────

const SLOT_OF: Partial<Record<CardPhotoBinding, PhotoSlot>> = {
  'photo.cover': 'cover',
  'photo.partnerOne': 'partnerOne',
  'photo.partnerTwo': 'partnerTwo',
  'photo.story': 'story',
  'photo.closing': 'closing',
};

/** A detail's date and time as one instant (noon when no time is given; the time shows only through its own detail). */
export function cardInstant(details: Pick<CardDetails, 'date' | 'time'>): string | null {
  return details.date ? zonedWallTimeToUtcIso(`${details.date}T${details.time || '12:00'}`, CARD_TIME_ZONE) : null;
}

/**
 * What a card's text and photos bind to: its details as a one-function event,
 * and the photos' URLs (signed links, or local previews in the editor).
 * Template assets load through the public asset route unless `assets` has them.
 */
export function cardRenderContext(design: Pick<CardDesign, 'details' | 'eventType' | 'language'>, photoUrls: Partial<Record<CardPhotoBinding, string>> = {}, assets?: Record<string, string>): RenderContext {
  const d = design.details;
  const s = (v: string) => v.trim();
  const when = cardInstant(d);
  const venue = s(d.venue) || s(d.address) || s(d.city) ? { name: s(d.venue), address: s(d.address) || null, city: s(d.city) || null, mapUrl: null } : null;
  const fn = { id: 'card', name: s(d.title), description: null, startsAt: when, endsAt: null, status: 'SCHEDULED', venue };
  // The timeline's functions when the card lists some (they share the card's venue); otherwise the card itself.
  const listed = (d.functions ?? []).map((f, i) => ({ id: `card-${i + 1}`, name: s(f.name), description: null, startsAt: cardInstant(f), endsAt: null, status: 'SCHEDULED', venue }));
  const time = d.time ? formatEventTime(zonedWallTimeToUtcIso(`${d.date || '2026-01-01'}T${d.time}`, CARD_TIME_ZONE), { language: design.language, timeZone: CARD_TIME_ZONE }) : '';
  const image = (url: string | undefined): GalleryImage | undefined => (url ? { url, thumbUrl: url } : undefined);
  const photoSlots: NonNullable<RenderContext['photoSlots']> = {};
  for (const [binding, slot] of Object.entries(SLOT_OF) as Array<[CardPhotoBinding, PhotoSlot]>) {
    const img = image(photoUrls[binding]);
    if (img) photoSlots[slot] = img;
  }
  // Free spots keep their positions: photos[1] stays second even without a first.
  const photos = [image(photoUrls['photos[0]']), image(photoUrls['photos[1]']), image(photoUrls['photos[2]'])] as GalleryImage[];
  return {
    event: { title: s(d.title), description: null, typeKey: design.eventType, startDate: when, endDate: when, language: design.language, timezone: CARD_TIME_ZONE },
    ...(s(d.partnerOne) || s(d.partnerTwo) ? { couple: { partnerOne: s(d.partnerOne), partnerTwo: s(d.partnerTwo), brideName: s(d.partnerOne), groomName: s(d.partnerTwo) } } : {}),
    ...(s(d.honoree) ? { honoree: { name: s(d.honoree) } } : {}),
    functions: listed.length ? listed : [fn],
    function: fn,
    ...(venue ? { venue } : {}),
    gallery: { images: [] },
    photos,
    photoSlots,
    custom: { tagline: s(d.message), blessings: s(d.family), time },
    ...(assets && Object.keys(assets).length ? { assets } : {}),
  };
}

// ─────────────────────────── From a template ───────────────────────────

/** The template's opening artboards: the first section of its first page, when that is a canvas. */
export function heroCanvas(definition: Pick<TemplateDefinition, 'website'>): CanvasSection | null {
  const section = definition.website?.pages[0]?.sections[0];
  return section?.section === 'canvas' && section.canvas ? section.canvas : null;
}

/** Whether a template can become a card. */
export const hasCardDesign = (definition: Pick<TemplateDefinition, 'website'>): boolean => heroCanvas(definition) !== null;

const STILL = { entrance: 'none', delaySec: 0, durationSec: 0.8, motion: 'none' } as const;

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
}

/** Details as the sample event has them, so a new card reads like a real invitation. */
function sampleDetails(ctx: RenderContext, functionCount = 0): CardDetails {
  const when = ctx.function?.startsAt ?? ctx.event.startDate;
  const wall = when ? utcToZonedWallTime(when, CARD_TIME_ZONE) : '';
  const functions = (ctx.functions ?? []).slice(0, Math.min(functionCount, CARD_MAX_FUNCTIONS)).map((f) => {
    const at = f.startsAt ? utcToZonedWallTime(f.startsAt, CARD_TIME_ZONE) : '';
    return { name: f.name, date: at.slice(0, 10), time: at.slice(11, 16) };
  });
  return {
    title: ctx.event.title,
    partnerOne: ctx.couple?.partnerOne ?? '',
    partnerTwo: ctx.couple?.partnerTwo ?? '',
    honoree: ctx.honoree?.name ?? '',
    date: wall.slice(0, 10),
    time: wall.slice(11, 16),
    venue: ctx.venue?.name ?? '',
    address: ctx.venue?.address ?? '',
    city: ctx.venue?.city ?? '',
    message: ctx.custom.tagline ?? '',
    family: ctx.custom.blessings ?? '',
    functions,
  };
}

/**
 * Widgets have nothing to do on a still card: a countdown becomes the time and
 * venue in the same place and lettering, the date/time/venue rows become text,
 * and buttons are dropped.
 */
function widgetAsText(layer: WidgetLayer): LayerInput[] {
  const w = layer.widget;
  const base = { frame: layer.frame, opacity: layer.opacity, blend: layer.blend, locked: layer.locked, hidden: layer.hidden };
  if (w.type === 'countdown') {
    return [
      {
        ...base,
        id: `${layer.id}-when`,
        name: 'Time and venue',
        kind: 'text',
        content: { template: '{{custom.time}} · {{venue.name}}', fallback: { binding: 'venue.name', fallback: { binding: 'custom.time' } } },
        style: { font: w.font, size: Math.max(9, Math.round(w.size * 0.62)), weight: 500, color: w.color, letterSpacing: 0.04, lineHeight: 1.2 },
        overflow: 'shrink',
      },
    ];
  }
  if (w.type === 'details') {
    const contents: Record<string, Value> = {
      date: { binding: 'event.startDate', format: 'dateWithWeekday' },
      time: { binding: 'custom.time' },
      venue: { binding: 'venue.name' },
      address: { binding: 'venue.address' },
      city: { binding: 'venue.city' },
    };
    const rowH = layer.frame.h / w.rows.length;
    return w.rows.map((row, i) => ({
      ...base,
      id: `${layer.id}-${row}`,
      kind: 'text' as const,
      frame: { ...layer.frame, y: layer.frame.y + i * rowH, h: rowH },
      content: contents[row]!,
      style: { font: w.font, size: w.valueSize, color: w.valueColor, align: 'left' as const, lineHeight: 1.25 },
      overflow: 'shrink' as const,
    }));
  }
  return [];
}

export interface CardFromTemplateOptions {
  format?: CardFormat;
  /** The occasion; the template's first event type by default. */
  eventType?: string;
  /** One of the template's languages; its first by default. */
  language?: string;
  /** The template's tags, for sample wording that matches its tradition. */
  tags?: readonly string[];
}

/**
 * A new card from a template: its opening artboard with the wording for the
 * occasion, every text either linked to the card's details or turned into
 * words the customer can edit, widgets as text, motion removed, fitted to the
 * format. The template is never changed.
 */
export function cardFromTemplate(definition: TemplateDefinition, options: CardFromTemplateOptions = {}): CardDesign {
  const hero = heroCanvas(definition);
  if (!hero) throw new Error(`Template ${definition.templateKey} has no card design`);
  const format = options.format ?? 'phone';
  const spec = CARD_FORMATS[format];
  const source = spec.source === 'desktop' ? (hero.desktop ?? hero.mobile) : hero.mobile;
  const eventType = options.eventType ?? definition.eventTypes[0] ?? 'WEDDING';
  const languages = definition.languages.filter((l): l is (typeof CARD_LANGUAGES)[number] => (CARD_LANGUAGES as readonly string[]).includes(l));
  const language = languages.find((l) => l === options.language) ?? languages[0] ?? 'en';
  const sample = sampleRenderContext({ typeKey: eventType, language, tags: options.tags, noPhotos: true });
  const opts = { t: createTranslator(language), language, timeZone: CARD_TIME_ZONE };

  const layers: LayerInput[] = [];
  for (const layer of source.layers) {
    const when = layer.visibleWhen;
    if (when?.eventTypes && !when.eventTypes.includes(eventType)) continue;
    // Photo spots stay (the customer fills them); other conditions follow the sample invitation.
    if (when?.exists && !isCardPhotoBinding(when.exists) && isEmpty(resolveBinding(when.exists, sample))) continue;
    const { visibleWhen: _when, ...rest } = layer;
    // A timeline item hides itself when the customer removes its function; other conditions were settled above.
    const keep = when?.exists && isCardFunctionBinding(when.exists) ? { visibleWhen: { exists: when.exists } } : {};
    const still = { ...rest, ...keep, animation: STILL };
    switch (still.kind) {
      case 'widget':
        layers.push(...widgetAsText(still));
        break;
      case 'text': {
        if (isCardTextValue(still.content)) {
          layers.push(still);
        } else {
          const text = resolveValue(still.content, sample, opts);
          if (text !== undefined && text !== '') layers.push({ ...still, content: { literal: String(text) } });
        }
        break;
      }
      case 'image':
        if (still.source.type === 'asset' || isCardPhotoBinding(still.source.binding)) layers.push(still);
        break;
      default:
        layers.push(still);
    }
  }
  const board = ArtboardSchema.parse({ ...source, effect: 'none', layers } satisfies ArtboardInput);
  return CardDesignSchema.parse({
    v: 1,
    templateKey: definition.templateKey,
    format,
    eventType,
    language,
    colors: definition.theme.colors,
    fonts: definition.fonts,
    details: sampleDetails(sample, cardFunctionsShown(board)),
    board: fitBoard(board, spec.width, spec.height),
    photos: {},
  } satisfies CardDesignInput);
}

// ─────────────────────────── Resizing ───────────────────────────

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * One axis of a layer's frame on a resized board. Layers spanning the board
 * stretch with it (backgrounds, bands, borders); layers touching an edge stay
 * on that edge, bleeding off it as before (corner art, hanging strings); the
 * rest keep their place proportionally. Sizes scale by `k` so nothing is
 * distorted or grows past the smaller side's scale.
 */
function fitAxis(pos: number, size: number, from: number, to: number, k: number): { pos: number; size: number } {
  const scale = to / from;
  const atStart = pos <= 1;
  const atEnd = pos + size >= from - 1;
  if (atStart && atEnd) return { pos: pos * scale, size: size * scale };
  const s = size * k;
  if (atStart) return { pos: pos * k, size: s };
  if (atEnd) return { pos: to - (from - pos) * k, size: s };
  return { pos: (pos + size / 2) * scale - s / 2, size: s };
}

/** Lengths inside a layer (type sizes, radii, borders) at a scale. */
function scaleLayer(layer: Layer, k: number): Layer {
  const n = (v: number, min = 0, max = 8000) => clamp(round1(v * k), min, max);
  switch (layer.kind) {
    case 'text':
      return { ...layer, style: { ...layer.style, size: n(layer.style.size, 6, 600) } };
    case 'image':
      return { ...layer, radius: n(layer.radius, 0, 1000), ...(layer.border ? { border: { ...layer.border, width: n(layer.border.width, 0, 100) } } : {}) };
    case 'shape':
      return { ...layer, radius: n(layer.radius, 0, 1000), ...(layer.stroke ? { stroke: { ...layer.stroke, width: n(layer.stroke.width, 0, 100), dash: n(layer.stroke.dash, 0, 100) } } : {}) };
    case 'widget': {
      const w = layer.widget;
      if (w.type === 'countdown') return { ...layer, widget: { ...w, size: n(w.size, 10, 200) } };
      if (w.type === 'button') return { ...layer, widget: { ...w, size: n(w.size, 8, 120), radius: n(w.radius, 0, 500) } };
      return { ...layer, widget: { ...w, labelSize: n(w.labelSize, 6, 60), valueSize: n(w.valueSize, 8, 120) } };
    }
    default:
      return layer;
  }
}

/**
 * A board at another size: the composition keeps its proportions (nothing
 * stretched or cropped), edge art stays on its edges, and full-width pieces
 * span the new width. Used when a card changes format.
 */
export function fitBoard(board: Artboard, width: number, height: number): Artboard {
  if (board.width === width && board.height === height) return board;
  const k = Math.min(width / board.width, height / board.height);
  return {
    ...board,
    width,
    height,
    layers: board.layers.map((layer) => {
      const f = layer.frame;
      const x = fitAxis(f.x, f.w, board.width, width, k);
      const y = fitAxis(f.y, f.h, board.height, height, k);
      const frame = {
        x: clamp(round1(x.pos), -4000, 8000),
        y: clamp(round1(y.pos), -4000, 8000),
        w: clamp(round1(x.size), 1, 8000),
        h: clamp(round1(y.size), 1, 8000),
        rotate: f.rotate,
      };
      return scaleLayer({ ...layer, frame }, k);
    }),
  };
}

const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);

/** A length the customer changed, as the same proportion of the template's length at the new size. */
function carryLength(fresh: number, base: number, current: number, min: number, max: number): number {
  if (current === base) return fresh;
  return clamp(round1(base > 0 ? fresh * (current / base) : current), min, max);
}

/** A border or stroke the customer changed: their colour (and dash), the width in proportion. */
function carryLine<T extends { width: number }>(fresh: T | undefined, base: T | undefined, current: T | undefined, k: number): T | undefined {
  if (!current) return undefined;
  const width = fresh && base && base.width > 0 ? fresh.width * (current.width / base.width) : current.width * k;
  return { ...current, width: clamp(round1(width), 0, 100) };
}

/**
 * One template element at the new size: the template's own layout for that
 * size (`fresh`), with what the customer changed on it carried over (their
 * `current` element against the template's `base` at the old size): words,
 * styles, colours, crops, hiding. Sizes they changed keep their proportion to
 * the template's. Their moves stay only when both sizes come from the same
 * artboard (`moved` is then their frame fitted to the new size).
 */
function carryEdits(fresh: Layer, base: Layer, current: Layer, moved: Frame | undefined, k: number): Layer {
  if (fresh.kind !== current.kind || base.kind !== current.kind) return fresh;
  const out = { ...fresh } as Record<string, unknown>;
  const cur = current as unknown as Record<string, unknown>;
  const was = base as unknown as Record<string, unknown>;
  const now = fresh as unknown as Record<string, unknown>;
  for (const key of Object.keys(cur)) {
    if (key === 'id' || key === 'kind' || key === 'frame' || same(cur[key], was[key])) continue;
    if (key === 'style' && current.kind === 'text' && base.kind === 'text' && fresh.kind === 'text') {
      const style: Record<string, unknown> = { ...fresh.style };
      for (const [prop, value] of Object.entries(current.style)) {
        if (same(value, (base.style as Record<string, unknown>)[prop])) continue;
        style[prop] = prop === 'size' ? carryLength(fresh.style.size, base.style.size, current.style.size, 6, 600) : value;
      }
      out.style = style;
    } else if (key === 'radius') {
      out.radius = carryLength(now.radius as number, was.radius as number, cur.radius as number, 0, 1000);
    } else if (key === 'border' || key === 'stroke') {
      out[key] = carryLine(now[key] as { width: number } | undefined, was[key] as { width: number } | undefined, cur[key] as { width: number } | undefined, k);
    } else {
      out[key] = cur[key];
    }
  }
  if (!same(current.frame, base.frame)) {
    if (moved) out.frame = moved;
    else if (current.frame.rotate !== base.frame.rotate) out.frame = { ...fresh.frame, rotate: current.frame.rotate };
  }
  return out as unknown as Layer;
}

/**
 * A design in another format, laid out the way the template lays itself out
 * at that size (its phone or desktop artboard, fitted: the same as starting
 * over at that size), with the customer's work carried over: their palette,
 * fonts, details and photos, and on each element their words, styles,
 * colours, crops and what they hid. Elements they deleted stay deleted;
 * elements they added keep their place proportionally; the stacking order is
 * theirs. Moves of the template's elements are kept between sizes drawn from
 * the same artboard (a phone and a square card) and laid out afresh across
 * artboards (a phone and a landscape card). Undo brings back the old size.
 */
export function withCardFormat(design: CardDesign, format: CardFormat, definition: TemplateDefinition, options: Pick<CardFromTemplateOptions, 'tags'> = {}): CardDesign {
  if (design.format === format) return design;
  const spec = CARD_FORMATS[format];
  const fitted = fitBoard(design.board, spec.width, spec.height);
  let before: CardDesign;
  let after: CardDesign;
  try {
    const opts = { eventType: design.eventType, language: design.language, tags: options.tags };
    before = cardFromTemplate(definition, { ...opts, format: design.format });
    after = cardFromTemplate(definition, { ...opts, format });
  } catch {
    // The template can no longer make a card: refit what is there.
    return { ...design, format, board: fitted };
  }
  const base = new Map(before.board.layers.map((l) => [l.id, l]));
  const fresh = new Map(after.board.layers.map((l) => [l.id, l]));
  const fittedById = new Map(fitted.layers.map((l) => [l.id, l]));
  const sameArtboard = CARD_FORMATS[design.format].source === spec.source;
  const k = Math.min(spec.width / design.board.width, spec.height / design.board.height);

  // The customer's elements in their order: the template's at the new layout, their own fitted.
  const layers: Layer[] = [];
  for (const layer of design.board.layers) {
    const now = fresh.get(layer.id);
    const was = base.get(layer.id);
    if (now && was) layers.push(carryEdits(now, was, layer, sameArtboard ? fittedById.get(layer.id)?.frame : undefined, k));
    else if (!was) layers.push(fittedById.get(layer.id) ?? layer);
    // A template element the new size's layout does not have (corner art drawn for phones only) is left out.
  }
  // Elements only the new size's layout has, each after the element below it there.
  const placed = new Set(layers.map((l) => l.id));
  for (const [i, layer] of after.board.layers.entries()) {
    if (placed.has(layer.id) || base.has(layer.id)) continue; // there already, or deleted by the customer
    const below = after.board.layers
      .slice(0, i)
      .reverse()
      .find((l) => placed.has(l.id));
    layers.splice(below ? layers.findIndex((l) => l.id === below.id) + 1 : 0, 0, layer);
    placed.add(layer.id);
  }

  // The card's own surface: theirs where they changed it, the template's otherwise.
  const board = { ...after.board, layers };
  for (const key of ['background', 'texture', 'textureStrength'] as const) {
    if (!same(design.board[key], before.board[key])) (board as Record<string, unknown>)[key] = design.board[key];
  }
  const next = CardDesignSchema.safeParse({ ...design, format, board });
  return next.success ? next.data : { ...design, format, board: fitted };
}
